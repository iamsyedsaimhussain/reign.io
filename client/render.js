// Visual Engine for Reign.io
// All board positioning matches the CSS percentage system (cSize=14%, eSize=8%)
// Lazy getters — DOM may not exist at parse time, so we resolve on demand
const getBoard       = () => document.getElementById("board");
const getPlayersList = () => document.getElementById("players-list");
const getActivityLog = () => document.getElementById("chat-messages");

const ICON_MAP = {
    start:          "assets/start.png",
    chance:         "assets/surprise.png",
    community_chest:"assets/treasure.png",
    tax:            "assets/luxury tax (1).png",
    tax_heaven:     "assets/tax heaven.png",
    railroad:       "assets/airport (1).png",
};
const UTILITY_ICONS = {
    "Electric Company": "assets/electric company (1).png",
    "Water Company":    "assets/water company (1).png",
};

function tileTitle(name) {
    const words = name.trim().split(" ");
    const cls = words.length === 1 ? "title single-word" : "title multi-word";
    return `<div class="title-container"><span class="${cls}">${name}</span></div>`;
}

function getBuildingHTML(houses) {
    if (!houses || houses <= 0) return "";
    let html = '<div class="building-indicator">'; // Use the existing building-indicator css class
    if (houses < 5) {
        html += `<img src="assets/house.png" class="building-icon"><span>x ${houses}</span>`;
    } else {
        html += `<img src="assets/hotel.png" class="building-icon">`;
    }
    html += '</div>';
    return html;
}

function buildTileContent(tile) {
    const type = tile.type;
    let html = '<div class="tile-inner">';

    if (type === "jail") {
        html += `<div class="jail-container">
            <div class="jail-visiting"><span>Passing by</span></div>
            <div class="jail-prison"><span>In Prison</span></div>
        </div>`;
        html += '</div>';
        return html;
    }

    // Color bar for properties
    if (tile.color) {
        let barContent = getBuildingHTML(tile.houses);
        html += `<div class="tile-color-bar" style="background:${getActualColor(tile.color)}">${barContent}</div>`;
    }

    // Title
    html += tileTitle(tile.name);

    // Icon
    let iconSrc = ICON_MAP[type] || '';
    if (type === 'utility') iconSrc = UTILITY_ICONS[tile.name] || ICON_MAP['utility'] || '';
    let iconClass = 'tile-icon';
    if (type === 'chance') iconClass += ' icon-surprise';
    else if (type === 'utility') iconClass += ' icon-utility';
    else if (type === 'railroad') iconClass += ' icon-airport';
    else if (type === 'tax') iconClass += ' icon-tax';

    if (iconSrc) {
        html += `<div class="icon-container"><img src="${iconSrc}" class="${iconClass}" /></div>`;
    }

    // Tax Heaven: show the pot value on the tile itself
    if (type === 'tax_heaven') {
        const pot = (gameState && gameState.taxHeavenPot) ? gameState.taxHeavenPot : 0;
        if (pot > 0) {
            html += `<div class="tile-pot-badge">$${pot}</div>`;
        }
    }

    // Price
    if (tile.price && tile.price > 0 && type !== 'tax') {
        html += `<div class="price">$${tile.price}</div>`;
    } else if (tile.price && tile.price > 0 && type === 'tax') {
        html += `<div class="price">$${tile.price}</div>`;
    }

    if (tile.mortgaged) {
        html += `<div class="mortgaged-label">MORTGAGED</div>`;
    }

    html += '</div>';
    return html;
}

