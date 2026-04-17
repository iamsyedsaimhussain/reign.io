// Trade UI Logic - Lazy getters for DOM elements
const getTradeModal      = () => document.getElementById("trade-modal");
const getTradeStep1      = () => document.getElementById("trade-step-1");
const getTradeStep2      = () => document.getElementById("trade-step-2");
const getTradePlayerList = () => document.getElementById("trade-player-list");
const getTradeMyProps    = () => document.getElementById("trade-my-props");
const getTradeTheirProps = () => document.getElementById("trade-their-props");
const getTradeTargetName = () => document.getElementById("trade-target-name");
const getTradeIncModal   = () => document.getElementById("trade-incoming-modal");
const getTradeOutModal   = () => document.getElementById("trade-outgoing-modal");

let tradeTargetPlayerId = null;

function updateTradeSidebar() {
    const dPendingList = document.getElementById("pending-trades-list");
    const dNoMsg = document.getElementById("no-trades-msg");
    if (!dPendingList) return;
    dPendingList.innerHTML = "";
    
    const allTrades = gameState.pendingTrades || [];
    const relevant = allTrades.filter(t => t.targetUniqueId === window.myUniqueId || t.senderUniqueId === window.myUniqueId);
    
    if (relevant.length > 0) {
        if (dNoMsg) dNoMsg.style.display = "none";
        relevant.forEach((trade) => {
            const isIncoming = (trade.targetUniqueId === window.myUniqueId);
            const container = document.createElement("div");
            container.className = "trade-sidebar-item";
            container.style.display = "flex";
            container.style.justifyContent = "space-between";
            container.style.alignItems = "center";
            container.style.marginBottom = "8px";

            const btn = document.createElement("button");
            btn.className = "trade-item-btn";
            btn.style.flexGrow = "1";
            btn.style.marginRight = "5px";
            
            if (isIncoming) {
                btn.innerText = `Offer from ${trade.senderName}`;
                btn.onclick = () => openIncomingTrade(trade);
            } else {
                const target = gameState.players.find(p => p.id === trade.toId);
                btn.innerText = `Offer to ${target ? target.name : 'Unknown'}`;
                btn.onclick = () => openOutgoingTrade(trade);
            }
            btn.style.position = "relative"; // Ensure relative positioned for absolute dot
            btn.style.display = "flex";
            btn.style.justifyContent = "center";
            btn.style.alignItems = "center";
            container.appendChild(btn);

            // Real-time Viewers indicator
            if (trade.viewers && trade.viewers.length > 0) {
                const vList = document.createElement("div");
                vList.className = "trade-viewers-container";
                trade.viewers.forEach(uid => {
                    if (uid === window.myUniqueId) return; // Don't show myself
                    const viewer = gameState.players.find(p => p.uniqueId === uid);
                    if (viewer) {
                        const dot = document.createElement("div");
                        dot.className = "viewer-dot-glow";
                        dot.style.background = viewer.color;
                        vList.appendChild(dot);
                    }
                });
                btn.appendChild(vList);
            }
            
            dPendingList.appendChild(container);
        });
    } else {
        if (dNoMsg) dNoMsg.style.display = "block";
    }
}

function openTradeSetup(targetId = null) {
    document.getElementById("overlay-container").classList.remove("hidden");
    getTradeModal().classList.remove("hidden");
    
    // Hide 'tap to close' hint for sticky trades
    const tapHint = document.querySelector(".tap-hint");
    if (tapHint) tapHint.style.visibility = "hidden";
    
    if (targetId !== null) {
        selectTradeTarget(targetId);
    } else {
        getTradeStep1().classList.remove("hidden");
        getTradeStep2().classList.add("hidden");
        renderTradePlayerList();
    }
}

function renderTradePlayerList() {
    const list = getTradePlayerList();
    list.innerHTML = "";
    const me = gameState.players.find(pl => pl.uniqueId === window.myUniqueId);
    gameState.players.forEach(p => {
        if (p.id !== me.id && !p.bankrupt) {
            const btn = document.createElement("button");
            btn.className = "trade-p-choice";
            btn.innerHTML = `<div class="p-dot" style="background:${p.color}"></div> ${p.name}`;
            btn.onclick = () => selectTradeTarget(p.id);
            list.appendChild(btn);
        }
    });
}

