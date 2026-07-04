const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ========== DATA FILES ==========

const DATA_DIR = path.join(__dirname, 'data');
const leaderboardFile = path.join(DATA_DIR, 'leaderboard.json');
const usersFile = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}
ensureDataDir();

// ========== USER ACCOUNTS ==========

let users = {};

function loadUsers() {
  try {
    if (fs.existsSync(usersFile)) {
      users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      // Migrate old format if needed
      if (Array.isArray(users)) {
        const old = users;
        users = {};
        old.forEach(u => { users[u.username] = { passwordHash: u.passwordHash || u.password, createdAt: u.createdAt || new Date().toISOString() }; });
      }
    }
  } catch (e) {
    console.error('Failed to load users:', e.message);
    users = {};
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Failed to save users:', e.message);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function authenticateUser(username, password) {
  const cleanName = username.trim().slice(0, 20);
  if (!cleanName || !password) return { ok: false, message: 'กรุณากรอกชื่อและรหัสผ่าน' };

  if (users[cleanName]) {
    // Existing user - verify password
    if (users[cleanName].passwordHash === hashPassword(password)) {
      return { ok: true, username: cleanName, isNew: false };
    }
    return { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } else {
    // New user - register
    users[cleanName] = {
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    saveUsers();
    return { ok: true, username: cleanName, isNew: true };
  }
}

loadUsers();

// ========== LEADERBOARD ==========

let leaderboard = [];

function loadLeaderboard() {
  try {
    if (fs.existsSync(leaderboardFile)) {
      const data = fs.readFileSync(leaderboardFile, 'utf8');
      leaderboard = JSON.parse(data);
      leaderboard = leaderboard.map(e => ({
        username: e.username,
        wins: typeof e.wins === 'number' ? e.wins : parseInt(e.wins) || 0
      }));
      leaderboard.sort((a, b) => b.wins - a.wins);
    } else {
      leaderboard = [];
    }
  } catch (e) {
    console.error('Failed to load leaderboard:', e.message);
    leaderboard = [];
  }
}

function saveLeaderboard() {
  try {
    fs.writeFileSync(leaderboardFile, JSON.stringify(leaderboard, null, 2));
  } catch (e) {
    console.error('Failed to save leaderboard:', e.message);
  }
}

loadLeaderboard();

// ========== GAME STATE ==========

const games = {};
const playerSockets = {};

// Guess limits per range
const GUESS_LIMITS = {
  '1-100': 7,
  '1-200': 9,
  '1-1000': 12
};

// ========== HELPERS ==========

function generateGameId() {
  let id;
  do {
    id = Math.floor(1000 + Math.random() * 9000).toString();
  } while (games[id]);
  return id;
}

function getGuessLimit(range) {
  return GUESS_LIMITS[range] || 10;
}

function getActiveGamesList() {
  return Object.values(games)
    .filter(g => g.status === 'waiting' || g.status === 'playing')
    .map(g => ({
      id: g.id,
      creator: g.creator,
      range: g.range,
      modeName: g.modeName,
      playerCount: g.players.length,
      maxPlayers: g.maxPlayers,
      status: g.status
    }));
}

function broadcastGamesList() {
  io.emit('games_list', getActiveGamesList());
}

function broadcastLeaderboard() {
  io.emit('leaderboard', leaderboard.slice(0, 50));
}

function broadcastOnlineCount() {
  io.emit('online_count', Object.keys(playerSockets).length);
}

function getPlayerGuessCount(game, username) {
  return game.guesses.filter(g => g.username === username).length;
}

function getPlayerRemainingGuesses(game, username) {
  const maxGuesses = getGuessLimit(game.range);
  const used = getPlayerGuessCount(game, username);
  return Math.max(0, maxGuesses - used);
}

// ========== SOCKET.IO ==========

io.on('connection', (socket) => {
  console.log(`🔗 Connected: ${socket.id}`);

  // --- LOGIN / REGISTER ---
  socket.on('login', ({ username, password }) => {
    const result = authenticateUser(username, password);
    if (result.ok) {
      // Store authenticated user for this socket
      playerSockets[socket.id] = { 
        username: result.username, 
        gameId: null,
        authenticated: true
      };
      socket.emit('login_success', { 
        username: result.username, 
        isNew: result.isNew 
      });
      console.log(`🔐 ${result.username} logged in${result.isNew ? ' (new)' : ''}`);
    } else {
      socket.emit('login_error', { message: result.message });
    }
  });

  // --- JOIN LOBBY (after login) ---
  socket.on('join_lobby', ({ username }) => {
    const info = playerSockets[socket.id];
    if (!info || !info.authenticated) {
      socket.emit('error', { message: 'กรุณาเข้าสู่ระบบก่อน' });
      return;
    }
    
    const cleanName = username.trim().slice(0, 20);
    info.username = cleanName;
    info.gameId = null;

    socket.emit('games_list', getActiveGamesList());
    socket.emit('leaderboard', leaderboard.slice(0, 50));
    broadcastOnlineCount();
    
    console.log(`👤 ${cleanName} joined lobby`);
  });

  // --- CREATE GAME ---
  socket.on('create_game', ({ username, range, number }) => {
    const cleanName = (username || '').trim().slice(0, 20);
    const num = parseInt(number);
    const [min, max] = range.split('-').map(Number);

    if (!cleanName) {
      socket.emit('error', { message: 'กรุณาระบุชื่อผู้เล่น' });
      return;
    }
    if (isNaN(num) || num < min || num > max) {
      socket.emit('error', { message: `กรุณาเลือกเลขระหว่าง ${min}-${max}` });
      return;
    }

    const maxGuesses = getGuessLimit(range);
    const gameId = generateGameId();
    const modeNames = { '1-100': 'ง่าย (1-100)', '1-200': 'ปานกลาง (1-200)', '1-1000': 'ยาก (1-1000)' };
    
    const game = {
      id: gameId,
      creator: cleanName,
      number: num,
      range: range,
      modeName: modeNames[range] || range,
      min: min,
      max: max,
      players: [{ id: socket.id, username: cleanName }],
      guesses: [],
      status: 'waiting',
      winner: null,
      maxPlayers: 10,
      maxGuesses: maxGuesses,
      createdAt: Date.now()
    };
    
    games[gameId] = game;
    
    if (playerSockets[socket.id]) {
      playerSockets[socket.id].gameId = gameId;
    }

    socket.rooms.forEach(room => {
      if (room !== socket.id) socket.leave(room);
    });
    socket.join(gameId);

    socket.emit('game_created', {
      gameId: game.id,
      creator: game.creator,
      range: game.range,
      modeName: game.modeName,
      players: game.players.map(p => p.username),
      status: game.status,
      number: game.number,
      maxGuesses: game.maxGuesses
    });

    broadcastGamesList();
    console.log(`🎮 ${cleanName} created game ${gameId} (${range}, ${maxGuesses} guesses max)`);
  });

  // --- JOIN GAME ---
  socket.on('join_game', ({ username, gameId }) => {
    const cleanName = (username || '').trim().slice(0, 20);
    const game = games[gameId];

    if (!cleanName) {
      socket.emit('error', { message: 'กรุณาระบุชื่อผู้เล่น' });
      return;
    }
    if (!game) {
      socket.emit('error', { message: 'ไม่พบเกมนี้ ห้องอาจถูกลบไปแล้ว' });
      return;
    }
    if (game.status === 'finished') {
      socket.emit('error', { message: 'เกมนี้จบลงแล้ว' });
      return;
    }
    if (game.players.some(p => p.username === cleanName)) {
      socket.emit('error', { message: 'ชื่อนี้มีคนใช้ในห้องนี้แล้ว' });
      return;
    }
    if (game.players.length >= game.maxPlayers) {
      socket.emit('error', { message: 'ห้องเต็มแล้ว (สูงสุด 10 คน)' });
      return;
    }

    game.players.push({ id: socket.id, username: cleanName });
    
    if (playerSockets[socket.id]) {
      playerSockets[socket.id].gameId = gameId;
    }

    socket.rooms.forEach(room => {
      if (room !== socket.id) socket.leave(room);
    });
    socket.join(gameId);

    // Send game state to joining player
    socket.emit('game_joined', {
      gameId: game.id,
      creator: game.creator,
      range: game.range,
      modeName: game.modeName,
      players: game.players.map(p => p.username),
      status: game.status,
      guesses: game.guesses,
      winner: game.winner,
      isCreator: false,
      maxGuesses: game.maxGuesses,
      remainingGuesses: getPlayerRemainingGuesses(game, cleanName)
    });

    // Notify other players
    socket.to(gameId).emit('player_joined', {
      username: cleanName,
      players: game.players.map(p => p.username)
    });

    // Auto-start if enough players
    if (game.players.length >= 2 && game.status === 'waiting') {
      game.status = 'playing';
      io.to(gameId).emit('game_status_change', { status: 'playing' });
      io.to(gameId).emit('game_message', {
        message: '🎯 เกมเริ่มแล้ว! มีผู้เล่นครบ 2 คนแล้ว!'
      });
    }

    broadcastGamesList();
    console.log(`📥 ${cleanName} joined game ${gameId}`);
  });

  // --- MAKE GUESS ---
  socket.on('make_guess', ({ gameId, username, guess }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit('error', { message: 'ไม่พบเกม' });
      return;
    }
    if (game.status !== 'playing') {
      socket.emit('error', { message: 'เกมยังไม่เริ่มหรือจบแล้ว' });
      return;
    }
    if (username === game.creator) {
      socket.emit('error', { message: 'คุณเป็นคนตั้งเลข คุณทายไม่ได้!' });
      return;
    }
    
    if (!game.players.some(p => p.username === username)) {
      socket.emit('error', { message: 'คุณไม่ได้อยู่ในเกมนี้' });
      return;
    }

    // --- CHECK GUESS LIMIT ---
    const maxGuesses = game.maxGuesses;
    const usedGuesses = getPlayerGuessCount(game, username);
    const remaining = maxGuesses - usedGuesses;

    if (remaining <= 0) {
      socket.emit('error', { message: `❌ ใช้โอกาสทายหมดแล้ว! (${maxGuesses} ครั้ง)` });
      return;
    }

    if (game.guesses.some(g => g.username === username && g.guess === parseInt(guess))) {
      socket.emit('error', { message: 'คุณเคยทายเลขนี้ไปแล้ว' });
      return;
    }

    const guessNum = parseInt(guess);
    if (isNaN(guessNum) || guessNum < game.min || guessNum > game.max) {
      socket.emit('error', { message: `กรุณาใส่เลขระหว่าง ${game.min}-${game.max}` });
      return;
    }

    const target = game.number;
    let result, hint;

    if (guessNum === target) {
      result = 'correct';
      hint = '🎉 ถูกต้อง!';
      game.status = 'finished';
      game.winner = username;

      const existing = leaderboard.find(l => l.username === username);
      if (existing) {
        existing.wins += 1;
      } else {
        leaderboard.push({ username, wins: 1 });
      }
      leaderboard.sort((a, b) => b.wins - a.wins);
      saveLeaderboard();
      broadcastLeaderboard();

      io.to(gameId).emit('game_won', {
        winner: username,
        number: target,
        guesses: game.guesses,
        answer: target
      });

      io.to(gameId).emit('game_message', {
        message: `🏆 ${username} ทายถูก! เลขคือ ${target} (ใช้ ${usedGuesses + 1}/${maxGuesses} ครั้ง)`
      });

      setTimeout(() => {
        delete games[gameId];
        broadcastGamesList();
      }, 120000);

    } else if (guessNum < target) {
      result = 'higher';
      hint = '⬆️ เลขสูงกว่า ' + guessNum;
    } else {
      result = 'lower';
      hint = '⬇️ เลขต่ำกว่า ' + guessNum;
    }

    game.guesses.push({ username, guess: guessNum, result, hint });

    // Calculate remaining guesses for this player
    const newRemaining = result === 'correct' ? 0 : remaining - 1;

    io.to(gameId).emit('guess_result', {
      username,
      guess: guessNum,
      result,
      hint,
      guesses: game.guesses,
      remainingGuesses: newRemaining,
      maxGuesses: maxGuesses
    });

    // If player used all guesses and didn't get it right
    if (result !== 'correct' && newRemaining <= 0) {
      io.to(gameId).emit('player_out_of_guesses', {
        username: username,
        message: `😵 ${username} ใช้โอกาสทายหมดแล้ว (${maxGuesses} ครั้ง)`
      });
    }

    console.log(`🔢 ${username} guessed ${guessNum} in ${gameId}: ${result} (เหลือ ${newRemaining}/${maxGuesses})`);
  });

  // --- START GAME MANUALLY ---
  socket.on('start_game', ({ gameId }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit('error', { message: 'ไม่พบเกม' });
      return;
    }
    if (game.creator !== playerSockets[socket.id]?.username) {
      socket.emit('error', { message: 'เฉพาะคนสร้างเกมเท่านั้นที่เริ่มเกมได้' });
      return;
    }
    if (game.players.length < 2) {
      socket.emit('error', { message: 'ต้องมีผู้เล่นอย่างน้อย 2 คน' });
      return;
    }
    if (game.status === 'playing') {
      socket.emit('error', { message: 'เกมเริ่มแล้ว' });
      return;
    }

    game.status = 'playing';
    io.to(gameId).emit('game_status_change', { status: 'playing' });
    io.to(gameId).emit('game_message', {
      message: '🎯 เกมเริ่มแล้ว! มาเริ่มทายเลขกันเลย!'
    });
    broadcastGamesList();
  });

  // --- GET GAMES (manual refresh) ---
  socket.on('get_games', () => {
    socket.emit('games_list', getActiveGamesList());
  });

  // --- REJOIN / GET GAME STATE ---
  socket.on('get_game_state', ({ gameId }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit('error', { message: 'ไม่พบเกม' });
      return;
    }
    
    const player = playerSockets[socket.id];
    const username = player ? player.username : null;

    socket.emit('game_state', {
      gameId: game.id,
      creator: game.creator,
      range: game.range,
      modeName: game.modeName,
      players: game.players.map(p => p.username),
      status: game.status,
      guesses: game.guesses,
      winner: game.winner,
      number: username === game.creator ? game.number : undefined,
      isCreator: username === game.creator,
      maxGuesses: game.maxGuesses,
      remainingGuesses: username ? getPlayerRemainingGuesses(game, username) : 0
    });
  });

  // --- LEAVE GAME ---
  socket.on('leave_game', ({ gameId }) => {
    handlePlayerLeave(socket.id, gameId);
  });

  // --- DISCONNECT ---
  socket.on('disconnect', () => {
    const info = playerSockets[socket.id];
    if (info && info.gameId) {
      handlePlayerLeave(socket.id, info.gameId);
    }
    delete playerSockets[socket.id];
    broadcastOnlineCount();
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

function handlePlayerLeave(socketId, gameId) {
  const game = games[gameId];
  if (!game) return;

  const player = game.players.find(p => p.id === socketId);
  if (!player) return;

  game.players = game.players.filter(p => p.id !== socketId);

  if (playerSockets[socketId]) {
    playerSockets[socketId].gameId = null;
  }

  if (game.creator === player.username) {
    if (game.players.length > 0) {
      game.creator = game.players[0].username;
      io.to(gameId).emit('creator_changed', { newCreator: game.creator });
      io.to(gameId).emit('game_message', {
        message: `👑 ${game.creator} ได้รับตำแหน่งผู้ตั้งเลขคนใหม่`
      });
    } else {
      delete games[gameId];
      broadcastGamesList();
      return;
    }
  }

  if (game.players.length === 0) {
    delete games[gameId];
    broadcastGamesList();
    return;
  }

  io.to(gameId).emit('player_left', {
    username: player.username,
    players: game.players.map(p => p.username)
  });

  if (game.status === 'playing' && game.players.length === 1 && game.players[0].username === game.creator) {
    game.status = 'waiting';
    io.to(gameId).emit('game_status_change', { status: 'waiting' });
    io.to(gameId).emit('game_message', {
      message: '⏸️ รอผู้เล่นเพิ่ม...'
    });
  }

  broadcastGamesList();
}

// ========== PERIODIC BROADCAST ==========

// Broadcast games list every 3 seconds to keep clients in sync
setInterval(() => {
  broadcastGamesList();
}, 3000);

// ========== START SERVER ==========

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════╗');
  console.log('║     🎯 เกมทายเลขออนไลน์              ║');
  console.log('║     เปิดให้บริการที่:                  ║');
  console.log(`║     http://localhost:${PORT}              ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log(`👤 Users loaded: ${Object.keys(users).length}`);
});
