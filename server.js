const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

// Serve static files
app.use(express.static(__dirname + '/public'));

// ========== MONGODB CONNECTION ==========

let db;
let configCollection;

async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('guessgame');
    configCollection = db.collection('config');
    console.log('✅ Connected to MongoDB');
    
    // Create index on config key
    await configCollection.createIndex({ key: 1 }, { unique: true });
  } catch (e) {
    console.error('❌ MongoDB connection failed:', e.message);
    console.log('⚠️ Running without persistence - data will be lost on restart');
    db = null;
    configCollection = null;
  }
}

async function mongoGet(key) {
  if (!configCollection) return null;
  try {
    const doc = await configCollection.findOne({ key });
    return doc ? doc.value : null;
  } catch { return null; }
}

async function mongoSet(key, value) {
  if (!configCollection) return;
  try {
    await configCollection.replaceOne(
      { key },
      { key, value },
      { upsert: true }
    );
  } catch (e) {
    console.error(`Failed to save ${key}:`, e.message);
  }
}

// ========== USER ACCOUNTS ==========

let users = {};

async function loadUsers() {
  const data = await mongoGet('users');
  if (data) {
    users = data;
    // Migrate old array format
    if (Array.isArray(users)) {
      const old = users;
      users = {};
      old.forEach(u => { users[u.username] = { passwordHash: u.passwordHash || u.password, createdAt: u.createdAt || new Date().toISOString() }; });
    }
  } else {
    users = {};
  }
  console.log(`👤 Users loaded: ${Object.keys(users).length}`);
}

