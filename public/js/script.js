/* ============================================================
   🎯 เกมทายเลข - Client-Side JavaScript
   ============================================================ */

// ========== STATE ==========
const state = {
  username: '',
  password: '',
  currentGameId: null,
  isCreator: false,
  currentRange: '1-100',
  currentMin: 1,
  currentMax: 100,
  gameStatus: null,
  connected: false,
  maxGuesses: 7,
  remainingGuesses: 7,
  gameMode: 'free',       // 'free', '2player', '3player'
  currentTurnPlayer: null // username of current turn holder
};

// ========== DOM REFS ==========
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // Login
  loginScreen: $('login-screen'),
  lobbyScreen: $('lobby-screen'),
  gameScreen: $('game-screen'),
  usernameInput: $('username-input'),
  passwordInput: $('password-input'),
  loginBtn: $('login-btn'),
  loginError: $('login-error'),
  displayUsername: $('display-username'),
  
  // Lobby
  navUsername: $('nav-username'),
  changeNameBtn: $('change-name-btn'),
  onlineCount: $('online-count'),
  modeBtns: $$('.mode-btn'),
  setNumberInput: $('set-number-input'),
  createGameBtn: $('create-game-btn'),
  rangeHint: $('range-hint'),
  modeLimitBadge: $('mode-limit-badge'),
  gmodeBtns: $$('.gmode-btn'),
  gmodeHint: $('gmode-hint'),
  turnIndicator: $('turn-indicator'),
  turnPlayerName: $('turn-player-name'),
  numberInputGroup: $('number-input-group'),
  autoNumberMsg: $('auto-number-msg'),
  gamesContainer: $('games-container'),
  leaderboardContainer: $('leaderboard-container'),
  refreshGamesBtn: $('refresh-games-btn'),
  
  // Game
  gameRoomCode: $('game-room-code'),
  gameModeBadge: $('game-mode-badge'),
  gameStatusBadge: $('game-status-badge'),
  gameUsernameDisplay: $('game-username-display'),
  gameCreator: $('game-creator'),
  gameRange: $('game-range'),
  gamePlayerCount: $('game-player-count'),
  gameGuessCount: $('game-guess-count'),
  remainingGuesses: $('remaining-guesses'),
  guessingCard: $('guessing-card'),
  guessInput: $('guess-input'),
  guessBtn: $('guess-btn'),
  guessFeedback: $('guess-feedback'),
  feedbackText: $('feedback-text'),
  guessHint: $('guess-hint'),
  guessRangeDisplay: $('guess-range-display'),
  guessesRemainingBadge: $('guesses-remaining-badge'),
  guessesRemainingText: $('guesses-remaining-text'),
  guessesMaxText: $('guesses-max-text'),
  guessProgressContainer: $('guess-progress-container'),
  guessProgressFill: $('guess-progress-fill'),
  guessProgressText: $('guess-progress-text'),
  creatorCard: $('creator-card'),
  creatorNumberDisplay: $('creator-number-display'),
  creatorWaitingMsg: $('creator-waiting-msg'),
  startGameBtn: $('start-game-btn'),
  cancelGameBtn: $('cancel-game-btn'),
  leaveGameBtn: $('leave-game-btn'),
  playersList: $('players-list'),
  playerCountBadge: $('player-count-badge'),
  historyContainer: $('history-container'),
  
  // Modal
  winnerModal: $('winner-modal'),
  winnerName: $('winner-name'),
  winnerInfo: $('winner-info'),
  backToLobbyBtn: $('back-to-lobby-btn'),
  
  // Toast
  toastContainer: $('toast-container')
};

// ========== SOCKET ==========
let socket;

