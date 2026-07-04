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
      mode: g.mode,
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
  socket.on('create_game', ({ username, range, number, mode = 'free' }) => {
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
    
    // Max players based on mode
    const maxPlayers = mode === '2player' ? 3 : mode === '3player' ? 4 : 10;
    
    const game = {
      id: gameId,
      creator: cleanName,
      number: num,
      range: range,
      mode: mode, // 'free', '2player', '3player'
      modeName: modeNames[range] || range,
      min: min,
      max: max,
      players: [{ id: socket.id, username: cleanName }],
      guesses: [],
      status: 'waiting',
      winner: null,
      maxPlayers: maxPlayers,
      maxGuesses: maxGuesses,
      turnIndex: -1, // -1 = not started, 0+ = current player index
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
      mode: game.mode,
      modeName: game.modeName,
      players: game.players.map(p => p.username),
      status: game.status,
      number: game.number,
      maxGuesses: game.maxGuesses,
      maxPlayers: game.maxPlayers
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
      mode: game.mode,
      modeName: game.modeName,
      players: game.players.map(p => p.username),
      status: game.status,
      guesses: game.guesses,
      winner: game.winner,
      isCreator: false,
      maxGuesses: game.maxGuesses,
      maxPlayers: game.maxPlayers,
      remainingGuesses: getPlayerRemainingGuesses(game, cleanName),
      turnIndex: game.turnIndex,
      currentPlayer: game.turnIndex >= 0 ? game.players[game.turnIndex].username : null
    });

    // Notify other players
    socket.to(gameId).emit('player_joined', {
      username: cleanName,
      players: game.players.map(p => p.username)
    });

    // Auto-start if enough players (respect turn-based modes)
    let minPlayers = 2;
    if (game.mode === '2player') minPlayers = 3;  // creator + 2 guessers
    else if (game.mode === '3player') minPlayers = 4; // creator + 3 guessers
    
    if (game.players.length >= minPlayers && game.status === 'waiting') {
      game.status = 'playing';
      io.to(gameId).emit('game_status_change', { status: 'playing' });
      
      // Initialize turn for turn-based modes
      if (game.mode !== 'free') {
        game.turnIndex = game.players.findIndex(p => p.username !== game.creator);
        if (game.turnIndex === -1) game.turnIndex = 0;
        io.to(gameId).emit('turn_change', {
          currentPlayer: game.players[game.turnIndex].username
        });
      }
      
      io.to(gameId).emit('game_message', {
        message: '🎯 เกมเริ่มแล้ว! มีผู้เล่นครบแล้ว!'
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

    // --- CHECK TURN (turn-based modes) ---
    if (game.mode !== 'free') {
      const currentPlayer = game.players[game.turnIndex];
      if (!currentPlayer || currentPlayer.username !== username) {
        socket.emit('error', { message: `⏳ ยังไม่ใช่ตาคุณ! ตาของ ${currentPlayer ? currentPlayer.username : 'ผู้เล่นอื่น'}` });
        return;
      }
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

    // Advance turn for turn-based modes (only if not finished)
    if (game.mode !== 'free' && result !== 'correct') {
      game.turnIndex = getNextTurnIndex(game);
      io.to(gameId).emit('turn_change', {
        currentPlayer: game.players[game.turnIndex].username
      });
      io.to(gameId).emit('game_message', {
        message: `🔄 ตาของ ${game.players[game.turnIndex].username} แล้ว!`
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
    let minPlayers = 2;
    if (game.mode === '2player') minPlayers = 3;
    else if (game.mode === '3player') minPlayers = 4;
    if (game.players.length < minPlayers) {
      socket.emit('error', { message: `ต้องมีผู้เล่นอย่างน้อย ${minPlayers} คน (รวมคุณ)` });
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

    // Initialize turn for turn-based modes
    if (game.mode !== 'free') {
      game.turnIndex = game.players.findIndex(p => p.username !== game.creator);
      if (game.turnIndex === -1) game.turnIndex = 0;
      io.to(gameId).emit('turn_change', {
        currentPlayer: game.players[game.turnIndex].username
      });
    }

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
      mode: game.mode,
      modeName: game.modeName,
      players: game.players.map(p => p.username),
      status: game.status,
      guesses: game.guesses,
      winner: game.winner,
      number: username === game.creator ? game.number : undefined,
      isCreator: username === game.creator,
      maxGuesses: game.maxGuesses,
      maxPlayers: game.maxPlayers,
      remainingGuesses: username ? getPlayerRemainingGuesses(game, username) : 0,
      turnIndex: game.turnIndex,
      currentPlayer: game.turnIndex >= 0 ? game.players[game.turnIndex].username : null
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

function getNextTurnIndex(game) {
  if (game.mode === 'free') return -1;
  let next = game.turnIndex;
  let attempts = 0;
  do {
    next = (next + 1) % game.players.length;
    attempts++;
    if (attempts > game.players.length * 2) break;
  } while (game.players[next].username === game.creator);
  return next;
}

function handlePlayerLeave(socketId, gameId) {
  const game = games[gameId];
  if (!game) return;

  const playerIndex = game.players.findIndex(p => p.id === socketId);
  if (playerIndex === -1) return;
  const player = game.players[playerIndex];
  const wasCurrentTurn = game.turnIndex >= 0 && playerIndex === game.turnIndex;

  // Remove the player
  game.players.splice(playerIndex, 1);
  
  // Adjust turnIndex after removal
  if (game.turnIndex >= 0) {
    if (playerIndex < game.turnIndex) {
      game.turnIndex--;
    } else if (game.turnIndex >= game.players.length) {
      game.turnIndex = Math.max(0, game.players.length - 1);
    }
  }

  if (playerSockets[socketId]) {
    playerSockets[socketId].gameId = null;
  }

  if (game.creator === player.username) {
    if (game.players.length > 0) {
      game.creator = game.players[0].username;
      
      // If new creator was the current turn holder, advance turn
      if (game.mode !== 'free' && game.status === 'playing' && game.turnIndex >= 0 &&
          game.players[game.turnIndex]?.username === game.creator) {
        game.turnIndex = getNextTurnIndex(game);
        io.to(gameId).emit('turn_change', {
          currentPlayer: game.players[game.turnIndex].username
        });
      }
      
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

  // Handle turn-based mode
  if (game.mode !== 'free' && game.status === 'playing') {
    const nonCreatorPlayers = game.players.filter(p => p.username !== game.creator);
    if (nonCreatorPlayers.length === 0) {
      // No more guessers, pause game
      game.status = 'waiting';
      game.turnIndex = -1;
      io.to(gameId).emit('game_status_change', { status: 'waiting' });
      io.to(gameId).emit('game_message', {
        message: '⏸️ ไม่มีผู้ทายเหลือแล้ว รอผู้เล่นเพิ่ม...'
      });
    } else if (wasCurrentTurn) {
      // Current turn player left, advance to next
      game.turnIndex = getNextTurnIndex(game);
      io.to(gameId).emit('turn_change', {
        currentPlayer: game.players[game.turnIndex].username
      });
      io.to(gameId).emit('game_message', {
        message: `🔄 ${player.username} ออกไป ตาของ ${game.players[game.turnIndex].username} แล้ว!`
      });
    }
  }

  if (game.status === 'playing' && game.players.length === 1 && game.players[0].username === game.creator) {
    game.status = 'waiting';
    game.turnIndex = -1;
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
