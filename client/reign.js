/**
 * Reign.io | Thin Client Controller
 * Purpose: Manage global state and orchestrate modular UI/Network layers.
 * Game logic is strictly Server-Authoritative.
 */

// Global State
window.gameState = {
    players: [],
    currentPlayerIndex: 0,
    boardData: [],
    taxHeavenPot: 0,
    started: false,
    settings: { auctions: true, evenBuild: true },
    auction: null,
    trade: null,
    pendingTrades: [],
    activeCard: null,
    log: [],
    chats: []
};

window.currentRoomCode = null;
window.isHost = false;
window.myProfile = { name: "", color: "" };
window.lobbyPlayers = [];
window.maxPlayersCap = 4;

// Persistent Unique ID for Session Recovery
window.myUniqueId = sessionStorage.getItem('reign_uid');
if (!myUniqueId) {
    myUniqueId = 'u_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('reign_uid', myUniqueId);
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupUIListeners();
    attemptAutoReconnect();
});

function attemptAutoReconnect() {
    const savedCode = sessionStorage.getItem('reign_room_code');
    if (savedCode && window.socket) {
        console.log("Attempting auto-reconnect to:", savedCode);
        window.socket.emit('join_room', { roomCode: savedCode, uniqueId: myUniqueId });
    }
}

function setupNavigation() {
    const dMainMenu = document.getElementById("main-menu");
    const dHostSettings = document.getElementById("host-settings");
    const dJoinContainer = document.getElementById("join-container");
    const dProfileSetup = document.getElementById("profile-setup");
    
    document.getElementById("btn-host-match").onclick = () => {
        dMainMenu.classList.add("hidden");
        dHostSettings.classList.remove("hidden");
    };

    document.getElementById("btn-join-match").onclick = () => {
        dMainMenu.classList.add("hidden");
        dJoinContainer.classList.remove("hidden");
    };

    document.getElementById("btn-join-enter").onclick = () => {
        const code = document.getElementById("join-code-input").value.trim().toUpperCase();
        if (code && window.socket) {
            window.socket.emit('join_room', { roomCode: code, uniqueId: myUniqueId });
        }
    };

    document.querySelectorAll(".btn-back").forEach(btn => {
        btn.onclick = () => {
            dHostSettings.classList.add("hidden");
            dJoinContainer.classList.add("hidden");
            dMainMenu.classList.remove("hidden");
        };
    });

    document.getElementById("btn-lobby-start").onclick = () => {
        if (lobbyPlayers.length < 2) {
            return alert("Wait for at least 2 players to join!");
        }
        const boardType = document.getElementById("board-edition").value;
        const startCash = parseInt(document.getElementById("starting-cash").value);
        if (window.socket) {
            window.socket.emit('start_game', {
                roomCode: currentRoomCode,
                settings: {
                    boardType,
                    startCash,
                    auctions: document.getElementById("rule-auctions").checked,
                    evenBuild: document.getElementById("rule-evenbuild").checked
                }
            });
        }
    };

    document.getElementById("btn-start-game").onclick = () => {
        const count = parseInt(document.getElementById("player-count").value);
        if (window.socket) {
            window.socket.emit('create_room', { maxPlayers: count, uniqueId: myUniqueId });
        }
    };

    document.getElementById("btn-profile-ready").onclick = () => {
        const name = document.getElementById("player-name-input").value.trim();
        if (!name || !myProfile.color) return alert("Select name and color.");
        myProfile.name = name;
        if (window.socket) {
            window.socket.emit('update_profile', { roomCode: currentRoomCode, name: name, color: myProfile.color });
        }
        dProfileSetup.classList.add("hidden");
        if (!gameState.started) {
            document.getElementById("waiting-room").classList.remove("hidden");
        }
    };

    document.getElementById("btn-profile-back").onclick = () => {
        dProfileSetup.classList.add("hidden");
        dMainMenu.classList.remove("hidden");
        // Clear room code so auto-reconnect doesn't jump us back in
        sessionStorage.removeItem('reign_room_code');
        window.currentRoomCode = null;
    };

    document.getElementById("btn-lobby-leave").onclick = () => {
        location.reload();
    };
}

const DEFAULT_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function openProfileSetup() {
    const screens = ["join-container", "host-settings", "main-menu", "waiting-room", "game-ui"];
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add("hidden");
    });
    
    document.getElementById("profile-setup").classList.remove("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
    initColorPalette();
}

function initColorPalette() {
    const palette = document.getElementById("color-palette");
    if (!palette) return;
    
    // Safety Fallback: Use window.colors or local constants
    const list = (window.colors && window.colors.length > 0) ? window.colors : DEFAULT_COLORS;
    
    // IF we already have color circles in the DOM, and our list is empty, don't touch it!
    if (palette.children.length > 0 && (!list || list.length === 0)) return;

    palette.innerHTML = "";
    list.forEach(color => {
        const div = document.createElement("div");
        div.className = "color-choice";
        div.style.backgroundColor = color;
        div.dataset.color = color;
        div.onclick = () => {
            window.myProfile.color = color;
            updateColorPalette();
        };
        palette.appendChild(div);
    });
    updateColorPalette();
}