function initSocket() {
  socket = io({
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('✅ Connected to server');
    state.connected = true;
    // If we have credentials and not logged in yet, try to login
    if (state.username && state.password) {
      attemptLogin(state.username, state.password);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    state.connected = false;
    showToast('เชื่อมต่อกับเซิร์ฟเวอร์ขาด', 'error');
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
  });

  // --- LOGIN SUCCESS ---
  socket.on('login_success', (data) => {
    state.username = data.username;
    dom.displayUsername.textContent = state.username;
    dom.gameUsernameDisplay.textContent = state.username;
    
    if (data.isNew) {
      showToast(`✅ สมัครสมาชิก "${state.username}" สำเร็จ!`, 'success');
    } else {
      showToast(`✅ เข้าสู่ระบบ "${state.username}" สำเร็จ!`, 'success');
    }
    
    // Save to localStorage
    localStorage.setItem('guessgame_username', state.username);
    
    // Enter lobby
    socket.emit('join_lobby', { username: state.username });
    showScreen('lobby-screen');
  });

  // --- LOGIN ERROR ---
  socket.on('login_error', (data) => {
    dom.loginError.textContent = '❌ ' + data.message;
    dom.loginBtn.disabled = false;
    dom.loginBtn.innerHTML = '<span>🚀 เข้าสู่ระบบ</span>';
    showToast(data.message, 'error');
  });

  // --- Games List ---
  socket.on('games_list', (games) => {
    renderGamesList(games);
  });

  // --- Leaderboard ---
  socket.on('leaderboard', (data) => {
    renderLeaderboard(data);
  });

  // --- Game Created (as creator) ---
  socket.on('game_created', (data) => {
    state.currentGameId = data.gameId;
    state.isCreator = true;
    state.currentRange = data.range;
    state.gameMode = data.mode || 'free';
    state.maxGuesses = data.maxGuesses || 7;
    state.currentTurnPlayer = null;
    const [min, max] = data.range.split('-').map(Number);
    state.currentMin = min;
    state.currentMax = max;

    enterGameScreen(data);
    
    if (state.gameMode === 'free') {
      // Free mode: creator sets the number, can't guess
      state.remainingGuesses = 0;
      dom.creatorCard.style.display = 'block';
      dom.creatorNumberDisplay.textContent = data.number;
      dom.creatorWaitingMsg.style.display = 'block';
      dom.startGameBtn.style.display = 'none';
      dom.guessingCard.style.opacity = '0.5';
      dom.guessInput.disabled = true;
      dom.guessBtn.disabled = true;
      updateRemainingGuessesUI(0, data.maxGuesses);
      dom.turnIndicator.style.display = 'none';
    } else {
      // Turn-based mode: creator is also a guesser
      state.remainingGuesses = state.maxGuesses;
      dom.creatorCard.style.display = 'none';
      dom.turnIndicator.style.display = 'flex';
      dom.turnPlayerName.textContent = data.players[0] || data.creator;
      dom.guessingCard.style.opacity = '0.6';
      dom.guessInput.disabled = true;
      dom.guessBtn.disabled = true;
      updateRemainingGuessesUI(state.maxGuesses, state.maxGuesses);
      showToast('🎲 ระบบจะสุ่มเลขให้เมื่อเริ่มเกม!', 'info');
    }

    showToast(`✅ สร้างห้อง ${data.gameId} สำเร็จ! รอผู้เล่นร่วม...`, 'success');
  });

  // --- Game Joined (as guesser) ---
  socket.on('game_joined', (data) => {
    state.currentGameId = data.gameId;
    state.isCreator = false;
    state.currentRange = data.range;
    state.gameMode = data.mode || 'free';
    state.maxGuesses = data.maxGuesses || 7;
    state.remainingGuesses = data.remainingGuesses !== undefined ? data.remainingGuesses : state.maxGuesses;
    state.currentTurnPlayer = data.currentPlayer || null;
    const [min, max] = data.range.split('-').map(Number);
    state.currentMin = min;
    state.currentMax = max;

    enterGameScreen(data);
    
    dom.creatorCard.style.display = 'none';

    // Show turn indicator for turn-based modes
    if (state.gameMode !== 'free' && data.currentPlayer) {
      dom.turnIndicator.style.display = 'flex';
      dom.turnPlayerName.textContent = data.currentPlayer;
      const isMyTurn = data.currentPlayer === state.username;
      if (!isMyTurn || state.remainingGuesses <= 0) {
        dom.guessingCard.style.opacity = '0.6';
        dom.guessInput.disabled = true;
        dom.guessBtn.disabled = true;
      } else {
        dom.guessingCard.style.opacity = '1';
        dom.guessInput.disabled = false;
        dom.guessBtn.disabled = false;
      }
    } else {
      dom.turnIndicator.style.display = 'none';
      // Enable/disable based on game status (free mode)
      if (data.status === 'playing' && state.remainingGuesses > 0) {
        dom.guessingCard.style.opacity = '1';
        dom.guessInput.disabled = false;
        dom.guessBtn.disabled = false;
      } else {
        dom.guessingCard.style.opacity = '0.5';
        dom.guessInput.disabled = true;
        dom.guessBtn.disabled = true;
      }
    }

    updateRemainingGuessesUI(state.remainingGuesses, state.maxGuesses);

    if (data.guesses && data.guesses.length > 0) {
      renderHistory(data.guesses);
      dom.gameGuessCount.textContent = data.guesses.length;
    }

    showToast(`📥 เข้าร่วมห้อง ${data.gameId} แล้ว!`, 'info');
  });

  // --- Game State (rejoin) ---
  socket.on('game_state', (data) => {
    state.currentGameId = data.gameId;
    state.isCreator = data.isCreator || false;
    state.currentRange = data.range;
    state.gameMode = data.mode || 'free';
    state.maxGuesses = data.maxGuesses || 7;
    state.currentTurnPlayer = data.currentPlayer || null;
    const [min, max] = data.range.split('-').map(Number);
    state.currentMin = min;
    state.currentMax = max;

    // In turn-based mode, creator can also guess
    if (state.gameMode !== 'free') {
      state.remainingGuesses = data.remainingGuesses !== undefined ? data.remainingGuesses : state.maxGuesses;
    } else {
      state.remainingGuesses = data.remainingGuesses !== undefined ? data.remainingGuesses : (data.isCreator ? 0 : state.maxGuesses);
    }

    enterGameScreen(data);

    if (state.gameMode === 'free' && data.isCreator) {
      // Free mode creator: show creator card
      dom.creatorCard.style.display = 'block';
      if (data.number) dom.creatorNumberDisplay.textContent = data.number;
      updateRemainingGuessesUI(0, data.maxGuesses);
      dom.turnIndicator.style.display = 'none';
      dom.guessInput.disabled = true;
      dom.guessBtn.disabled = true;
    } else {
      // Guesser (or turn-based mode where everyone guesses)
      dom.creatorCard.style.display = 'none';
      updateRemainingGuessesUI(state.remainingGuesses, state.maxGuesses);
      
      if (state.gameMode !== 'free' && data.currentPlayer) {
        dom.turnIndicator.style.display = 'flex';
        dom.turnPlayerName.textContent = data.currentPlayer;
        const isMyTurn = data.currentPlayer === state.username;
        dom.guessingCard.style.opacity = (isMyTurn && state.remainingGuesses > 0) ? '1' : '0.6';
        dom.guessInput.disabled = !isMyTurn || state.remainingGuesses <= 0;
        dom.guessBtn.disabled = !isMyTurn || state.remainingGuesses <= 0;
      } else if (state.gameMode === 'free') {
        dom.turnIndicator.style.display = 'none';
        if (data.status === 'playing' && state.remainingGuesses > 0) {
          dom.guessingCard.style.opacity = '1';
          dom.guessInput.disabled = false;
          dom.guessBtn.disabled = false;
        }
      } else {
        dom.turnIndicator.style.display = 'none';
      }
    }

    if (data.guesses && data.guesses.length > 0) {
      renderHistory(data.guesses);
      dom.gameGuessCount.textContent = data.guesses.length;
    }
  });

  // --- Player Joined ---
  socket.on('player_joined', (data) => {
    renderPlayers(data.players);
    dom.gamePlayerCount.textContent = data.players.length;
    dom.playerCountBadge.textContent = data.players.length;
    
    if (state.isCreator && state.gameMode === 'free' && data.players.length >= 2) {
      dom.startGameBtn.style.display = 'inline-flex';
      dom.creatorWaitingMsg.style.display = 'none';
    }
    
    showToast(`👋 ${data.username} เข้าร่วมห้อง`, 'info');
  });

  // --- Player Left ---
  socket.on('player_left', (data) => {
    renderPlayers(data.players);
    dom.gamePlayerCount.textContent = data.players.length;
    dom.playerCountBadge.textContent = data.players.length;
    
    if (state.isCreator && data.players.length < 2) {
      dom.startGameBtn.style.display = 'none';
      dom.creatorWaitingMsg.style.display = 'block';
    }
  });

  // --- Creator Changed ---
  socket.on('creator_changed', (data) => {
    if (data.newCreator === state.username) {
      state.isCreator = true;
      if (state.gameMode === 'free') {
        dom.creatorCard.style.display = 'block';
        dom.creatorNumberDisplay.textContent = '???';
        updateRemainingGuessesUI(0, state.maxGuesses);
        showToast('👑 คุณเป็นผู้ตั้งเลขคนใหม่แล้ว!', 'info');
      } else {
        dom.creatorCard.style.display = 'none';
        showToast('👑 คุณเป็นเจ้าของห้องคนใหม่', 'info');
      }
    }
    dom.gameCreator.textContent = data.newCreator;
  });

  // --- Game Status Change ---
  socket.on('game_status_change', (data) => {
    state.gameStatus = data.status;
    if (data.status === 'playing') {
      dom.gameStatusBadge.textContent = '🎯 กำลังเล่น';
      dom.gameStatusBadge.className = 'badge badge-status playing';
      
      if (state.isCreator && state.gameMode === 'free') {
        dom.creatorWaitingMsg.style.display = 'none';
        dom.startGameBtn.style.display = 'none';
        dom.guessInput.disabled = true;
        dom.guessBtn.disabled = true;
      } else if (state.gameMode !== 'free' && state.currentTurnPlayer) {
        // Turn-based: wait for turn_change event to enable input
        const isMyTurn = state.currentTurnPlayer === state.username;
        dom.guessingCard.style.opacity = isMyTurn ? '1' : '0.6';
        dom.guessInput.disabled = !isMyTurn;
        dom.guessBtn.disabled = !isMyTurn;
        if (isMyTurn) dom.guessInput.focus();
      } else if (state.remainingGuesses > 0) {
        dom.guessingCard.style.opacity = '1';
        dom.guessInput.disabled = false;
        dom.guessBtn.disabled = false;
        dom.guessInput.focus();
      } else {
        dom.guessingCard.style.opacity = '0.5';
        dom.guessInput.disabled = true;
        dom.guessBtn.disabled = true;
      }
    } else if (data.status === 'waiting') {
      dom.gameStatusBadge.textContent = '⏳ รอผู้เล่น';
      dom.gameStatusBadge.className = 'badge badge-status';
    }
  });

  // --- Guess Result ---
  socket.on('guess_result', (data) => {
    renderHistory(data.guesses);
    dom.gameGuessCount.textContent = data.guesses.length;

    // Update remaining guesses for current player
    if (data.username === state.username) {
      state.remainingGuesses = data.remainingGuesses !== undefined ? data.remainingGuesses : state.remainingGuesses - 1;
      updateRemainingGuessesUI(state.remainingGuesses, data.maxGuesses || state.maxGuesses);
      showGuessFeedback(data.result, data.hint);
      
      // If no guesses left, disable input
      if (state.remainingGuesses <= 0) {
        dom.guessInput.disabled = true;
        dom.guessBtn.disabled = true;
        dom.guessingCard.style.opacity = '0.5';
      }
    }

    dom.historyContainer.scrollTop = dom.historyContainer.scrollHeight;
  });

  // --- Player Out of Guesses ---
  socket.on('player_out_of_guesses', (data) => {
    showToast(data.message, 'info');
  });

  // --- Turn Change (turn-based modes) ---
  socket.on('turn_change', (data) => {
    state.currentTurnPlayer = data.currentPlayer;
    dom.turnIndicator.style.display = 'flex';
    dom.turnPlayerName.textContent = data.currentPlayer;

    // Highlight the current player in players list
    $$('.player-item').forEach(el => {
      el.classList.remove('is-turn');
      const nameEl = el.querySelector('.player-name');
      if (nameEl && nameEl.textContent.trim().startsWith(data.currentPlayer)) {
        el.classList.add('is-turn');
      }
    });

    // Enable/disable guess based on turn
    if (state.gameMode !== 'free') {
      const isMyTurn = data.currentPlayer === state.username;
      if (isMyTurn && state.remainingGuesses > 0 && state.gameStatus === 'playing') {
        dom.guessingCard.style.opacity = '1';
        dom.guessInput.disabled = false;
        dom.guessBtn.disabled = false;
        dom.guessInput.focus();
      } else if (!isMyTurn) {
        dom.guessInput.disabled = true;
        dom.guessBtn.disabled = true;
        dom.guessingCard.style.opacity = '0.6';
      }
    }
  });

  // --- Game Won ---
  socket.on('game_won', (data) => {
    dom.gameStatusBadge.textContent = '🏁 จบเกม';
    dom.gameStatusBadge.className = 'badge badge-status finished';
    dom.guessInput.disabled = true;
    dom.guessBtn.disabled = true;
    dom.turnIndicator.style.display = 'none';

    dom.winnerName.textContent = data.winner;
    dom.winnerInfo.textContent = `🎯 ทายเลข ${data.number} ถูกต้อง!`;
    dom.winnerModal.style.display = 'flex';
    
    showToast(`🏆 ${data.winner} เป็นผู้ชนะ!`, 'success');
  });

  // --- Game Message ---
  socket.on('game_message', (data) => {
    showToast(data.message, 'info');
  });

  // --- Online Count ---
  socket.on('online_count', (count) => {
    dom.onlineCount.textContent = `👥 ออนไลน์: ${count}`;
  });

  // --- Error ---
  socket.on('error', (data) => {
    showToast(data.message, 'error');
  });
}

// ========== PARTICLES ==========
function initParticles() {
  const container = document.getElementById('particles-bg');
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = 2 + Math.random() * 4;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (15 + Math.random() * 25) + 's';
    particle.style.animationDelay = (Math.random() * 20) + 's';
    particle.style.opacity = 0.2 + Math.random() * 0.4;
    container.appendChild(particle);
  }
}

