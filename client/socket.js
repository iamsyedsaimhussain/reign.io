// Networking layer for Reign.io
const socket = (typeof io !== 'undefined') ? io({ query: { uniqueId: sessionStorage.getItem('reign_uid') } }) : null;

function sendAction(action, payload = {}) {
    if (!socket || !currentRoomCode) return;
    socket.emit('client_action', {
        roomCode: currentRoomCode,
        uniqueId: myUniqueId,
        action: action,
        payload: payload
    });
}

if (socket) {
    socket.on('room_created', (data) => {
        const code = (typeof data === 'string') ? data : data.roomCode;
        window.currentRoomCode = code;
        window.isHost = true;
        sessionStorage.setItem('reign_room_code', code);
        document.getElementById("lobby-room-code").innerText = code;
        document.getElementById("room-code-display").innerText = code;
        openProfileSetup();
    });

    socket.on('room_joined', (data) => {
        const roomCode = (typeof data === 'string') ? data : data.roomCode;
        const joinedAsHost = (typeof data === 'object') ? data.isHost : false;
        window.currentRoomCode = roomCode;
        window.isHost = joinedAsHost;
        sessionStorage.setItem('reign_room_code', roomCode);
        document.getElementById("lobby-room-code").innerText = roomCode;
        document.getElementById("room-code-display").innerText = roomCode;
        
        // Hide sub-menus but KEEP start-screen visible (since profile/lobby are inside it)
        document.getElementById("main-menu").classList.add("hidden");
        document.getElementById("join-container").classList.add("hidden");
        document.getElementById("host-settings").classList.add("hidden");
        
        // Force Profile Setup to be visible now that we are in a room
        document.getElementById("profile-setup").classList.remove("hidden");

        const playersList = data.players || [];
        const me = playersList.find(p => p.uniqueId === window.myUniqueId);
        const gameAlreadyStarted = (data.serverState && data.serverState.started) || data.gameStarted;

        // Smart Redirect
        if (me && me.name) {
            // If already set up, we can hide profile and show lobby/game
            document.getElementById("profile-setup").classList.add("hidden");
            if (gameAlreadyStarted) {
                document.getElementById("start-screen").classList.add("hidden");
                document.getElementById("game-ui").classList.remove("hidden");
            } else {
                document.getElementById("waiting-room").classList.remove("hidden");
            }
        } else {
            // Not set up? Make sure we are in the profile view
            if (gameAlreadyStarted) {
                document.getElementById("start-screen").classList.add("hidden");
                document.getElementById("game-ui").classList.remove("hidden");
            } else {
                openProfileSetup(); // This will trigger initColorPalette
            }
        }
    });

    socket.on('lobby_update', (data) => {
        window.lobbyPlayers = data.players || [];
        window.maxPlayersCap = data.maxPlayers || 4;
        
        // Update local profile if server sent it
        const me = (window.lobbyPlayers || []).find(p => p.uniqueId === window.myUniqueId);
        if (me && me.name) {
            myProfile.name = me.name;
            myProfile.color = me.color;
        }
        
        updateClientUI({}); 
    });

    socket.on('game_start_confirmed', (data) => {
        // First state arrival
        updateClientUI(data.state || data);
    });

    socket.on('state_update', (newState) => {
        const oldMoney = {};
        if (gameState.players) {
            gameState.players.forEach(p => { oldMoney[p.id] = p.money; });
        }

        // TRIGGER CENTRAL PIPELINE
        updateClientUI(newState);

        // Money Animations (Post-Render)
        if (gameState.players) {
            gameState.players.forEach(p => {
                if (oldMoney[p.id] !== undefined && p.money !== oldMoney[p.id]) {
                    animateMoneyDelta(p.id, p.money - oldMoney[p.id]);
                }
            });
        }
    });

    socket.on('dice_anim', (data) => {
        const diceEle = [document.getElementById("die1"), document.getElementById("die2")];
        if (!diceEle[0] || !diceEle[1]) return;
        const { t0, t1 } = data;
        diceEle[0].style.transition = 'none';
        diceEle[1].style.transition = 'none';
        diceEle[0].style.transform = 'rotateX(720deg) rotateY(360deg) rotateZ(180deg)';
        diceEle[1].style.transform = 'rotateX(360deg) rotateY(720deg) rotateZ(-180deg)';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                diceEle[0].style.transition = '';
                diceEle[1].style.transition = '';
                diceEle[0].style.transform = t0;
                diceEle[1].style.transform = t1;
            });
        });
    });

    socket.on('chat_received', (data) => {
        gameState.log.push({ type: 'chat', name: data.name, color: data.color, text: data.text });
        if (gameState.log.length > 100) gameState.log.shift();
        renderStateLog();
    });

    socket.on('game_reset', () => {
        // Hide premium victory modal
        const dVictory = document.getElementById("victory-modal");
        if (dVictory) dVictory.classList.add("hidden");
        
        // Reset btn state in case non-host was waiting
        const btnVictoryClose = document.getElementById("btn-victory-close");
        if (btnVictoryClose) {
            btnVictoryClose.innerText = "New Game";
            btnVictoryClose.disabled = false;
            btnVictoryClose.style.opacity = "1";
        }

        // Clear game state
        if (window.gameState) {
            window.gameState.started = false;
            window.gameState.winner = null;
            window.gameState.auction = null;
            window.gameState.activeCard = null;
            window.gameState.pendingTrades = [];
            window.gameState.players = [];
        }

        // Restore screen layout: hide game, show waiting room
        document.getElementById("game-ui").classList.add("hidden");
        document.getElementById("start-screen").classList.remove("hidden");
        document.getElementById("waiting-room").classList.remove("hidden");
        document.getElementById("profile-setup").classList.add("hidden");
        document.getElementById("main-menu").classList.add("hidden");
        document.getElementById("join-container").classList.add("hidden");
        document.getElementById("host-settings").classList.add("hidden");
        closeModals();
        if (typeof updateLobbyUI === 'function') updateLobbyUI();
    });

    socket.on('error_message', (msg) => { 
        console.error("Server Error:", msg);
        // Optionally show as an in-game notification later, but NO MORE ALERTS
    });

    socket.on('host_disconnected', () => {
        // Silently reload to main menu instead of annoying alert
        location.reload();
    });
}

window.socket = socket;
window.sendAction = sendAction;