function updateColorPalette() {
    const p1 = (window.lobbyPlayers || []).map(p => p.color);
    const p2 = (window.gameState && window.gameState.players) ? window.gameState.players.map(p => p.color) : [];
    const picked = [...p1, ...p2];
    
    document.querySelectorAll(".color-choice").forEach(div => {
        const color = div.dataset.color;
        div.classList.toggle("selected", window.myProfile.color === color);
        div.classList.toggle("locked", picked.includes(color) && window.myProfile.color !== color);
    });
}

function updateLobbyUI() {
    const list = document.getElementById("lobby-list");
    list.innerHTML = "";
    lobbyPlayers.forEach(p => {
        const row = document.createElement("div");
        row.className = "lobby-player-row";
        const isMe = p.uniqueId === myUniqueId;
        row.innerHTML = `<div class="lobby-p-dot" style="background:${p.color}"></div> ${p.name}${isMe ? ' <span style="font-size:0.75rem; color:var(--accent); font-weight:bold;">(YOU)</span>' : ''}`;
        list.appendChild(row);
    });
    document.getElementById("lobby-player-count").innerText = `${lobbyPlayers.length}/${maxPlayersCap}`;
    
    const startBtn = document.getElementById("btn-lobby-start");
    const waitMsg = document.getElementById("lobby-wait-msg");
    
    if (isHost) {
        startBtn.classList.remove("hidden");
        waitMsg.classList.add("hidden");
    } else {
        startBtn.classList.add("hidden");
        waitMsg.classList.remove("hidden");
    }
}

// Unified Update Pipeline (Central Entry Point)
function updateClientUI(newState) {
    if (!newState) return;
    
    // Preserve local chats
    const oldChats = window.gameState.chats || [];
    
    // 1. Sync State
    Object.assign(window.gameState, newState);
    
    // Restore local chats
    window.gameState.chats = oldChats;

    // Add timestamps to new system logs if they don't have them
    if (window.gameState.log) {
        window.gameState.log.forEach(msg => {
            if (!msg.time) msg.time = Date.now();
        });
    }

    // Handle Screen Persistence (Main Menu -> Profile -> Game)
    handleGamePersistence();

    if (!gameState.started) {
        updateLobbyUI();
        updateColorPalette();
        return;
    }

    // 3. Render Game Visuals
    renderBoard();
    updatePlayersUI();
    renderUIControls();
    renderStateLog();
    updateTradeSidebar();
    checkTradeInvalidation();

    // FIX 9: Premium Victory Screen (standalone, not inside overlay-container)
    if (gameState.winner) {
        const dVictory = document.getElementById("victory-modal");
        if (dVictory && dVictory.classList.contains("hidden")) {
            dVictory.classList.remove("hidden");
            document.getElementById("winner-name-display").innerText = gameState.winner.name;
            document.getElementById("win-wealth").innerText = `$${gameState.winner.money}`;
            document.getElementById("win-props").innerText = gameState.winner.properties ? gameState.winner.properties.length : 0;
        }
        return; // Stop further updates once game ends
    }

    const dGame = document.getElementById("game-ui");
    const isGameVisible = dGame && !dGame.classList.contains("hidden");

    if (gameState.auction && isGameVisible) {
        openAuctionModalUI();
        updateAuctionUI();
    } else {
        const aucModal = document.getElementById("auction-modal");
        if (aucModal && !aucModal.classList.contains("hidden")) {
            closeModals(); // Only close down the UI if we just finished an auction
        }
    }

    if (gameState.activeCard && isGameVisible) {
        const dCard = document.getElementById("card-popup");
        if (dCard && dCard.classList.contains("hidden")) {
            renderCardPopupUI();
        }
    } else {
        const dCard = document.getElementById("card-popup");
        if (dCard && !dCard.classList.contains("hidden")) {
            closeModals();
        }
    }
}

function handleGamePersistence() {
    const dStart = document.getElementById("start-screen");
    const dWaiting = document.getElementById("waiting-room");
    const dProfile = document.getElementById("profile-setup");
    const dGame = document.getElementById("game-ui");

    const isInSetup = !dProfile.classList.contains("hidden") || 
                     !document.getElementById("join-container").classList.contains("hidden") || 
                     !document.getElementById("host-settings").classList.contains("hidden");

    const me = gameState.players && gameState.players.find(p => p.uniqueId === window.myUniqueId);

    // Hard Wall: Only transition them into dGame forcefully if they are an officially registered player!
    if (gameState.started && me && dGame.classList.contains("hidden")) {
        dStart.classList.add("hidden");
        dWaiting.classList.add("hidden");
        dProfile.classList.add("hidden");
        document.getElementById("join-container").classList.add("hidden");
        document.getElementById("host-settings").classList.add("hidden");
        dGame.classList.remove("hidden");
        
        if (!gameState.boardData || gameState.boardData.length === 0) {
            gameState.boardData = (gameState.settings.boardType === "nyc") ? nycBoard : classicBoard;
        }
    } 
    // Return to Lobby Logic: if game ends/resets and we're still on game screen
    else if (!gameState.started && !dGame.classList.contains("hidden")) {
        dGame.classList.add("hidden");
        dWaiting.classList.remove("hidden");
        closeModals();
    }
}

window.updateClientUI = updateClientUI;
window.openProfileSetup = openProfileSetup;
window.updateColorPalette = updateColorPalette;
window.updateLobbyUI = updateLobbyUI;