// ========== SCREENS ==========
function showScreen(screenId) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ========== LOGIN ==========
function attemptLogin(username, password) {
  if (!socket || !socket.connected) {
    showToast('กำลังเชื่อมต่อเซิร์ฟเวอร์...', 'info');
    return;
  }
  dom.loginBtn.disabled = true;
  dom.loginBtn.innerHTML = '<span>⏳ กำลังเข้าสู่ระบบ...</span>';
  dom.loginError.textContent = '';
  socket.emit('login', { username, password });
}

function handleLogin() {
  const username = dom.usernameInput.value.trim();
  const password = dom.passwordInput.value;
  
  if (!username) {
    dom.usernameInput.focus();
    dom.loginError.textContent = '❌ กรุณาใส่ชื่อผู้ใช้';
    return;
  }
  if (!password) {
    dom.passwordInput.focus();
    dom.loginError.textContent = '❌ กรุณาใส่รหัสผ่าน';
    return;
  }
  
  state.username = username.slice(0, 15);
  state.password = password;
  
  // Connect socket if not connected
  if (!socket || !socket.connected) {
    initSocket();
  } else {
    attemptLogin(state.username, state.password);
  }
}

// ========== LOBBY ==========

// Mode Selection
dom.modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    dom.modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentRange = btn.dataset.range;
    const [min, max] = state.currentRange.split('-').map(Number);
    state.currentMin = min;
    state.currentMax = max;
    dom.setNumberInput.max = max;
    dom.setNumberInput.placeholder = `1-${max}`;
    
    // Update limit badge
    const limit = btn.dataset.limit || 7;
    dom.modeLimitBadge.textContent = `🎯 ${limit} ครั้ง`;
    
    updateRangeHint();
    const val = parseInt(dom.setNumberInput.value);
    if (val < min || val > max) {
      dom.setNumberInput.value = '';
    }
  });
});