function selectTradeTarget(id) {
    tradeTargetPlayerId = id;
    const target = gameState.players.find(p => p.id === id);
    const me = gameState.players.find(p => p.uniqueId === window.myUniqueId);
    
    getTradeTargetName().innerText = target.name;
    getTradeStep1().classList.add("hidden");
    getTradeStep2().classList.remove("hidden");
    
    // Reset money inputs
    const myMoneyIn = document.getElementById("trade-my-money");
    const theirMoneyIn = document.getElementById("trade-their-money");
    const mySlider = document.getElementById("trade-my-range");
    const theirSlider = document.getElementById("trade-their-range");
    
    myMoneyIn.value = 0;
    theirMoneyIn.value = 0;
    mySlider.value = 0;
    theirSlider.value = 0;
    
    // Set slider maxes
    mySlider.max = me.money;
    theirSlider.max = target.money;
    
    // Setup slider listeners
    mySlider.oninput = () => { myMoneyIn.value = mySlider.value; };
    myMoneyIn.oninput = () => { mySlider.value = myMoneyIn.value; };
    theirSlider.oninput = () => { theirMoneyIn.value = theirSlider.value; };
    theirMoneyIn.oninput = () => { theirSlider.value = theirMoneyIn.value; };
    
    renderTradePropList('my', me);
    renderTradePropList('their', target);
}

function adjustTradeMoney(side, amount) {
    const input = document.getElementById(`trade-${side}-money`);
    const slider = document.getElementById(`trade-${side}-range`);
    let val = parseInt(input.value) || 0;
    val += amount;
    
    const max = parseInt(slider.max);
    if (val > max) val = max;
    
    input.value = val;
    slider.value = val;
}

function renderTradePropList(side, player) {
    const container = side === 'my' ? getTradeMyProps() : getTradeTheirProps();
    container.innerHTML = "";
    player.properties.forEach(pid => {
        const tile = gameState.boardData[pid];
        const item = document.createElement("div");
        item.className = "trade-prop-checkbox";
        item.style.borderLeft = `4px solid ${getActualColor(tile.color || "transparent")}`;
        item.innerHTML = `
            <input type="checkbox" id="trade-${side}-prop-${pid}" value="${pid}" style="cursor:pointer">
            <label for="trade-${side}-prop-${pid}" style="cursor:pointer; padding-left:5px;">${tile.name}</label>
        `;
        container.appendChild(item);
    });
}

function sendTradeOffer() {
    const target = gameState.players.find(p => p.id === tradeTargetPlayerId);
    const myMoney = parseInt(document.getElementById("trade-my-money").value) || 0;
    const theirMoney = parseInt(document.getElementById("trade-their-money").value) || 0;
    const myProps = Array.from(getTradeMyProps().querySelectorAll('input:checked')).map(i => parseInt(i.value));
    const theirProps = Array.from(getTradeTheirProps().querySelectorAll('input:checked')).map(i => parseInt(i.value));

    sendAction("TRADE_OFFER", {
        targetUniqueId: target.uniqueId,
        offerMoney: myMoney,
        wantMoney: theirMoney,
        offerProps: myProps,
        wantProps: theirProps
    });
    closeModals();
}

function openIncomingTrade(trade) {
    if (window.currentlyViewingTradeId) {
        sendAction("TRADE_CLOSE", { tradeId: window.currentlyViewingTradeId });
    }
    window.currentlyViewingTradeId = trade.id;
    sendAction("TRADE_OPEN", { tradeId: trade.id });

    document.getElementById("overlay-container").classList.remove("hidden");
    getTradeIncModal().classList.remove("hidden");
    document.getElementById("trade-inc-header").innerText = `Trade Offer from ${trade.senderName}`;
    
    // Detailed Offer
    const offerContent = document.getElementById("trade-inc-offer");
    const wantContent = document.getElementById("trade-inc-want");
    
    const propMap = (pids) => pids.map(id => {
        const tile = gameState.boardData[id];
        return `<div class="trade-prop-item" style="border-left:4px solid ${getActualColor(tile.color || 'transparent')}"><span>${tile.name}</span> ${typeof getBuildingHTML === 'function' ? getBuildingHTML(tile.houses) : ''}</div>`;
    }).join("");

    offerContent.innerHTML = `<div>$${trade.offerMoney}</div> ${propMap(trade.offerProps)}`;
    wantContent.innerHTML = `<div>$${trade.wantMoney}</div> ${propMap(trade.wantProps)}`;
    
    document.getElementById("btn-trade-accept").onclick = () => {
        sendAction("TRADE_ACCEPT", { tradeId: trade.id });
        closeModals();
    };

    // Disable Accept if the sender is currently away
    const sender = gameState.players.find(p => p.uniqueId === trade.senderUniqueId);
    const btnAccept = document.getElementById("btn-trade-accept");
    if (sender && sender.isDisconnected) {
        btnAccept.disabled = true;
        btnAccept.style.opacity = "0.4";
        btnAccept.style.pointerEvents = "none";
        btnAccept.title = "Player is currently away";
    } else {
        btnAccept.disabled = false;
        btnAccept.style.opacity = "1";
        btnAccept.style.pointerEvents = "auto";
        btnAccept.title = "";
    }

    document.getElementById("btn-trade-negotiate").onclick = () => {
        const sender = gameState.players.find(p => p.uniqueId === trade.senderUniqueId);
        if (sender) {
            // Cancel the old trade first directly as the receiver (Decline it)
            sendAction("TRADE_DECLINE", { tradeId: trade.id });
            closeModals();
            
            // Open setup with sender
            openTradeSetup(sender.id);
            
            // Pre-fill values mapping their offer to my wants, and my wants to my offer
            setTimeout(() => {
                adjustTradeMoney('my', trade.wantMoney);
                adjustTradeMoney('their', trade.offerMoney);
                
                trade.wantProps.forEach(pid => {
                    const cb = document.getElementById(`trade-my-prop-${pid}`);
                    if (cb) cb.checked = true;
                });
                trade.offerProps.forEach(pid => {
                    const cb = document.getElementById(`trade-their-prop-${pid}`);
                    if (cb) cb.checked = true;
                });
            }, 50);
        }
    };
    document.getElementById("btn-trade-decline").onclick = () => {
        sendAction("TRADE_DECLINE", { tradeId: trade.id });
        closeModals();
    };
}