async function saveUsers() {
  await mongoSet('users', users);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function authenticateUser(username, password) {
  const cleanName = username.trim().slice(0, 20);
  if (!cleanName || !password) return { ok: false, message: 'กรุณากรอกชื่อและรหัสผ่าน' };

  if (users[cleanName]) {
    if (users[cleanName].passwordHash === hashPassword(password)) {
      return { ok: true, username: cleanName, isNew: false };
    }
    return { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } else {
    users[cleanName] = {
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    saveUsers();
    return { ok: true, username: cleanName, isNew: true };
  }
}

// ========== LEADERBOARD ==========

let leaderboard = [];

async function loadLeaderboard() {
  const data = await mongoGet('leaderboard');
  if (data) {
    leaderboard = data.map(e => ({
      username: e.username,
      wins: typeof e.wins === 'number' ? e.wins : parseInt(e.wins) || 0
    }));
    leaderboard.sort((a, b) => b.wins - a.wins);
  } else {
    leaderboard = [];
  }
}

async function saveLeaderboard() {
  await mongoSet('leaderboard', leaderboard);
}

// ========== RANKED MODE ==========

const RANK_TIERS = ['F', 'E', 'D', 'C', 'B', 'A'];
const RANK_NAMES = { F: 'บรอนซ์', E: 'เงิน', D: 'ทอง', C: 'แพลตตินัม', B: 'ไดมอนด์', A: 'มาสเตอร์' };
const STARS_PER_RANK = 4;
const WINS_PER_STAR = 2;

let ranksData = {};
let rankedQueue = [];
let rankedMatches = {};

async function loadRanks() {
  const data = await mongoGet('ranks');
  ranksData = data || {};
}

async function saveRanks() {
  await mongoSet('ranks', ranksData);
}

function getDefaultRankData() {
  return { rank: 'F', stars: 0, wins: 0, losses: 0, winStreak: 0, bestRank: 'F', starProgress: 0 };
}

function getOrCreateRank(username) {
  if (!ranksData[username]) {
    ranksData[username] = getDefaultRankData();
  }
  return ranksData[username];
}

function getRankIndex(rank) {
  const idx = RANK_TIERS.indexOf(rank);
  return idx >= 0 ? idx : 0;
}

function updateRankAfterWin(username) {
  const rd = getOrCreateRank(username);
  rd.wins += 1;
  rd.winStreak += 1;
  
  rd.starProgress += 0.5;
  
  if (rd.starProgress >= 1) {
    rd.starProgress -= 1;
    rd.stars += 1;
    
    if (rd.stars >= STARS_PER_RANK) {
      const curIdx = getRankIndex(rd.rank);
      if (curIdx < RANK_TIERS.length - 1) {
        rd.rank = RANK_TIERS[curIdx + 1];
        rd.stars = 0;
        rd.starProgress = 0;
      } else {
        rd.stars = STARS_PER_RANK - 1;
        rd.starProgress = 0;
      }
    }
  }
  
  if (getRankIndex(rd.rank) > getRankIndex(rd.bestRank)) {
    rd.bestRank = rd.rank;
  }
  
  saveRanks();
  return rd;
}

function updateRankAfterLoss(username) {
  const rd = getOrCreateRank(username);
  rd.losses += 1;
  rd.winStreak = 0;
  saveRanks();
  return rd;
}

function getLeaderboardInfo(username) {
  const rd = ranksData[username];
  if (!rd) return null;
  return {
    username,
    rank: rd.rank,
    stars: rd.stars,
    wins: rd.wins,
    losses: rd.losses,
    winStreak: rd.winStreak,
    bestRank: rd.bestRank
  };
}

// ========== GAME STATE ==========

const games = {};
const playerSockets = {};

// Guess limits per range
const GUESS_LIMITS = {
  '1-100': 7,
  '1-200': 9,
  '1-1000': 12
};

// ========== RANKED MATCHMAKING ==========

let rankedMatchCounter = 0;

function tryMatchPlayers() {
  while (rankedQueue.length >= 2) {
    // Take first 2 players
    const p1 = rankedQueue.shift();
    const p2 = rankedQueue.shift();
    
    // Check both sockets still connected
    if (!playerSockets[p1.socketId] || !playerSockets[p2.socketId]) {
      // Re-add connected player if one disconnected
      if (playerSockets[p1.socketId]) rankedQueue.unshift(p1);
      else if (playerSockets[p2.socketId]) rankedQueue.unshift(p2);
      continue;
    }
    
    // Check neither is in another game
    if (playerSockets[p1.socketId]?.gameId || playerSockets[p2.socketId]?.gameId) {
      // Re-add the one not in a game
      if (!playerSockets[p1.socketId]?.gameId) rankedQueue.unshift(p1);
      if (!playerSockets[p2.socketId]?.gameId) rankedQueue.unshift(p2);
      continue;
    }
    
    // Create match
    rankedMatchCounter++;
    const matchId = 'R' + String(rankedMatchCounter).padStart(4, '0');
    
    // Randomly decide who sets and who guesses
    const p1isSetter = Math.random() < 0.5;
    const setter = p1isSetter ? p1 : p2;
    const guesser = p1isSetter ? p2 : p1;
    
    const match = {
      id: matchId,
      setter: setter.username,
      guesser: guesser.username,
      setterSocket: setter.socketId,
      guesserSocket: guesser.socketId,
      number: null,
      guesses: [],
      status: 'setting', // 'setting' -> 'guessing' -> 'finished'
      winner: null,
      startTime: null,
      createdAt: Date.now()
    };
    
    rankedMatches[matchId] = match;
    
    // Mark both as in a game
    if (playerSockets[setter.socketId]) playerSockets[setter.socketId].gameId = matchId;
    if (playerSockets[guesser.socketId]) playerSockets[guesser.socketId].gameId = matchId;
    
    // Join both to the match room
    const s1Socket = io.sockets.sockets.get(setter.socketId);
    const s2Socket = io.sockets.sockets.get(guesser.socketId);
    if (s1Socket) s1Socket.join(matchId);
    if (s2Socket) s2Socket.join(matchId);
    
    // Notify both players
    const setterInfo = getLeaderboardInfo(setter.username);
    const guesserInfo = getLeaderboardInfo(guesser.username);
    
    io.to(setter.socketId).emit('ranked_match_found', {
      matchId,
      role: 'setter',
      opponent: guesser.username,
      opponentRank: guesserInfo,
      myRank: setterInfo,
      range: '1-100',
      maxGuesses: 7
    });
    
    io.to(guesser.socketId).emit('ranked_match_found', {
      matchId,
      role: 'guesser',
      opponent: setter.username,
      opponentRank: setterInfo,
      myRank: guesserInfo,
      range: '1-100',
      maxGuesses: 7
    });
    
    console.log(`🎲 Ranked match ${matchId}: ${setter.username}(setter) vs ${guesser.username}(guesser)`);
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      if (rankedMatches[matchId] && rankedMatches[matchId].status !== 'finished') {
        console.log(`🧹 Ranked match ${matchId} timed out`);
        io.to(matchId).emit('ranked_match_cancelled', { reason: 'หมดเวลา' });
        delete rankedMatches[matchId];
      }
    }, 300000);
  }
}

function getRankInfo(username) {
  return getLeaderboardInfo(username);
}

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
    const [min, max] = range.split('-').map(Number);

    if (!cleanName) {
      socket.emit('error', { message: 'กรุณาระบุชื่อผู้เล่น' });
      return;
    }

    // For turn-based modes, number is generated by server automatically
    let num = null;
    if (mode === 'free') {
      num = parseInt(number);
      if (isNaN(num) || num < min || num > max) {
        socket.emit('error', { message: `กรุณาเลือกเลขระหว่าง ${min}-${max}` });
        return;
      }
    }

    const maxGuesses = getGuessLimit(range);
    const gameId = generateGameId();
    const modeNames = { '1-100': 'ง่าย (1-100)', '1-200': 'ปานกลาง (1-200)', '1-1000': 'ยาก (1-1000)' };
    
    // Max players based on mode
    const maxPlayers = mode === '2player' ? 2 : mode === '3player' ? 3 : 10;
    
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
      numberGenerated: false, // true once random number is generated for turn-based modes
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
      maxPlayers: game.maxPlayers,
      numberGenerated: game.numberGenerated
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
    if (game.mode === '2player') minPlayers = 2;
    else if (game.mode === '3player') minPlayers = 3;
    
    if (game.players.length >= minPlayers && game.status === 'waiting') {
      // Generate number for turn-based modes
      if (game.mode !== 'free' && !game.numberGenerated) {
        game.number = Math.floor(Math.random() * (game.max - game.min + 1)) + game.min;
        game.numberGenerated = true;
        console.log(`🎲 Game ${gameId}: Auto-generated number = ${game.number}`);
      }
      
      game.status = 'playing';
      io.to(gameId).emit('game_status_change', { status: 'playing' });
      
      // Initialize turn for turn-based modes (all players including creator guess)
      if (game.mode !== 'free') {
        game.turnIndex = 0;
        io.to(gameId).emit('turn_change', {
          currentPlayer: game.players[game.turnIndex].username
        });
      }
      
      io.to(gameId).emit('game_message', {
        message: '🎯 เกมเริ่มแล้ว! มาเริ่มทายเลขกันเลย!'
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
    // In turn-based modes, creator CAN guess (server generates number)
    if (game.mode === 'free' && username === game.creator) {
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
    if (game.mode === '2player') minPlayers = 2;
    else if (game.mode === '3player') minPlayers = 3;
    if (game.players.length < minPlayers) {
      socket.emit('error', { message: `ต้องมีผู้เล่นอย่างน้อย ${minPlayers} คน` });
      return;
    }
    if (game.status === 'playing') {
      socket.emit('error', { message: 'เกมเริ่มแล้ว' });
      return;
    }

    // Generate number for turn-based modes
    if (game.mode !== 'free' && !game.numberGenerated) {
      game.number = Math.floor(Math.random() * (game.max - game.min + 1)) + game.min;
      game.numberGenerated = true;
      console.log(`🎲 Game ${gameId}: Auto-generated number = ${game.number}`);
    }

    game.status = 'playing';
    io.to(gameId).emit('game_status_change', { status: 'playing' });
    io.to(gameId).emit('game_message', {
      message: '🎯 เกมเริ่มแล้ว! มาเริ่มทายเลขกันเลย!'
    });

    // Initialize turn for turn-based modes (start with first player)
    if (game.mode !== 'free') {
      game.turnIndex = 0;
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
    // Check if it's a ranked match
    if (rankedMatches[gameId]) {
      handleRankedPlayerLeave(socket.id, gameId);
      return;
    }
    handlePlayerLeave(socket.id, gameId);
  });

  // ========== RANKED MODE ==========

  // --- JOIN RANKED QUEUE ---
  socket.on('join_ranked_queue', ({ username }) => {
    const cleanName = (username || '').trim().slice(0, 20);
    if (!cleanName) {
      socket.emit('error', { message: 'กรุณาระบุชื่อผู้เล่น' });
      return;
    }
    
    // Check if already in queue
    if (rankedQueue.some(q => q.username === cleanName)) {
      socket.emit('error', { message: 'คุณอยู่ในคิวรอจับคู่แล้ว' });
      return;
    }
    
    // Check if in a game
    const info = playerSockets[socket.id];
    if (info && info.gameId) {
      socket.emit('error', { message: 'คุณอยู่ในเกมแล้ว กรุณาออกจากเกมก่อน' });
      return;
    }
    
    rankedQueue.push({ socketId: socket.id, username: cleanName });
    console.log(`🎯 ${cleanName} joined ranked queue (queue: ${rankedQueue.length})`);
    socket.emit('ranked_queue_status', { position: rankedQueue.length, queued: true });
    
    // Try to match
    tryMatchPlayers();
  });

  // --- LEAVE RANKED QUEUE ---
  socket.on('leave_ranked_queue', () => {
    const idx = rankedQueue.findIndex(q => q.socketId === socket.id);
    if (idx >= 0) {
      const [leaver] = rankedQueue.splice(idx, 1);
      console.log(`🚫 ${leaver.username} left ranked queue`);
      socket.emit('ranked_queue_left');
    }
  });

  // --- SET RANKED NUMBER ---
  socket.on('set_ranked_number', ({ matchId, number }) => {
    const match = rankedMatches[matchId];
    if (!match) {
      socket.emit('error', { message: 'ไม่พบการแข่งขัน' });
      return;
    }
    if (match.setter !== (playerSockets[socket.id]?.username)) {
      socket.emit('error', { message: 'คุณไม่ได้เป็นคนตั้งเลข' });
      return;
    }
    const num = parseInt(number);
    if (isNaN(num) || num < 1 || num > 100) {
      socket.emit('error', { message: 'กรุณาใส่เลขระหว่าง 1-100' });
      return;
    }
    
    match.number = num;
    match.status = 'guessing';
    match.startTime = Date.now();
    
    // Notify guesser that number is set and they can start guessing
    io.to(match.guesserSocket).emit('ranked_guess_start', {
      matchId: match.id,
      range: '1-100',
      maxGuesses: 7,
      guesser: match.guesser,
      setter: match.setter
    });
    
    // Notify setter that number is accepted
    io.to(match.setterSocket).emit('ranked_number_set', {
      matchId: match.id,
      number: num
    });
    
    console.log(`🎯 Ranked ${matchId}: ${match.setter} set number ${num}`);
  });

  // --- RANKED GUESS ---
  socket.on('ranked_guess', ({ matchId, guess }) => {
    const match = rankedMatches[matchId];
    if (!match) {
      socket.emit('error', { message: 'ไม่พบการแข่งขัน' });
      return;
    }
    if (match.status !== 'guessing') {
      socket.emit('error', { message: 'ยังไม่ถึงรอบทายหรือเกมจบแล้ว' });
      return;
    }
    const username = playerSockets[socket.id]?.username;
    if (username !== match.guesser) {
      socket.emit('error', { message: 'คุณไม่ได้เป็นผู้ทาย' });
      return;
    }
    
    const guessNum = parseInt(guess);
    if (isNaN(guessNum) || guessNum < 1 || guessNum > 100) {
      socket.emit('error', { message: 'กรุณาใส่เลขระหว่าง 1-100' });
      return;
    }
    
    // Check if already guessed
    if (match.guesses.some(g => g.guess === guessNum)) {
      socket.emit('error', { message: 'เลขนี้เคยทายไปแล้ว' });
      return;
    }
    
    match.guesses.push({ guess: guessNum, timestamp: Date.now() });
    const target = match.number;
    let result, hint;
    
    if (guessNum === target) {
      result = 'correct';
      hint = '🎉 ถูกต้อง!';
      match.status = 'finished';
      match.winner = match.guesser;
      
      // Update ranks
      updateRankAfterWin(match.guesser);
      updateRankAfterLoss(match.setter);
      
      // Emit result
      io.to(match.setterSocket).emit('ranked_game_result', {
        matchId: match.id,
        winner: match.guesser,
        number: target,
        guesses: match.guesses,
        result: 'loss',
        guesserRank: getLeaderboardInfo(match.guesser),
        setterRank: getLeaderboardInfo(match.setter)
      });
      io.to(match.guesserSocket).emit('ranked_game_result', {
        matchId: match.id,
        winner: match.guesser,
        number: target,
        guesses: match.guesses,
        result: 'win',
        guesserRank: getLeaderboardInfo(match.guesser),
        setterRank: getLeaderboardInfo(match.setter)
      });
      
      console.log(`🏆 Ranked ${matchId}: ${match.guesser} guessed correctly!`);
      
    } else if (guessNum < target) {
      result = 'higher';
      hint = '⬆️ เลขสูงกว่า ' + guessNum;
    } else {
      result = 'lower';
      hint = '⬇️ เลขต่ำกว่า ' + guessNum;
    }
    
    const remaining = 7 - match.guesses.length;
    
    // Send guess result
    io.to(match.setterSocket).emit('ranked_guess_result', {
      guess: guessNum,
      result,
      hint,
      remaining,
      total: 7,
      guesses: match.guesses
    });
    io.to(match.guesserSocket).emit('ranked_guess_result', {
      guess: guessNum,
      result,
      hint,
      remaining,
      total: 7,
      guesses: match.guesses
    });
    
    // Check if guesser ran out
    if (result !== 'correct' && match.guesses.length >= 7) {
      match.status = 'finished';
      match.winner = match.setter;
      
      // Update ranks
      updateRankAfterWin(match.setter);
      updateRankAfterLoss(match.guesser);
      
      io.to(match.setterSocket).emit('ranked_game_result', {
        matchId: match.id,
        winner: match.setter,
        number: target,
        guesses: match.guesses,
        result: 'win',
        guesserRank: getLeaderboardInfo(match.guesser),
        setterRank: getLeaderboardInfo(match.setter)
      });
      io.to(match.guesserSocket).emit('ranked_game_result', {
        matchId: match.id,
        winner: match.setter,
        number: target,
        guesses: match.guesses,
        result: 'loss',
        guesserRank: getLeaderboardInfo(match.guesser),
        setterRank: getLeaderboardInfo(match.setter)
      });
      
      console.log(`🏆 Ranked ${matchId}: ${match.setter} won (guesser out of guesses)`);
    }
    
    console.log(`🔢 Ranked ${matchId}: ${match.guesser} guessed ${guessNum}: ${result}`);
  });

  // --- GET RANK INFO ---
  socket.on('get_rank_info', ({ username }) => {
    const cleanName = (username || '').trim().slice(0, 20);
    if (!cleanName) return;
    
    const info = getOrCreateRank(cleanName);
    const rd = getLeaderboardInfo(cleanName);
    socket.emit('rank_info', rd);
  });

  // --- RANKED LEADERBOARD ---
  socket.on('get_ranked_leaderboard', () => {
    const rankedList = Object.entries(ranksData).map(([username, data]) => ({
      username,
      rank: data.rank,
      stars: data.stars,
      wins: data.wins || 0,
      losses: data.losses || 0,
      total: (data.wins || 0) + (data.losses || 0)
    }));
    
    const rankOrder = { 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1 };
    rankedList.sort((a, b) => {
      const diff = (rankOrder[b.rank] || 0) - (rankOrder[a.rank] || 0);
      if (diff !== 0) return diff;
      return (b.stars || 0) - (a.stars || 0);
    });
    
    socket.emit('ranked_leaderboard', rankedList.slice(0, 50));
  });

  // --- DISCONNECT ---
  socket.on('disconnect', () => {
    const info = playerSockets[socket.id];
    if (info && info.gameId) {
      // Check if it's a ranked match
      if (rankedMatches[info.gameId]) {
        handleRankedPlayerLeave(socket.id, info.gameId);
      } else {
        handlePlayerLeave(socket.id, info.gameId);
      }
    }
    // Remove from ranked queue if present
    const qIdx = rankedQueue.findIndex(q => q.socketId === socket.id);
    if (qIdx >= 0) {
      rankedQueue.splice(qIdx, 1);
      console.log(`🚫 ${info?.username || 'unknown'} disconnected, removed from ranked queue`);
    }
    delete playerSockets[socket.id];
    broadcastOnlineCount();
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

function getNextTurnIndex(game) {
  if (game.mode === 'free') return -1;
  // All players take turns (including creator, since number is auto-generated)
  return (game.turnIndex + 1) % game.players.length;
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
      io.to(gameId).emit('creator_changed', { newCreator: game.creator });
      io.to(gameId).emit('game_message', {
        message: `👑 ${game.creator} กลายเป็นเจ้าของห้องคนใหม่`
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

  // Handle turn-based mode - advance turn if current player left
  if (game.mode !== 'free' && game.status === 'playing' && wasCurrentTurn) {
    if (game.players.length >= 1) {
      game.turnIndex = getNextTurnIndex(game);
      io.to(gameId).emit('turn_change', {
        currentPlayer: game.players[game.turnIndex].username
      });
      io.to(gameId).emit('game_message', {
        message: `🔄 ${player.username} ออกไป ตาของ ${game.players[game.turnIndex].username} แล้ว!`
      });
    }
  }

  // Pause if only 1 player left
  if (game.status === 'playing' && game.players.length <= 1) {
    game.status = 'waiting';
    game.turnIndex = -1;
    io.to(gameId).emit('game_status_change', { status: 'waiting' });
    io.to(gameId).emit('game_message', {
      message: '⏸️ รอผู้เล่นเพิ่ม...'
    });
  }

  broadcastGamesList();
}

// ========== RANKED PLAYER LEAVE ==========

function handleRankedPlayerLeave(socketId, matchId) {
  const match = rankedMatches[matchId];
  if (!match) return;
  
  const info = playerSockets[socketId];
  const username = info?.username || 'unknown';
  
  // Cancel the match
  io.to(matchId).emit('ranked_match_cancelled', { 
    reason: `${username} ออกจากเกม` 
  });
  
  // Clean up
  if (playerSockets[match.setterSocket]) playerSockets[match.setterSocket].gameId = null;
  if (playerSockets[match.guesserSocket]) playerSockets[match.guesserSocket].gameId = null;
  
  delete rankedMatches[matchId];
  console.log(`🚫 ${username} left ranked match ${matchId}`);
}

// ========== PERIODIC BROADCAST ==========

// Broadcast games list every 3 seconds to keep clients in sync
setInterval(() => {
  broadcastGamesList();
}, 3000);

// ========== START SERVER ==========

async function startServer() {
  await connectDB();
  await loadUsers();
  await loadLeaderboard();
  await loadRanks();

  server.listen(PORT, () => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     🎯 เกมทายเลขออนไลน์              ║');
    console.log('║     เปิดให้บริการที่:                  ║');
    console.log(`║     http://localhost:${PORT}              ║`);
    console.log('╚══════════════════════════════════════╝');
    console.log(`👤 Users loaded: ${Object.keys(users).length}`);
  });
}

startServer();