// Gameplay Mode Selection
dom.gmodeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    dom.gmodeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.gameMode = btn.dataset.mode;
    const hint = btn.dataset.desc || 'ทุกคนทายได้ทันที';
    dom.gmodeHint.textContent = `📋 ${hint}`;
    
    // For turn-based modes, hide number input (server generates number)
    if (state.gameMode === '2player' || state.gameMode === '3player') {
      dom.numberInputGroup.style.display = 'none';
      dom.autoNumberMsg.style.display = 'block';
      dom.rangeHint.textContent = '🎲 ระบบจะสุ่มเลขให้เมื่อเริ่มเกม';
    } else {
      dom.numberInputGroup.style.display = 'block';
      dom.autoNumberMsg.style.display = 'none';
      updateRangeHint();
    }
  });
});

function updateRangeHint() {
  dom.rangeHint.textContent = `🔢 ใส่เลขระหว่าง ${state.currentMin}-${state.currentMax}`;
  dom.guessRangeDisplay.textContent = `${state.currentMin}-${state.currentMax}`;
  dom.guessHint.textContent = `🔢 ใส่เลขระหว่าง ${state.currentMin}-${state.currentMax}`;
  dom.setNumberInput.placeholder = `1-${state.currentMax}`;
  dom.setNumberInput.max = state.currentMax;
  dom.setNumberInput.min = state.currentMin;
  dom.guessInput.max = state.currentMax;
  dom.guessInput.min = state.currentMin;
}