function openOutgoingTrade(trade) {
    if (window.currentlyViewingTradeId) {
        sendAction("TRADE_CLOSE", { tradeId: window.currentlyViewingTradeId });
    }
    window.currentlyViewingTradeId = trade.id;
    sendAction("TRADE_OPEN", { tradeId: trade.id });

    document.getElementById("overlay-container").classList.remove("hidden");
    getTradeOutModal().classList.remove("hidden");
    
    const target = gameState.players.find(p => p.id === trade.toId);
    document.getElementById("trade-out-header").innerText = `Review Offer to ${target ? target.name : 'Unknown'}`;
    
    // Detailed Offer
    const offerContent = document.getElementById("trade-out-offer");
    const wantContent = document.getElementById("trade-out-want");
    
    const propMap = (pids) => pids.map(id => {
        const tile = gameState.boardData[id];
        return `<div class="trade-prop-item" style="border-left:4px solid ${getActualColor(tile.color || 'transparent')}"><span>${tile.name}</span> ${typeof getBuildingHTML === 'function' ? getBuildingHTML(tile.houses) : ''}</div>`;
    }).join("");

    offerContent.innerHTML = `<div>$${trade.offerMoney}</div> ${propMap(trade.offerProps)}`;
    wantContent.innerHTML = `<div>$${trade.wantMoney}</div> ${propMap(trade.wantProps)}`;
    
    document.getElementById("btn-trade-delete").onclick = () => {
        sendAction("TRADE_CANCEL", { tradeId: trade.id });
        closeModals();
    };
    
    document.getElementById("btn-trade-edit").onclick = () => {
        // Cancel the old trade first
        sendAction("TRADE_CANCEL", { tradeId: trade.id });
        closeModals();
        
        // Open setup with target
        openTradeSetup(trade.toId);
        
        // Pre-fill values
        setTimeout(() => {
            adjustTradeMoney('my', trade.offerMoney);
            adjustTradeMoney('their', trade.wantMoney);
            
            trade.offerProps.forEach(pid => {
                const cb = document.getElementById(`trade-my-prop-${pid}`);
                if (cb) cb.checked = true;
            });
            trade.wantProps.forEach(pid => {
                const cb = document.getElementById(`trade-their-prop-${pid}`);
                if (cb) cb.checked = true;
            });
        }, 50);
    };
}

function checkTradeInvalidation() {
    if (!window.currentlyViewingTradeId) return;
    
    const tradeExists = gameState.pendingTrades.some(t => t.id === window.currentlyViewingTradeId);
    if (!tradeExists) {
        // Find if any "trade" modal is open
        const inc = getTradeIncModal();
        const out = getTradeOutModal();
        
        if (!inc.classList.contains("hidden") || !out.classList.contains("hidden")) {
            // Show invalid message
            const msg = document.createElement("div");
            msg.className = "trade-invalid-notice";
            msg.innerText = "This trade is now invalid.";
            document.body.appendChild(msg);
            
            closeModals();
            
            setTimeout(() => { msg.remove(); }, 3000);
        }
    }
}

window.updateTradeSidebar = updateTradeSidebar;
window.openTradeSetup = openTradeSetup;
window.sendTradeOffer = sendTradeOffer;
window.adjustTradeMoney = adjustTradeMoney;
window.checkTradeInvalidation = checkTradeInvalidation;