function renderBoard() {
    const dBoard = getBoard();
    if (!dBoard || !gameState.boardData) return;

    dBoard.querySelectorAll(".tile").forEach(t => t.remove());

    gameState.boardData.forEach((tile, index) => {
        const el = document.createElement("div");
        el.id = `tile-${index}`;
        el.className = "tile";

        const ownerPlayer = (tile.owner !== null && tile.owner !== undefined)
            ? gameState.players.find(p => p.id === tile.owner) : null;

        // Apply owner outline (The "Coloured Outline" pointer)
        if (ownerPlayer) {
            el.style.boxShadow = `inset 0 0 0 4px ${ownerPlayer.color}`;
            el.style.border = `1px solid ${ownerPlayer.color}`;
        }

        // POSITIONING — percentage-based matching the CSS system
        let top, left, w, h, sideClass;
        const c = 14; 
        const e = 8;  

        if (index >= 0 && index <= 10) {          
            sideClass = "bottom-row";
            top  = (100 - c) + "%";
            h    = c + "%";
            if (index === 0) {                     
                left = (100 - c) + "%"; w = c + "%";
                sideClass += " corner";
            } else if (index === 10) {             
                left = "0%"; w = c + "%";
                sideClass += " corner";
            } else {
                left = (100 - c - index * e) + "%"; w = e + "%";
            }
        } else if (index >= 11 && index <= 19) {  
            sideClass = "left-col";
            left = "0%"; w = c + "%";
            const m = index - 10;
            top  = (100 - c - m * e) + "%"; h = e + "%";
        } else if (index >= 20 && index <= 30) {  
            sideClass = "top-row";
            top = "0%"; h = c + "%";
            if (index === 20) {                    
                left = "0%"; w = c + "%";
                sideClass += " corner";
            } else if (index === 30) {             
                left = (100 - c) + "%"; w = c + "%";
                sideClass += " corner";
            } else {
                const m = index - 20;
                left = (c + (m - 1) * e) + "%"; w = e + "%";
            }
        } else {                                   
            sideClass = "right-col";
            left = (100 - c) + "%"; w = c + "%";
            const m = index - 30;
            top  = (c + (m - 1) * e) + "%"; h = e + "%";
        }

        el.classList.add(...sideClass.split(" "));
        el.style.top    = top;
        el.style.left   = left;
        el.style.width  = w;
        el.style.height = h;
        el.innerHTML    = buildTileContent(tile);
        el.onclick      = () => openPropertyInfo(index);

        if (tile.mortgaged) el.classList.add("is-mortgaged");

        dBoard.appendChild(el);
    });

    renderTokens();
}

function renderTokens() {
    document.querySelectorAll(".token").forEach(t => t.remove());

    const posGroups = {};
    gameState.players.forEach(p => {
        if (p.bankrupt) return;
        const pos = p.position;
        if (!posGroups[pos]) posGroups[pos] = [];
        posGroups[pos].push(p);
    });

    Object.keys(posGroups).forEach(pos => {
        const group = posGroups[pos];
        const idx = parseInt(pos);
        const tileEl = document.getElementById(`tile-${idx}`);
        if (!tileEl) return;

        group.forEach((p, i) => {
            const token = document.createElement("div");
            token.className = "token";
            token.style.backgroundColor = p.color;

            if (idx === 10) {
                const sub = p.inJail
                    ? tileEl.querySelector('.jail-prison')
                    : tileEl.querySelector('.jail-visiting');
                if (sub) { sub.appendChild(token); return; }
            }

            let top = "50%", left = "50%";
            const sx = (i - (group.length - 1) / 2) * 13;
            const sy = (i % 2 === 0 ? 4 : -4);

            if (idx >= 0  && idx <= 10)  top  = "75%";  // bottom row → push toward center
            if (idx >= 20 && idx <= 30)  top  = "25%";  // top row → push toward center
            if (idx >= 11 && idx <= 19)  left = "75%";  // left col → push right (toward center)
            if (idx >= 31 && idx <= 39)  left = "25%";  // right col → push left (toward center)

            token.style.top       = top;
            token.style.left      = left;
            token.style.transform = `translate(-50%, -50%) translate(${sx}px, ${sy}px)`;
            tileEl.appendChild(token);
        });
    });
}

function updatePlayersUI() {
    const dPlayersList = getPlayersList();
    if (!dPlayersList) return;
    dPlayersList.innerHTML = "";
    gameState.players.forEach(p => {
        if (p.bankrupt) return;
        const div = document.createElement("div");
        div.className = `player-card ${gameState.currentPlayerIndex === p.id ? "active" : ""}`;
        if (p.isDisconnected) { div.style.opacity = "0.4"; div.style.border = "1px dashed #ef4444"; }
        div.dataset.playerId = p.id;
        div.innerHTML = `
            <div class="player-info">
                <div class="player-token" style="background:${p.color}"></div>
                <span>${p.name}${p.isDisconnected ? ' <span style="font-size:.7rem;color:#ef4444">(AWAY)</span>' : ''}</span>
            </div>
            <div class="player-money">$${p.money}</div>
        `;
        div.onclick = () => { if (p.uniqueId !== myUniqueId) openTradeSetup(p.id); };
        dPlayersList.appendChild(div);
    });

    const me = gameState.players.find(p => p.uniqueId === window.myUniqueId);
    const dp = me || gameState.players[gameState.currentPlayerIndex];
    if (dp && !dp.bankrupt) {
        const cnt  = document.getElementById("my-prop-count");
        const list = document.getElementById("my-properties-list");
        if (cnt)  cnt.innerText = dp.properties.length;
        if (list) {
            list.innerHTML = "";
            dp.properties.forEach(pid => {
                const tile = gameState.boardData[pid];
                const d = document.createElement("div");
                d.className = "trade-prop-item";
                d.innerHTML = `<span>${tile.name}</span> ${getBuildingHTML(tile.houses)}`;
                d.style.borderLeft = `4px solid ${getActualColor(tile.color || "transparent")}`;
                list.appendChild(d);
            });
        }
    }
}