// Create Game
dom.createGameBtn.addEventListener('click', () => {
  if (!state.username) {
    showToast('กรุณาเข้าสู่ระบบก่อน', 'error');
    return;
  }
  if (!socket || !socket.connected) {
    showToast('กำลังเชื่อมต่อเซิร์ฟเวอร์...', 'error');
    return;
  }
  
  // For turn-based modes, number is auto-generated by server
  if (state.gameMode === '2player' || state.gameMode === '3player') {
    socket.emit('create_game', {
      username: state.username,
      range: state.currentRange,
      mode: state.gameMode
    });
    return;
  }
  
  // Free mode: need to provide a number
  const number = parseInt(dom.setNumberInput.value);
  if (!number || number < state.currentMin || number > state.currentMax) {
    showToast(`กรุณาใส่เลขระหว่าง ${state.currentMin}-${state.currentMax}`, 'error');
    dom.setNumberInput.focus();
    return;
  }

  socket.emit('create_game', {
    username: state.username,
    range: state.currentRange,
    number: number,
    mode: state.gameMode
  });
});

// Join Game
function joinGame(gameId) {
  if (!state.username) {
    showToast('กรุณาเข้าสู่ระบบก่อน', 'error');
    return;
  }
  if (!socket || !socket.connected) {
    showToast('กำลังเชื่อมต่อเซิร์ฟเวอร์...', 'error');
    return;
  }
  socket.emit('join_game', { username: state.username, gameId });
}

