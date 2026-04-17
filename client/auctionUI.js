// Auction UI Controller
const dAuctionModal = document.getElementById("auction-modal");
const dAuctionTarget = document.getElementById("auction-target");
const dAuctionBid = document.getElementById("auction-bid");
const dAuctionLeaderAvatar = document.getElementById("auction-leader-avatar");
const dTimerText = document.getElementById("auction-timer");
const dTimerFill = document.getElementById("auction-timer-fill");
const dAcBanner = document.getElementById("ac-banner");
const dAcName = document.getElementById("ac-name");
const dAcRentTable = document.getElementById("ac-rent-table");
const dAcPrice = document.getElementById("ac-price");

function openAuctionModalUI() {
    if (!gameState.auction) return;
    document.getElementById("overlay-container").classList.remove("hidden");
    dAuctionModal.classList.remove("hidden");
    
    // Hide 'tap to close' hint for auctions as they are sticky
    const tapHint = document.querySelector(".tap-hint");
    if (tapHint) tapHint.style.visibility = "hidden";

    updateAuctionUI();
}

function updateAuctionUI() {
    const auc = gameState.auction;
    if (!auc) return;

    const tile = gameState.boardData[auc.tileId];
    if (tile) {
        dAuctionTarget.innerText = tile.name;
        dAcBanner.style.background = getActualColor(tile.color) || "#333";
        dAcName.innerText = tile.name;
        dAcPrice.innerText = `$${tile.price || 0}`;
        dAcRentTable.innerHTML = "";
        (tile.rent || []).forEach((val, i) => {
            const labels = ["Rent", "with 1 house", "with 2 houses", "with 3 houses", "with 4 houses", "with Hotel"];
            const row = document.createElement("div");
            row.className = "rent-row";
            row.innerHTML = `<span>${labels[i] || 'Rent'}</span> <span>$${val}</span>`;
            dAcRentTable.appendChild(row);
        });
    }
    if (dAuctionBid) dAuctionBid.innerText = `$${auc.currentBid}`;

    // FIX 7: Ultra-fluid 60fps bar — purely client-side, independent of server 500ms pulse
    // The bar targets #auction-timer-fill (known exact ID), falls back to class selectors
    function _reignFindBar() {
        return (
            document.getElementById("auction-timer-fill") ||       // exact ID — guaranteed match
            document.querySelector(".timer-fill") ||
            document.querySelector(".timer-bar .timer-fill") ||
            document.querySelector("[class*='timer'][class*='fill']")
        );
    }

    // Kill any previous rAF loop before starting a new one
    if (window._reignTimerRaf) {
        cancelAnimationFrame(window._reignTimerRaf);
        window._reignTimerRaf = null;
    }

    const DURATION = 10000; // ms — matches server auction duration
    const _bar = _reignFindBar();
    
    if (!window._reignAuctionSyncId || window._reignAuctionSyncId !== auc.syncId) {
        window._reignAuctionSyncId = auc.syncId;
        window._reignAuctionStartTime = performance.now();
    }
    const _startTime = window._reignAuctionStartTime;

    function _tick(now) {
        const elapsed = now - _startTime;
        const pct = Math.max(0, ((DURATION - elapsed) / DURATION) * 100);
        const secsLeft = Math.ceil((DURATION - elapsed) / 1000);

        // Animate bar at true 60fps — no CSS transition needed, rAF is the animation
        if (_bar) {
            _bar.style.setProperty("width", pct + "%", "important");
            _bar.style.setProperty("transition", "none", "important");
            _bar.style.setProperty("will-change", "width", "important");
        }

        // Update text — whole seconds only
        const dTimerText = document.getElementById("auction-timer");
        if (dTimerText) dTimerText.innerText = Math.max(0, secsLeft);

        if (pct > 0 && gameState.auction) {
            window._reignTimerRaf = requestAnimationFrame(_tick);
        } else {
            window._reignTimerRaf = null;
        }
    }

    window._reignTimerRaf = requestAnimationFrame(_tick);

    const me = gameState.players.find(p => p.uniqueId === myUniqueId);
    const isLeader = (me && auc.highestBidderId === me.id);
    
    const msgDiv = document.getElementById("auction-bidders-msg");
    const btnsDiv = document.getElementById("auction-bid-buttons");
    const bidLabel = document.querySelector(".bid-actions-label");

    if (!me) {
        if (msgDiv) msgDiv.classList.remove("hidden");
        if (btnsDiv) btnsDiv.classList.add("hidden");
        if (bidLabel) bidLabel.classList.add("hidden");
    } else {
        if (msgDiv) msgDiv.classList.add("hidden");
        if (btnsDiv) btnsDiv.classList.remove("hidden");
        if (bidLabel) bidLabel.classList.remove("hidden");
        
        const btns = document.querySelectorAll(".quick-bid-btn");
        btns.forEach((b, i) => {
            const increments = [1, 10, 100];
            const nextPrice = Number(auc.currentBid) + increments[i];
            const canAfford = (me.money >= nextPrice);
            b.disabled = isLeader || !canAfford;
            b.style.opacity = b.disabled ? "0.5" : "1";
            b.style.pointerEvents = b.disabled ? "none" : "auto";

            const tot = document.getElementById(`bid-tot-${i+1}`);
            const incr = document.getElementById(`bid-inc-${i+1}`);
            if (tot) tot.innerText = `$${nextPrice}`;
            if (incr) incr.innerText = `+$${increments[i]}`;
        });
    }

    if (auc.highestBidderId !== null) {
        const leader = gameState.players.find(p => p.id === auc.highestBidderId);
        if (dAuctionLeaderAvatar && leader) {
            dAuctionLeaderAvatar.classList.remove("hidden");
            dAuctionLeaderAvatar.style.background = leader.color;
        }
    } else {
        if (dAuctionLeaderAvatar) dAuctionLeaderAvatar.classList.add("hidden");
    }

    // Populate Auction History
    const dHist = document.getElementById("auction-history");
    if (dHist && gameState.log) {
        dHist.innerHTML = "";
        const bids = gameState.log.filter(l => l.type === 'bid').slice(-5).reverse();
        bids.forEach(bid => {
            const hRow = document.createElement("div");
            hRow.className = "auction-history-item";
            hRow.innerHTML = bid.text;
            dHist.appendChild(hRow);
        });
    }
}

function placeQuickBid(btnIndex) {
    const auc = gameState.auction;
    if (!auc) return;
    const increments = [1, 10, 100];
    const amount = Number(auc.currentBid) + increments[btnIndex - 1];
    sendAction("BID", { bid: amount });
}

window.openAuctionModalUI = openAuctionModalUI;
window.updateAuctionUI = updateAuctionUI;
window.placeQuickBid = placeQuickBid;
