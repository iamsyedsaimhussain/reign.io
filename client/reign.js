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
        if (window.socket && window.currentRoomCode) {
            window.socket.emit('leave_room', { roomCode: window.currentRoomCode, uniqueId: window.myUniqueId });
        }
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
        const displayName = p.name ? p.name : "<i style='color:#666'>Choosing profile...</i>";
        const displayColor = p.color ? p.color : "#333";
        row.innerHTML = `<div class="lobby-p-dot" style="background:${displayColor}"></div> ${displayName}${isMe ? ' <span style="font-size:0.75rem; color:var(--accent); font-weight:bold;">(YOU)</span>' : ''}`;
        list.appendChild(row);
    });
    const validPlayersCount = lobbyPlayers.filter(p => p.name).length;
    document.getElementById("lobby-player-count").innerText = `${validPlayersCount}/${maxPlayersCap} Ready`;
    
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
    
    // Initialize displayLog if it doesn't exist
    if (!window.gameState.displayLog) window.gameState.displayLog = [];
    
    // 1. Sync State
    const oldPlayerData = {};
    const oldActiveCard = window.gameState.activeCard;
    if (window.gameState.players) {
        window.gameState.players.forEach(p => { 
            oldPlayerData[p.id] = { 
                position: p.position, 
                inJail: p.inJail, 
                color: p.color, 
                bankrupt: p.bankrupt,
                money: p.money
            }; 
        });
    }

    const oldBoardOwners = (window.gameState.boardData || []).map(t => t.owner);
    const oldBoardHouses = (window.gameState.boardData || []).map(t => t.houses || 0);

    Object.assign(window.gameState, newState);
    
    // Process new system logs
    const serverLogs = window.gameState.log || [];
    const lastCount = window.gameState.lastSysLogCount || 0;
    
    if (serverLogs.length > lastCount) {
        // Append new system logs
        for (let i = lastCount; i < serverLogs.length; i++) {
            window.gameState.displayLog.push(serverLogs[i]);
        }
    } else if (serverLogs.length < lastCount || serverLogs.length === 0) {
        // Log was reset (e.g., new game)
        window.gameState.displayLog = [...serverLogs];
    }
    window.gameState.lastSysLogCount = serverLogs.length;

    // Handle Screen Persistence (Main Menu -> Profile -> Game)
    handleGamePersistence();

    if (!gameState.started) {
        updateLobbyUI();
        updateColorPalette();
        return;
    }

    // 2. State Prep: Identify movements and set animating status BEFORE initial render
    const animationsToStart = [];
    const shakesToTrigger = [];
    if (window.gameState.players) {
        const currentIds = window.gameState.players.map(p => p.id);
        
        // Detect Removals
        Object.keys(oldPlayerData).forEach(oldId => {
            const id = parseInt(oldId);
            if (!currentIds.includes(id)) {
                const oldP = oldPlayerData[oldId];
                if (window.triggerDespawn) {
                    window.triggerDespawn({ id: id, color: oldP.color, position: oldP.position });
                }
            }
        });

        window.gameState.players.forEach(p => {
            const old = oldPlayerData[p.id];
            if (old) {
                if (p.position !== old.position) {
                    const isJailTeleport = (p.position === 10 && p.inJail && !old.inJail);
                    const isCardTeleport = (oldActiveCard !== null && window.gameState.activeCard === null);
                    const isTeleport = isJailTeleport || isCardTeleport;

                    // Set status before renderBoard
                    if (window.animatingPlayers) {
                        window.animatingPlayers[p.id] = old.position;
                    }
                    animationsToStart.push({ id: p.id, from: old.position, to: p.position, isTeleport });
                }

                if (p.bankrupt && !old.bankrupt) {
                    if (window.triggerDespawn) {
                        window.triggerDespawn({ id: p.id, color: p.color, position: p.position });
                    }
                }

                if (p.money !== old.money) {
                    const isMe = (p.uniqueId === window.myUniqueId);
                    if (isMe && p.money > old.money) {
                        playSound("money");
                    }
                    if (p.money < old.money) {
                        shakesToTrigger.push(p.id);
                    }
                }
            }
        });
    }

    // Detect Property Purchases & Building (Global)
    if (window.gameState.boardData) {
        window.gameState.boardData.forEach((tile, idx) => {
            const oldOwner = oldBoardOwners[idx];
            const oldHouses = oldBoardHouses[idx];
            
            const ownerGained = (tile.owner !== null && tile.owner !== undefined && oldOwner === null);
            const houseGained = (tile.houses > oldHouses);

            if (ownerGained || houseGained) {
                playSound("property brought");
            }
        });
    }

    // 3. Render Fresh State
    renderBoard();
    updatePlayersUI();
    renderUIControls();
    renderStateLog();
    updateTradeSidebar();
    checkTradeInvalidation();

    // 4. Trigger collected shakes on fresh DOM (Tokens on board)
    shakesToTrigger.forEach(pid => {
        if (window.triggerTokenShake) {
            window.triggerTokenShake(pid);
        }
    });

    // 5. Fire off animations on the freshly rendered board
    animationsToStart.forEach(anim => {
        if (window.animateMovement) {
            window.animateMovement(anim.id, anim.from, anim.to, anim.isTeleport, false);
        }
    });

    // FIX 9: Premium Victory Screen (standalone, not inside overlay-container)
    if (gameState.winner) {
        const dVictory = document.getElementById("victory-modal");
        if (dVictory && dVictory.classList.contains("hidden")) {
            playSound("fanfare");
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