// Refresh Games
dom.refreshGamesBtn.addEventListener('click', () => {
  if (socket && socket.connected) {
    socket.emit('get_games');
    showToast('🔄 รีเฟรชรายการห้องแล้ว', 'info');
  }
});

// --- Login Button ---
dom.loginBtn.addEventListener('click', handleLogin);

// --- Change Name ---
dom.changeNameBtn.addEventListener('click', () => {
  const newName = prompt('ใส่ชื่อใหม่:', state.username);
  if (newName && newName.trim()) {
    state.username = newName.trim().slice(0, 15);
    dom.displayUsername.textContent = state.username;
    dom.gameUsernameDisplay.textContent = state.username;
    if (socket && socket.connected) {
      socket.emit('join_lobby', { username: state.username });
    }
    showToast(`✅ เปลี่ยนชื่อเป็น ${state.username} แล้ว`, 'success');
  }
});

// Enter key handlers
dom.usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.passwordInput.focus();
});
dom.passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});
dom.setNumberInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.createGameBtn.click();
});

// ========== GAME SCREEN ==========

function enterGameScreen(data) {
  showScreen('game-screen');
  
  const [min, max] = (data.range || state.currentRange).split('-').map(Number);
  const mode = data.mode || state.gameMode || 'free';
  
  dom.gameRoomCode.innerHTML = `🎯 ห้อง: <strong>${data.gameId || state.currentGameId}</strong>`;
  
  // Show mode in the nav badge
  let modeBadgeText = data.modeName || `${min}-${max}`;
  if (mode === '2player') modeBadgeText = `⚔️ ${modeBadgeText} (2ฝั่ง)`;
  else if (mode === '3player') modeBadgeText = `🔁 ${modeBadgeText} (3ฝั่ง)`;
  dom.gameModeBadge.textContent = modeBadgeText;
  
  dom.gameCreator.textContent = data.creator || '-';
  dom.gameRange.textContent = modeBadgeText;
  
  if (data.players) {
    dom.gamePlayerCount.textContent = data.players.length;
    dom.playerCountBadge.textContent = data.players.length;
    renderPlayers(data.players);
  }

  dom.gameGuessCount.textContent = '0';
  dom.guessRangeDisplay.textContent = `${min}-${max}`;
  dom.guessHint.textContent = `🔢 ใส่เลขระหว่าง ${min}-${max}`;
  dom.guessInput.placeholder = `1-${max}`;
  dom.guessInput.max = max;
  dom.guessInput.min = min;
  dom.guessInput.value = '';
  dom.guessFeedback.style.display = 'none';
  
  state.currentMin = min;
  state.currentMax = max;

  dom.gameStatusBadge.textContent = data.status === 'playing' ? '🎯 กำลังเล่น' : '⏳ รอผู้เล่น';
  dom.gameStatusBadge.className = data.status === 'playing' ? 'badge badge-status playing' : 'badge badge-status';
  state.gameStatus = data.status;

  // Clear history
  dom.historyContainer.innerHTML = `<div class="empty-state small"><p>ยังไม่มีการทาย</p></div>`;
}

// ========== GUESS ==========
dom.guessBtn.addEventListener('click', () => {
  makeGuess();
});

dom.guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') makeGuess();
});

function makeGuess() {
  const guess = parseInt(dom.guessInput.value);
  if (!guess || guess < state.currentMin || guess > state.currentMax) {
    showToast(`กรุณาใส่เลขระหว่าง ${state.currentMin}-${state.currentMax}`, 'error');
    dom.guessInput.focus();
    return;
  }
  if (!state.currentGameId) {
    showToast('ไม่ได้อยู่ในเกม', 'error');
    return;
  }
  if (state.remainingGuesses <= 0) {
    showToast('❌ ใช้โอกาสทายหมดแล้ว!', 'error');
    return;
  }
  
  socket.emit('make_guess', {
    gameId: state.currentGameId,
    username: state.username,
    guess: guess
  });
  
  dom.guessInput.value = '';
  dom.guessInput.focus();
}

// Show Guess Feedback
function showGuessFeedback(result, hint) {
  const fb = dom.guessFeedback;
  const text = dom.feedbackText;
  
  fb.style.display = 'block';
  text.textContent = hint;
  
  fb.querySelector('.feedback-content').className = 'feedback-content';
  
  if (result === 'higher') {
    fb.querySelector('.feedback-content').classList.add('feedback-higher');
  } else if (result === 'lower') {
    fb.querySelector('.feedback-content').classList.add('feedback-lower');
  } else if (result === 'correct') {
    fb.querySelector('.feedback-content').classList.add('feedback-correct');
  }
  
  clearTimeout(fb._timeout);
  fb._timeout = setTimeout(() => {
    fb.style.display = 'none';
  }, 4000);
}

