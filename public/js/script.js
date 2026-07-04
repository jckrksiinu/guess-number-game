/* ============================================================
   🎯 เกมทายเลข - Client-Side JavaScript v2
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
  currentTurnPlayer: null, // username of current turn holder
  
  // Ranked mode
  rankedRole: null,        // 'setter' or 'guesser'
  rankedMatchId: null,
  rankedOpponent: null,
  rankedMyRank: null,
  rankedOpponentRank: null,
  rankedGuesses: [],
  rankedRemainingGuesses: 7,
  rankedMaxGuesses: 7,
  rankedReady: false
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
  rankedNavBtn: $('ranked-nav-btn'),
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
  gameCreatorLabel: $('game-creator-label'),
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
  toastContainer: $('toast-container'),
  
  // Ranked
  rankedQueueOverlay: $('ranked-queue-overlay'),
  rankedQueueCount: $('ranked-queue-count'),
  cancelRankedQueueBtn: $('cancel-ranked-queue-btn'),
  rankedScreen: $('ranked-screen'),
  rankedModeBadge: $('ranked-mode-badge'),
  rankedStatusBadge: $('ranked-status-badge'),
  rankedUsernameDisplay: $('ranked-username-display'),
  rankedLeaveBtn: $('ranked-leave-btn'),
  rankedMyName: $('ranked-my-name'),
  rankedMyRankImg: $('ranked-my-rank-img'),
  rankedMyRankName: $('ranked-my-rank-name'),
  rankedOpponentName: $('ranked-opponent-name'),
  rankedOpponentRankImg: $('ranked-opponent-rank-img'),
  rankedOpponentRankName: $('ranked-opponent-rank-name'),
  rankedSetterArea: $('ranked-setter-area'),
  rankedSetNumberInput: $('ranked-set-number-input'),
  rankedSetNumberBtn: $('ranked-set-number-btn'),
  rankedSetHint: $('ranked-set-hint'),
  rankedGuesserWaiting: $('ranked-guesser-waiting'),
  rankedGuessingArea: $('ranked-guessing-area'),
  rankedGuessInput: $('ranked-guess-input'),
  rankedGuessBtn: $('ranked-guess-btn'),
  rankedGuessFeedback: $('ranked-guess-feedback'),
  rankedFeedbackText: $('ranked-feedback-text'),
  rankedGuessProgress: $('ranked-guess-progress'),
  rankedProgressFillBar: $('ranked-progress-fill-bar'),
  rankedGuessProgressText: $('ranked-guess-progress-text'),
  rankedSetterWaiting: $('ranked-setter-waiting'),
  rankedSetterGuessHistory: $('ranked-setter-guess-history'),
  rankedResultModal: $('ranked-result-modal'),
  rankedResultIcon: $('ranked-result-icon'),
  rankedResultTitle: $('ranked-result-title'),
  rankedResultDesc: $('ranked-result-desc'),
  rankedResultMyImg: $('ranked-result-my-img'),
  rankedResultMyRank: $('ranked-result-my-rank'),
  rankedResultMyStars: $('ranked-result-my-stars'),
  rankedResultOpponentImg: $('ranked-result-opponent-img'),
  rankedResultOpponentRank: $('ranked-result-opponent-rank'),
  rankedResultOpponentStars: $('ranked-result-opponent-stars'),
  rankedResultAnswer: $('ranked-result-answer'),
  rankedResultNumber: $('ranked-result-number'),
  rankedBackToLobbyBtn: $('ranked-back-to-lobby-btn'),
  rankedPlayAgainBtn: $('ranked-play-again-btn'),
  // Ranked Lobby
  rankedLobbyScreen: $('ranked-lobby-screen'),
  rankedLobbyBackBtn: $('ranked-lobby-back-btn'),
  rankedLobbyJoinBtn: $('ranked-lobby-join-btn'),
  rankedLobbyUsername: $('ranked-lobby-username'),
  rankedLobbyBadgeImg: $('ranked-lobby-badge-img'),
  rankedLobbyRankLabel: $('ranked-lobby-rank-label'),
  rankedLobbyRankStars: $('ranked-lobby-rank-stars'),
  rankedLobbyProgressFill: $('ranked-lobby-progress-fill'),
  rankedLobbyProgressText: $('ranked-lobby-progress-text'),
  rankedLobbyWins: $('ranked-lobby-wins'),
  rankedLobbyLosses: $('ranked-lobby-losses'),
  rankedLobbyWinrate: $('ranked-lobby-winrate'),
  rankedLobbyOnline: $('ranked-lobby-online'),
  rankedLeaderboardContainer: $('ranked-leaderboard-container')
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
    dom.rankedLobbyUsername.textContent = state.username;
    
    if (data.isNew) {
      showToast(`✅ สมัครสมาชิก "${state.username}" สำเร็จ!`, 'success');
    } else {
      showToast(`✅ เข้าสู่ระบบ "${state.username}" สำเร็จ!`, 'success');
    }
    
    // Save to localStorage
    localStorage.setItem('guessgame_username', state.username);
    
    // Enter lobby
    socket.emit('join_lobby', { username: state.username });
    socket.emit('get_rank_info', { username: state.username });
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

  // --- Ranked Leaderboard ---
  socket.on('ranked_leaderboard', (data) => {
    renderRankedLeaderboard(data);
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
    dom.gameCreatorLabel.textContent = (state.gameMode === 'free') ? '👑 ผู้ตั้งเลข' : '👑 เจ้าของห้อง';
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
    dom.rankedLobbyOnline.textContent = `👥 ออนไลน์: ${count}`;
  });

  // ========== RANKED MODE EVENTS ==========

  // --- Rank Info ---
  socket.on('rank_info', (data) => {
    if (data) {
      state.rankedMyRank = data;
      updateRankedLobbyDisplay(data);
    }
  });

  // --- Ranked Queue Status ---
  socket.on('ranked_queue_status', (data) => {
    dom.rankedQueueOverlay.style.display = 'flex';
    dom.rankedQueueCount.textContent = data.position || 1;
  });

  // --- Ranked Queue Left ---
  socket.on('ranked_queue_left', () => {
    dom.rankedQueueOverlay.style.display = 'none';
    state.rankedReady = false;
  });

  // --- Ranked Match Found ---
  socket.on('ranked_match_found', (data) => {
    dom.rankedQueueOverlay.style.display = 'none';
    
    state.rankedMatchId = data.matchId;
    state.rankedRole = data.role;
    state.rankedOpponent = data.opponent;
    state.rankedMyRank = data.myRank;
    state.rankedOpponentRank = data.opponentRank;
    state.rankedGuesses = [];
    state.rankedRemainingGuesses = data.maxGuesses;
    state.rankedMaxGuesses = data.maxGuesses;
    state.currentGameId = data.matchId;
    
    enterRankedScreen(data);
  });

  // --- Ranked Number Set (setter confirmed) ---
  socket.on('ranked_number_set', (data) => {
    dom.rankedSetterArea.style.display = 'none';
    dom.rankedSetterWaiting.style.display = 'block';
    dom.rankedStatusBadge.textContent = '⏳ รอคู่ต่อสู้ทาย';
    showToast('✅ เลขถูกบันทึกแล้ว! รอคู่ต่อสู้ทาย...', 'success');
  });

  // --- Ranked Guess Start (guesser can start guessing) ---
  socket.on('ranked_guess_start', (data) => {
    dom.rankedGuesserWaiting.style.display = 'none';
    dom.rankedGuessingArea.style.display = 'block';
    dom.rankedStatusBadge.textContent = '🎯 กำลังทาย';
    dom.rankedGuessInput.disabled = false;
    dom.rankedGuessBtn.disabled = false;
    dom.rankedGuessInput.focus();
    showToast('🎯 คู่ต่อสู้ตั้งเลขแล้ว! มาเริ่มทายกัน!', 'info');
  });

  // --- Ranked Guess Result ---
  socket.on('ranked_guess_result', (data) => {
    state.rankedGuesses = data.guesses || [];
    state.rankedRemainingGuesses = data.remaining;
    
    // Update progress
    if (state.rankedRole === 'guesser') {
      const used = state.rankedMaxGuesses - data.remaining;
      const pct = (used / state.rankedMaxGuesses) * 100;
      dom.rankedProgressFillBar.style.width = Math.min(pct, 100) + '%';
      dom.rankedGuessProgressText.textContent = `ใช้ไป ${used}/${state.rankedMaxGuesses} ครั้ง`;
      dom.rankedGuessProgress.style.display = 'flex';
      
      showGuessFeedbackRanked(data.result, data.hint);
      
      if (data.remaining <= 0) {
        dom.rankedGuessInput.disabled = true;
        dom.rankedGuessBtn.disabled = true;
      }
    }
    
    // Update setter's history
    if (state.rankedRole === 'setter') {
      renderRankedSetterHistory(data.guesses);
    }
  });

  // --- Ranked Game Result ---
  socket.on('ranked_game_result', (data) => {
    dom.rankedScreen.classList.remove('active');
    
    const isWin = data.result === 'win';
    dom.rankedResultIcon.textContent = isWin ? '🏆' : '😢';
    dom.rankedResultTitle.textContent = isWin ? '🎉 คุณชนะ!' : '😞 คุณแพ้';
    dom.rankedResultDesc.textContent = isWin 
      ? `คุณ${state.rankedRole === 'guesser' ? 'ทาย' : ''}ชนะ ${data.winner}!` 
      : `คู่ต่อสู้ชนะ! ${data.winner} ทายถูก`;
    
    // Update rank images
    updateRankedResultImages(data);
    
    dom.rankedResultNumber.textContent = data.number;
    dom.rankedResultAnswer.style.display = 'block';
    
    // Update my rank info
    if (data.guesserRank && data.guesserRank.username === state.username) {
      state.rankedMyRank = data.guesserRank;
    } else if (data.setterRank && data.setterRank.username === state.username) {
      state.rankedMyRank = data.setterRank;
    }
    if (state.rankedMyRank) {
      updateRankedLobbyDisplay(state.rankedMyRank);
    }
    
    dom.rankedResultModal.style.display = 'flex';
  });

  // --- Ranked Match Cancelled ---
  socket.on('ranked_match_cancelled', (data) => {
    dom.rankedScreen.classList.remove('active');
    showToast(`❌ แมตช์ถูกยกเลิก: ${data.reason}`, 'error');
    resetRankedState();
    showScreen('ranked-lobby-screen');
    if (socket && socket.connected) {
      socket.emit('get_rank_info', { username: state.username });
    }
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

// --- Ranked Nav Button ---
dom.rankedNavBtn.addEventListener('click', () => {
  showScreen('ranked-lobby-screen');
  if (socket && socket.connected) {
    socket.emit('get_rank_info', { username: state.username });
    socket.emit('get_ranked_leaderboard');
  }
});

// --- Ranked Lobby Back Button ---
dom.rankedLobbyBackBtn.addEventListener('click', () => {
  showScreen('lobby-screen');
  if (socket && socket.connected) {
    socket.emit('join_lobby', { username: state.username });
    socket.emit('get_rank_info', { username: state.username });
  }
});

// --- Change Name ---
dom.changeNameBtn.addEventListener('click', () => {
  const newName = prompt('ใส่ชื่อใหม่:', state.username);
  if (newName && newName.trim()) {
    state.username = newName.trim().slice(0, 15);
    dom.displayUsername.textContent = state.username;
    dom.gameUsernameDisplay.textContent = state.username;
    dom.rankedLobbyUsername.textContent = state.username;
    if (socket && socket.connected) {
      socket.emit('join_lobby', { username: state.username });
      socket.emit('get_rank_info', { username: state.username });
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
  // Change label based on mode
  dom.gameCreatorLabel.textContent = (mode === 'free') ? '👑 ผู้ตั้งเลข' : '👑 เจ้าของห้อง';
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
    socket.emit('get_rank_info', { username: state.username });
  }
}

// ========== RANKED MODE ==========

const RANK_TIERS = ['F', 'E', 'D', 'C', 'B', 'A'];
const RANK_NAMES = { F: 'บรอนซ์', E: 'เงิน', D: 'ทอง', C: 'แพลตตินัม', B: 'ไดมอนด์', A: 'มาสเตอร์' };

function getRankImagePath(rank, stars = 0) {
  const s = Math.max(1, Math.min(4, stars || 1));
  return `images/ranks/${rank || 'F'}${s}ดาว.png`;
}

function updateRankedLobbyDisplay(data) {
  if (!data) return;
  const rank = data.rank || 'F';
  const stars = data.stars || 0;
  const starsText = '⭐'.repeat(stars) + '☆'.repeat(Math.max(0, 4 - stars));
  
  dom.rankedLobbyBadgeImg.src = getRankImagePath(rank, data.stars);
  dom.rankedLobbyRankLabel.textContent = `${RANK_NAMES[rank] || 'บรอนซ์'} (${rank})`;
  dom.rankedLobbyRankStars.textContent = starsText;
  
  // Progress bar
  const progress = data.starProgress || 0;
  const pct = (progress / 1) * 100;
  dom.rankedLobbyProgressFill.style.width = Math.min(pct, 100) + '%';
  
  const totalStars = data.stars;
  dom.rankedLobbyProgressText.textContent = `${totalStars} / 4 ⭐`;
  
  if (rank === 'A') {
    dom.rankedLobbyProgressText.textContent = '🥇 สูงสุดแล้ว!';
    dom.rankedLobbyProgressFill.style.width = '100%';
  }
  
  // Stats
  const wins = data.wins || 0;
  const losses = data.losses || 0;
  const total = wins + losses;
  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
  dom.rankedLobbyWins.textContent = wins;
  dom.rankedLobbyLosses.textContent = losses;
  dom.rankedLobbyWinrate.textContent = winrate + '%';
}

function enterRankedScreen(data) {
  showScreen('ranked-screen');
  dom.rankedUsernameDisplay.textContent = state.username;
  dom.rankedModeBadge.textContent = '🏆 จัดอันดับ';
  dom.rankedStatusBadge.textContent = data.role === 'setter' ? '⏳ ตั้งเลข' : '⏳ รอคู่ต่อสู้';
  
  // Set player info
  dom.rankedMyName.textContent = state.username;
  dom.rankedOpponentName.textContent = data.opponent;
  
  // Rank images
  const myRank = data.myRank?.rank || 'F';
  const myStars = data.myRank?.stars || 0;
  const oppRank = data.opponentRank?.rank || 'F';
  const oppStars = data.opponentRank?.stars || 0;
  dom.rankedMyRankImg.src = getRankImagePath(myRank, myStars);
  dom.rankedMyRankName.textContent = `${RANK_NAMES[myRank] || 'บรอนซ์'} (${myRank})`;
  dom.rankedOpponentRankImg.src = getRankImagePath(oppRank, oppStars);
  dom.rankedOpponentRankName.textContent = `${RANK_NAMES[oppRank] || 'บรอนซ์'} (${oppRank})`;
  
  // Show appropriate area
  dom.rankedSetterArea.style.display = 'none';
  dom.rankedGuesserWaiting.style.display = 'none';
  dom.rankedGuessingArea.style.display = 'none';
  dom.rankedSetterWaiting.style.display = 'none';
  
  if (data.role === 'setter') {
    dom.rankedSetterArea.style.display = 'block';
    dom.rankedSetNumberInput.value = '';
    dom.rankedSetNumberInput.focus();
  } else {
    dom.rankedGuesserWaiting.style.display = 'block';
  }
  
  dom.rankedGuessProgress.style.display = 'none';
  
  // Reset guess feedback
  dom.rankedGuessFeedback.style.display = 'none';
  dom.rankedGuessInput.value = '';
  dom.rankedGuessInput.disabled = true;
  dom.rankedGuessBtn.disabled = true;
  
  // Reset setter history
  dom.rankedSetterGuessHistory.innerHTML = `<div class="empty-state small"><p>รอการทาย...</p></div>`;
}

function showGuessFeedbackRanked(result, hint) {
  const fb = dom.rankedGuessFeedback;
  const text = dom.rankedFeedbackText;
  
  fb.style.display = 'block';
  text.textContent = hint;
  
  const content = fb.querySelector('.feedback-content');
  content.className = 'feedback-content';
  
  if (result === 'higher') content.classList.add('feedback-higher');
  else if (result === 'lower') content.classList.add('feedback-lower');
  else if (result === 'correct') content.classList.add('feedback-correct');
  
  clearTimeout(fb._timeout);
  fb._timeout = setTimeout(() => {
    fb.style.display = 'none';
  }, 4000);
}

function renderRankedSetterHistory(guesses) {
  if (!guesses || guesses.length === 0) {
    dom.rankedSetterGuessHistory.innerHTML = `<div class="empty-state small"><p>รอการทาย...</p></div>`;
    return;
  }
  
  dom.rankedSetterGuessHistory.innerHTML = guesses.map((g, i) => {
    let resultText = '';
    if (g.result === 'higher') resultText = '⬆️ สูงกว่า';
    else if (g.result === 'lower') resultText = '⬇️ ต่ำกว่า';
    else if (g.result === 'correct') resultText = '🎉 ถูกต้อง!';
    
    return `
      <div class="history-item ${g.result}">
        <span class="history-username">คู่ต่อสู้</span>
        <span class="history-guess">${g.guess}</span>
        <span class="history-result">${resultText}</span>
      </div>
    `;
  }).join('');
  
  dom.rankedSetterGuessHistory.scrollTop = dom.rankedSetterGuessHistory.scrollHeight;
}

function updateRankedResultImages(data) {
  let myR, oppR;
  if (state.rankedRole === 'guesser') {
    myR = data.guesserRank;
    oppR = data.setterRank;
  } else {
    myR = data.setterRank;
    oppR = data.guesserRank;
  }
  
  const myRank = myR?.rank || 'F';
  const oppRank = oppR?.rank || 'F';
  const myStarsCount = myR?.stars || 0;
  const oppStarsCount = oppR?.stars || 0;
  const myStars = '⭐'.repeat(myStarsCount) + '☆'.repeat(Math.max(0, 4 - myStarsCount));
  const oppStars = '⭐'.repeat(oppStarsCount) + '☆'.repeat(Math.max(0, 4 - oppStarsCount));
  
  dom.rankedResultMyImg.src = getRankImagePath(myRank, myStarsCount);
  dom.rankedResultMyRank.textContent = `${RANK_NAMES[myRank] || 'บรอนซ์'} (${myRank})`;
  dom.rankedResultMyStars.textContent = myStars;
  
  dom.rankedResultOpponentImg.src = getRankImagePath(oppRank, oppStarsCount);
  dom.rankedResultOpponentRank.textContent = `${RANK_NAMES[oppRank] || 'บรอนซ์'} (${oppRank})`;
  dom.rankedResultOpponentStars.textContent = oppStars;
}

function resetRankedState() {
  state.rankedRole = null;
  state.rankedMatchId = null;
  state.rankedOpponent = null;
  state.rankedGuesses = [];
  state.rankedRemainingGuesses = 7;
  state.rankedMaxGuesses = 7;
  state.rankedReady = false;
  state.currentGameId = null;
  
  dom.rankedResultModal.style.display = 'none';
  dom.rankedQueueOverlay.style.display = 'none';
  dom.rankedScreen.classList.remove('active');
  
  // Reset ranked game areas
  dom.rankedSetterArea.style.display = 'none';
  dom.rankedGuesserWaiting.style.display = 'none';
  dom.rankedGuessingArea.style.display = 'none';
  dom.rankedSetterWaiting.style.display = 'none';
  dom.rankedGuessFeedback.style.display = 'none';
  dom.rankedGuessProgress.style.display = 'none';
}

// --- Join Ranked Queue ---
dom.rankedLobbyJoinBtn.addEventListener('click', () => {
  if (!state.username) {
    showToast('กรุณาเข้าสู่ระบบก่อน', 'error');
    return;
  }
  if (!socket || !socket.connected) {
    showToast('กำลังเชื่อมต่อเซิร์ฟเวอร์...', 'error');
    return;
  }
  if (!state.rankedMyRank) {
    socket.emit('get_rank_info', { username: state.username });
  }
  socket.emit('join_ranked_queue', { username: state.username });
});

// --- Cancel Ranked Queue ---
dom.cancelRankedQueueBtn.addEventListener('click', () => {
  if (socket && socket.connected) {
    socket.emit('leave_ranked_queue');
  }
  dom.rankedQueueOverlay.style.display = 'none';
});

// --- Set Ranked Number ---
dom.rankedSetNumberBtn.addEventListener('click', () => {
  const num = parseInt(dom.rankedSetNumberInput.value);
  if (!num || num < 1 || num > 100) {
    showToast('กรุณาใส่เลขระหว่าง 1-100', 'error');
    dom.rankedSetNumberInput.focus();
    return;
  }
  if (!state.rankedMatchId) {
    showToast('ไม่พบแมตช์', 'error');
    return;
  }
  socket.emit('set_ranked_number', { matchId: state.rankedMatchId, number: num });
});

dom.rankedSetNumberInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.rankedSetNumberBtn.click();
});

// --- Make Ranked Guess ---
dom.rankedGuessBtn.addEventListener('click', () => {
  makeRankedGuess();
});

dom.rankedGuessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') makeRankedGuess();
});

function makeRankedGuess() {
  const guess = parseInt(dom.rankedGuessInput.value);
  if (!guess || guess < 1 || guess > 100) {
    showToast('กรุณาใส่เลขระหว่าง 1-100', 'error');
    dom.rankedGuessInput.focus();
    return;
  }
  if (!state.rankedMatchId) {
    showToast('ไม่ได้อยู่ในแมตช์', 'error');
    return;
  }
  if (state.rankedRemainingGuesses <= 0) {
    showToast('❌ ใช้โอกาสทายหมดแล้ว!', 'error');
    return;
  }
  
  socket.emit('ranked_guess', { matchId: state.rankedMatchId, guess: guess });
  dom.rankedGuessInput.value = '';
  dom.rankedGuessInput.focus();
}

// --- Leave Ranked Match ---
dom.rankedLeaveBtn.addEventListener('click', () => {
  if (state.rankedMatchId && socket && socket.connected) {
    socket.emit('leave_game', { gameId: state.rankedMatchId });
  }
  resetRankedState();
  showScreen('ranked-lobby-screen');
  if (socket && socket.connected) {
    socket.emit('get_rank_info', { username: state.username });
  }
});

// --- Ranked Back to Lobby ---
dom.rankedBackToLobbyBtn.addEventListener('click', () => {
  resetRankedState();
  showScreen('ranked-lobby-screen');
  if (socket && socket.connected) {
    socket.emit('get_rank_info', { username: state.username });
  }
});

// --- Ranked Play Again ---
dom.rankedPlayAgainBtn.addEventListener('click', () => {
  resetRankedState();
  if (!state.rankedMyRank) {
    socket.emit('get_rank_info', { username: state.username });
  }
  socket.emit('join_ranked_queue', { username: state.username });
});

// Override leave_game to also handle ranked
const originalLeaveGame = socket?.emit ? true : false;

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

function renderRankedLeaderboard(data) {
  const container = dom.rankedLeaderboardContainer;
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏆</div>
        <p>ยังไม่มีข้อมูล</p>
        <p class="empty-sub">เล่นแมตช์จัดอันดับเพื่อเริ่มต้น</p>
      </div>
    `;
    return;
  }
  
  const medals = ['🥇', '🥈', '🥉'];
  const rankOrder = ['F','E','D','C','B','A'];
  
  container.innerHTML = data.slice(0, 50).map((entry, index) => {
    const rank = index + 1;
    let topClass = '';
    let rankDisplay = rank;
    
    if (rank === 1) topClass = 'top-1';
    else if (rank === 2) topClass = 'top-2';
    else if (rank === 3) topClass = 'top-3';
    
    if (rank <= 3) rankDisplay = medals[rank - 1];
    
    const isMe = entry.username === state.username;
    const tierIndex = rankOrder.indexOf(entry.rank);
    const starText = '⭐'.repeat(entry.stars || 0);
    
    return `
      <div class="leaderboard-item ${topClass}">
        <span class="leaderboard-rank">${rankDisplay}</span>
        <span class="leaderboard-name">${entry.username} ${isMe ? '(คุณ)' : ''}</span>
        <span class="leaderboard-wins" style="display:flex;align-items:center;gap:4px">
          ${starText}<span style="font-size:10px;opacity:0.6">${entry.rank}</span>
        </span>
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
