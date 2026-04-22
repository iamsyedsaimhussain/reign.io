// Button and Modal Event Handlers
function setupUIListeners() {
    document.getElementById("btn-roll").onclick = () => sendAction("ROLL");
    document.getElementById("btn-end-turn").onclick = () => sendAction("END_TURN");
    document.getElementById("btn-buy").onclick = () => sendAction("BUY");
    document.getElementById("btn-auction").onclick = () => sendAction("AUCTION");
    document.getElementById("btn-jail-fine").onclick = () => sendAction("JAIL_FINE");
    
    document.getElementById("btn-bid-1").onclick = () => placeQuickBid(1);
    document.getElementById("btn-bid-2").onclick = () => placeQuickBid(2);
    document.getElementById("btn-bid-3").onclick = () => placeQuickBid(3);

    document.getElementById("btn-copy-lobby-code").onclick = () => {
        const code = document.getElementById("lobby-room-code").innerText;
        if (!code || code === "####") return;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById("btn-copy-lobby-code");
            const original = btn.innerHTML;
            btn.innerHTML = '<span style="font-size:10px; color:#10b981; font-weight:bold;">COPIED!</span>';
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        });
    };

    document.getElementById("btn-copy-code").onclick = () => {
        const code = document.getElementById("room-code-display").innerText;
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById("btn-copy-code");
            const original = btn.innerHTML;
            btn.innerHTML = '<span style="font-size:10px; color:#10b981; font-weight:bold;">COPIED!</span>';
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        });
    };
    
    // FIX 9: New Game button — host resets, all clients return to lobby
    const btnVictoryClose = document.getElementById("btn-victory-close");
    if (btnVictoryClose) {
        btnVictoryClose.onclick = () => {
            if (window.isHost) {
                socket.emit("reset_game", { roomCode: window.currentRoomCode });
            } else {
                btnVictoryClose.innerText = "Waiting for host...";
                btnVictoryClose.disabled = true;
                btnVictoryClose.style.opacity = "0.5";
            }
        };
    }

    // FIX 6: Popup Duplicate Prevention using a session Set
    window.reignShownPopups = window.reignShownPopups || new Set();

    document.getElementById("btn-open-rules").onclick = () => {
        if (window.reignShownPopups.has("rules")) return; // Already shown this session - suppress
        window.reignShownPopups.add("rules");
        document.getElementById("overlay-container").classList.remove("hidden");
        document.getElementById("rules-modal").classList.remove("hidden");
    };
    
    document.getElementById("btn-open-trade").onclick = () => openTradeSetup();
    document.getElementById("btn-trade-send").onclick = sendTradeOffer;
    document.getElementById("btn-trade-cancel-1").onclick = closeModals;
    document.getElementById("btn-trade-back").onclick = () => {
        document.getElementById("trade-step-1").classList.remove("hidden");
        document.getElementById("trade-step-2").classList.add("hidden");
    };

    document.getElementById("btn-bankrupt").onclick = () => {
        document.getElementById("overlay-container").classList.remove("hidden");
        document.getElementById("bankrupt-modal").classList.remove("hidden");
        document.getElementById("bankrupt-player-name").innerText = "Declare Bankruptcy?";
        
        // Hide tap hint for bankruptcy check
        const tapHint = document.querySelector(".tap-hint");
        if (tapHint) tapHint.style.visibility = "hidden";
    };
    
    document.getElementById("btn-bankrupt-confirm").onclick = () => {
        sendAction("BANKRUPTCY");
        closeModals();
    };
    
    document.getElementById("btn-bankrupt-cancel").onclick = closeModals;

    // Card/Chance Modal
    document.getElementById("btn-card-close").onclick = () => {
        sendAction("RESOLVE_CARD");
        closeModals();
    };

    // Chat Input Handler
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
        chatInput.onkeydown = (e) => {
            if (e.key === "Enter") {
                const text = chatInput.value.trim();
                if (text && window.socket && window.currentRoomCode) {
                    window.socket.emit("send_chat", {
                        roomCode: window.currentRoomCode,
                        uniqueId: window.myUniqueId,
                        text: text
                    });
                    chatInput.value = "";
                }
            }
        };
    }

    // Overlay click-to-close
    document.getElementById("overlay-container").onclick = (e) => {
        const isAuctionVisible = !document.getElementById("auction-modal").classList.contains("hidden");
        const isTradeVisible = !document.getElementById("trade-modal").classList.contains("hidden");
        const isBankruptVisible = !document.getElementById("bankrupt-modal").classList.contains("hidden");
        
        // Critical modals stay open until specific action
        if (isAuctionVisible || isTradeVisible || isBankruptVisible) {
            if (e.target.id === "overlay-container") {
                // Clicking background doesn't close these high-stakes modals
            }
            return;
        }

        // Simple modals (Cards, Rules, Property Info) close on ANY tap on the overlay screen
        if (gameState.activeCard) {
            sendAction("RESOLVE_CARD");
        }
        closeModals();
    };
}