// ========== REMAINING GUESSES UI ==========
function updateRemainingGuessesUI(remaining, maxGuesses) {
  maxGuesses = maxGuesses || state.maxGuesses;
  
  // Update info grid
  dom.remainingGuesses.textContent = `${remaining}/${maxGuesses}`;
  
  // Update badge in guessing header
  dom.guessesRemainingBadge.style.display = 'inline-flex';
  dom.guessesRemainingText.textContent = remaining;
  dom.guessesMaxText.textContent = maxGuesses;
  
  // Color code the badge
  dom.guessesRemainingBadge.className = 'guesses-badge';
  if (remaining <= 0) {
    dom.guessesRemainingBadge.classList.add('exhausted');
  } else if (remaining <= Math.ceil(maxGuesses * 0.3)) {
    dom.guessesRemainingBadge.classList.add('danger');
  } else if (remaining <= Math.ceil(maxGuesses * 0.5)) {
    dom.guessesRemainingBadge.classList.add('warning');
  }
  
  // Update progress bar
  const used = maxGuesses - remaining;
  const pct = maxGuesses > 0 ? (used / maxGuesses) * 100 : 0;
  
  dom.guessProgressContainer.style.display = 'flex';
  dom.guessProgressFill.style.width = Math.min(pct, 100) + '%';
  dom.guessProgressText.textContent = `ใช้ไป ${used}/${maxGuesses} ครั้ง`;
  
  // Color code the progress bar
  dom.guessProgressFill.className = 'guess-progress-fill';
  if (remaining <= 0) {
    dom.guessProgressFill.classList.add('exhausted');
  } else if (remaining <= Math.ceil(maxGuesses * 0.3)) {
    dom.guessProgressFill.classList.add('danger');
  } else if (remaining <= Math.ceil(maxGuesses * 0.5)) {
    dom.guessProgressFill.classList.add('warning');
  }
}

// ========== START / LEAVE / CANCEL ==========

// Start Game
dom.startGameBtn.addEventListener('click', () => {
  if (state.currentGameId) {
    socket.emit('start_game', { gameId: state.currentGameId });
  }
});

// Cancel Game
dom.cancelGameBtn.addEventListener('click', () => {
  if (state.currentGameId) {
    if (confirm('แน่ใจว่าต้องการยกเลิกเกมนี้?')) {
      socket.emit('leave_game', { gameId: state.currentGameId });
      backToLobby();
    }
  }
});

// Leave Game
dom.leaveGameBtn.addEventListener('click', () => {
  if (state.currentGameId) {
    socket.emit('leave_game', { gameId: state.currentGameId });
  }
  backToLobby();
});

// Back to Lobby (from winner modal)
dom.backToLobbyBtn.addEventListener('click', backToLobby);

function backToLobby() {
  dom.winnerModal.style.display = 'none';
  state.currentGameId = null;
  state.isCreator = false;
  state.currentTurnPlayer = null;
  dom.turnIndicator.style.display = 'none';
  showScreen('lobby-screen');
  if (socket && socket.connected) {
    socket.emit('join_lobby', { username: state.username });
  }
}

// ========== RENDER FUNCTIONS ==========