function renderUIControls() {
    if (document.getElementById("game-ui").classList.contains("hidden")) return;
    const ui = gameState.ui;
    if (!ui) return;

    const cp   = gameState.players[gameState.currentPlayerIndex];
    const isMe = cp && cp.uniqueId === myUniqueId;

    const btnRoll     = document.getElementById("btn-roll");
    const btnEnd      = document.getElementById("btn-end-turn");
    const btnBuy      = document.getElementById("btn-buy");
    const btnAuction  = document.getElementById("btn-auction");
    const btnJailFine = document.getElementById("btn-jail-fine");
    const dTurnStatus = document.getElementById("turn-status");

    // Update Turn Status Text
    if (dTurnStatus) {
        const actingPlayer = cp;
        const tile = actingPlayer ? gameState.boardData[actingPlayer.position] : null;

        if (ui.roll) {
            dTurnStatus.innerText = isMe ? "Your turn to roll" : `${actingPlayer.name}'s turn to roll`;
        } else {
            dTurnStatus.innerText = actingPlayer ? `${actingPlayer.name} landed on ${tile.name}` : "";
        }
    }

    if (isMe) {
        // FIX 4: Negative Balance Blocks End Turn
        const isInDebt = cp.money < 0;
        const dDebtWarning = document.getElementById("debt-warning");
        
        btnRoll    .classList.toggle("hidden", !ui.roll);
        btnJailFine.classList.toggle("hidden", !ui.jailFine);
        btnBuy     .classList.toggle("hidden", !ui.buy);
        btnAuction .classList.toggle("hidden", !ui.auction);
        btnEnd     .classList.toggle("hidden", !ui.endTurn);

        if (ui.endTurn) {
            if (isInDebt) {
                btnEnd.disabled = true;
                btnEnd.style.pointerEvents = 'none';
                btnEnd.style.opacity = '0.4';
                btnEnd.title = 'Settle your debt before ending turn';
                if (dDebtWarning) dDebtWarning.classList.remove("hidden");
            } else {
                btnEnd.disabled = false;
                btnEnd.style.pointerEvents = 'auto';
                btnEnd.style.opacity = '1';
                btnEnd.title = '';
                if (dDebtWarning) dDebtWarning.classList.add("hidden");
            }
        }

        if (ui.buy      && ui.buyText)     btnBuy.innerText = ui.buyText;
        if (ui.endTurn  && ui.endTurnText) btnEnd.innerText = ui.endTurnText;
    } else {
        [btnRoll, btnEnd, btnBuy, btnAuction, btnJailFine].forEach(b => b.classList.add("hidden"));
    }
}

function renderStateLog() {
    const dActivityLog = getActivityLog();
    if (!dActivityLog) return;
    dActivityLog.innerHTML = "";
    (gameState.log || []).forEach(entry => {
        if (entry.type === "bid") return; // Keep main log clean, bids are in auction history
        const d = document.createElement("div");
        d.className = entry.type === "sys" ? "sys-msg" : "chat-msg";
        d.innerHTML = entry.type === "chat" ? `<b>${entry.name}:</b> ${entry.text}` : entry.text;
        dActivityLog.appendChild(d);
    });
    dActivityLog.scrollTop = dActivityLog.scrollHeight;
}

function animateMoneyDelta(playerId, delta) {
    const card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
    if (!card) return;
    const rect  = card.getBoundingClientRect();
    const layer = document.getElementById("animation-layer");
    const el    = document.createElement("div");
    el.className = `money-delta ${delta >= 0 ? "positive" : "negative"}`;
    el.innerText = `${delta >= 0 ? "+" : "-"}$${Math.abs(delta)}`;
    el.style.cssText = `position:fixed;left:${rect.right - 60}px;top:${rect.top + rect.height / 2}px`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

window.renderBoard   = renderBoard;
window.renderTokens  = renderTokens;
window.updatePlayersUI  = updatePlayersUI;
window.renderUIControls = renderUIControls;
window.renderStateLog   = renderStateLog;
window.animateMoneyDelta = animateMoneyDelta;