function closeModals() {
    if (cardTimer) clearTimeout(cardTimer);
    if (cardTick) clearInterval(cardTick);

    // Inform server we stopped viewing if it was a trade
    if (window.currentlyViewingTradeId) {
        sendAction("TRADE_CLOSE", { tradeId: window.currentlyViewingTradeId });
        window.currentlyViewingTradeId = null;
    }

    const dOverlay = document.getElementById("overlay-container");
    dOverlay.classList.add("hidden");
    dOverlay.classList.remove("transparent-overlay");

    document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
    
    const dCard = document.getElementById("card-popup");
    if (dCard) dCard.classList.add("hidden");

    const tapHint = document.querySelector(".tap-hint");
    if (tapHint) tapHint.style.visibility = "visible";
}

function openPropertyInfo(index) {
    const tile = gameState.boardData[index];
    if (!tile) return;

    window.currentPropertySelected = tile;
    document.getElementById("pi-name").innerText = tile.name;
    document.getElementById("pi-banner").style.backgroundColor = getActualColor(tile.color);
    
    // Populate Rent Table
    const table = document.getElementById("pi-rent-table");
    table.innerHTML = "";
    if (tile.rent && tile.rent.length > 0) {
        const labels = ["Rent", "with 1 🏠", "with 2 🏠", "with 3 🏠", "with 4 🏠", "with 🏨"];
        tile.rent.forEach((val, i) => {
            const row = document.createElement("div");
            row.className = "rent-row";
            row.innerHTML = `<span>${labels[i]}</span> <span>$${val}</span>`;
            table.appendChild(row);
        });
    }

    // Footer prices
    document.getElementById("pi-price").innerText = `$${tile.price || 0}`;
    document.getElementById("pi-house").innerText = `$${tile.houseCost || 0}`;
    document.getElementById("pi-hotel").innerText = `$${tile.houseCost || 0}`;

    const dPiOwner = document.getElementById("pi-owner");
    const ownerId = tile.owner;
    if (ownerId !== null && ownerId !== undefined) {
        const owner = gameState.players.find(p => p.id === ownerId);
        dPiOwner.innerText = `Owner: ${owner ? owner.name : 'Unknown'}`;
    } else {
        dPiOwner.innerText = "Owner: None";
    }

    // Show management buttons ONLY if I am the owner
    const me = gameState.players.find(p => p.uniqueId === window.myUniqueId);
    const isOwner = (me && me.id === ownerId);
    
    // Building Logic
    const isProperty = tile.type === "property";
    const houses = tile.houses || 0;
    const sameColorTiles = gameState.boardData.filter(t => t.color === tile.color);
    const hasFullSet = isProperty && me && sameColorTiles.every(t => me.properties.includes(t.id));

    const btnBuild = document.getElementById("btn-pi-upgrade");
    const btnBuildAll = document.getElementById("btn-pi-build-all");

    btnBuild.style.display = (isOwner && hasFullSet && houses < 5 && !tile.mortgaged) ? "block" : "none";
    btnBuild.onclick = () => sendAction("BUILD", { tileId: tile.id });

    btnBuildAll.style.display = (isOwner && hasFullSet && houses < 5 && !tile.mortgaged) ? "block" : "none";
    btnBuildAll.onclick = () => sendAction("BUILD_ALL", { tileId: tile.id });
    
    document.getElementById("btn-pi-mortgage").style.display = isOwner && !tile.mortgaged && houses === 0 ? "block" : "none";
    document.getElementById("btn-pi-mortgage").onclick = () => sendAction("MORTGAGE", { tileId: tile.id });

    document.getElementById("btn-pi-unmortgage").style.display = isOwner && tile.mortgaged ? "block" : "none";
    document.getElementById("btn-pi-unmortgage").onclick = () => sendAction("UNMORTGAGE", { tileId: tile.id });

    document.getElementById("overlay-container").classList.remove("hidden");
    document.getElementById("property-info-modal").classList.remove("hidden");
}

let cardTimer = null;
let cardTick = null;

function renderCardPopupUI() {
    if (!gameState.activeCard) return;
    
    const dCard = document.getElementById("card-popup");
    const dDesc = document.getElementById("card-desc");
    const dOverlay = document.getElementById("overlay-container");

    dDesc.innerText = gameState.activeCard.text;
    
    // Gradient logic based on type
    dCard.classList.remove("surprise-bg", "treasure-bg");
    if (gameState.activeCard.isChance) {
        dCard.classList.add("surprise-bg");
    } else {
        dCard.classList.add("treasure-bg");
    }

    dOverlay.classList.remove("hidden");
    dOverlay.classList.add("transparent-overlay");
    dCard.classList.remove("hidden");

    // Hide tap hint for cards
    const tapHint = document.querySelector(".tap-hint");
    if (tapHint) tapHint.style.visibility = "hidden";

    // Clear existing
    if (cardTimer) clearTimeout(cardTimer);
    if (cardTick) clearInterval(cardTick);

    // Autoclose after 8 seconds (give more time for long text)
    cardTimer = setTimeout(() => {
        sendAction("RESOLVE_CARD");
        closeModals();
    }, 8000);
}

function restartGame() {
    if (window.isHost) {
        window.socket.emit('reset_game', { roomCode: window.currentRoomCode });
        closeModals();
    } else {
        alert("Only the host can restart the game.");
    }
}

window.setupUIListeners = setupUIListeners;
window.closeModals = closeModals;
window.openPropertyInfo = openPropertyInfo;
window.renderCardPopupUI = renderCardPopupUI;
window.restartGame = restartGame;