function renderGamesList(games) {
  const container = dom.gamesContainer;
  
  if (!games || games.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎲</div>
        <p>ยังไม่มีห้องเกม</p>
        <p class="empty-sub">สร้างห้องใหม่หรือรอสักครู่</p>
      </div>
    `;
    return;
  }
  
  const modeColors = {
    '1-100': { badge: '🟢', color: '#10b981' },
    '1-200': { badge: '🟡', color: '#f59e0b' },
    '1-1000': { badge: '🔴', color: '#ef4444' }
  };
  
  container.innerHTML = games.map(game => {
    const mc = modeColors[game.range] || { badge: '🎯', color: '#6366f1' };
    const statusText = game.status === 'playing' ? '🎯 กำลังเล่น' : '⏳ รอ';
    const statusClass = game.status === 'playing' ? 'playing' : '';
    
    // Game mode badge
    let modeBadge = '';
    if (game.mode === '2player') modeBadge = '<span class="badge" style="background:rgba(139,92,246,0.15);color:#a78bfa;font-size:10px">⚔️ 2ฝั่ง</span>';
    else if (game.mode === '3player') modeBadge = '<span class="badge" style="background:rgba(139,92,246,0.15);color:#a78bfa;font-size:10px">🔁 3ฝั่ง</span>';
    
    return `
      <div class="game-item" onclick="joinGame('${game.id}')">
        <div class="game-item-info">
          <div class="game-item-name">
            ${mc.badge} ${game.modeName || game.range} ${modeBadge}
          </div>
          <div class="game-item-detail">
            <span>👑 ${game.creator}</span>
            <span>👥 ${game.playerCount}/${game.maxPlayers || 10}</span>
            <span class="badge badge-status ${statusClass}">${statusText}</span>
          </div>
        </div>
        <div class="game-item-actions">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); joinGame('${game.id}')">
            เข้าร่วม
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderLeaderboard(data) {
  const container = dom.leaderboardContainer;
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏆</div>
        <p>ยังไม่มีผู้ชนะ</p>
        <p class="empty-sub">มาเป็นคนแรกเลย!</p>
      </div>
    `;
    return;
  }
  
  const medals = ['🥇', '🥈', '🥉'];
  
  container.innerHTML = data.slice(0, 50).map((entry, index) => {
    const rank = index + 1;
    let topClass = '';
    let rankDisplay = rank;
    
    if (rank === 1) topClass = 'top-1';
    else if (rank === 2) topClass = 'top-2';
    else if (rank === 3) topClass = 'top-3';
    
    if (rank <= 3) {
      rankDisplay = medals[rank - 1];
    }
    
    const isMe = entry.username === state.username;
    
    return `
      <div class="leaderboard-item ${topClass}">
        <span class="leaderboard-rank">${rankDisplay}</span>
        <span class="leaderboard-name">${entry.username} ${isMe ? '(คุณ)' : ''}</span>
        <span class="leaderboard-wins">${entry.wins}</span>
      </div>
    `;
  }).join('');
}

function renderPlayers(players) {
  const container = dom.playersList;
  
  if (!players || players.length === 0) {
    container.innerHTML = `<div class="empty-state small"><p>ไม่มีผู้เล่น</p></div>`;
    return;
  }

  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', 
    '#f43f5e', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#3b82f6'
  ];

  container.innerHTML = players.map((player, index) => {
    const isCreator = player === dom.gameCreator?.textContent;
    const avatarChar = player.charAt(0).toUpperCase();
    const color = colors[index % colors.length];
    const isMe = player === state.username;
    
    return `
      <div class="player-item ${isCreator ? 'is-creator' : ''}">
        <div class="player-avatar" style="background: linear-gradient(135deg, ${color}, ${color}cc);">
          ${avatarChar}
        </div>
        <span class="player-name">${player} ${isMe ? '(คุณ)' : ''}</span>
        ${isCreator ? '<span class="player-badge">👑 เจ้าของห้อง</span>' : ''}
      </div>
    `;
  }).join('');
}

function renderHistory(guesses) {
  const container = dom.historyContainer;
  
  if (!guesses || guesses.length === 0) {
    container.innerHTML = `<div class="empty-state small"><p>ยังไม่มีการทาย</p></div>`;
    return;
  }
  
  container.innerHTML = guesses.map((g, index) => {
    let resultText = '';
    if (g.result === 'higher') resultText = '⬆️ สูงกว่า';
    else if (g.result === 'lower') resultText = '⬇️ ต่ำกว่า';
    else if (g.result === 'correct') resultText = '🎉 ถูกต้อง!';
    
    return `
      <div class="history-item ${g.result}">
        <span class="history-username">${g.username}</span>
        <span class="history-guess">${g.guess}</span>
        <span class="history-result">${resultText}</span>
      </div>
    `;
  }).join('');
  
  container.scrollTop = container.scrollHeight;
}

// ========== TOAST ==========
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ========== INIT ==========
initParticles();
updateRangeHint();

// Check stored credentials
const storedUser = localStorage.getItem('guessgame_username');
if (storedUser) {
  dom.usernameInput.value = storedUser;
  dom.passwordInput.focus();
}

// Set initial limit badge
const activeMode = document.querySelector('.mode-btn.active');
if (activeMode) {
  dom.modeLimitBadge.textContent = `🎯 ${activeMode.dataset.limit || 7} ครั้ง`;
}

// Set initial gameplay mode hint
const activeGMode = document.querySelector('.gmode-btn.active');
if (activeGMode) {
  dom.gmodeHint.textContent = `📋 ${activeGMode.dataset.desc || 'ทุกคนทายได้ทันที'}`;
  state.gameMode = activeGMode.dataset.mode || 'free';
}

// Show/hide number input based on initial mode
if (state.gameMode === '2player' || state.gameMode === '3player') {
  dom.numberInputGroup.style.display = 'none';
  dom.autoNumberMsg.style.display = 'block';
  dom.rangeHint.textContent = '🎲 ระบบจะสุ่มเลขให้เมื่อเริ่มเกม';
}

console.log('🎯 เกมทายเลขพร้อมเล่น!');
