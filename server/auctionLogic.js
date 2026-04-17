// Specialized Engine for Real-time Competitive (Free-for-all) Auction Mechanics
class AuctionEngine {
    static handleAuction(state) {
        const p = state.players[state.currentPlayerIndex];
        const tile = state.boardData[p.position];
        
        state.auction = {
            tileId: p.position,
            currentBid: 0, 
            highestBidderId: null,
            timeLeft: 10,
            syncId: Date.now()
        };

        state.log.push({ type: "sys", text: `Real-time Auction started for ${tile.name}! Anyone can bid.` });
        return { auctionStarted: true };
    }

    static handleBid(state, uniqueId, payload) {
        if (!state.auction) return false;
        
        const bidder = state.players.find(p => p.uniqueId === uniqueId);
        if (!bidder || bidder.bankrupt) return false;

        const auc = state.auction;

        // Anti-Self-Bid Check
        if (auc.highestBidderId === bidder.id) {
            return false;
        }

        // PARANOID NUMERIC FORCING
        let bidValue = 0;
        if (payload && typeof payload === 'object') {
            bidValue = Number(payload.bid || payload.amount || 0);
        } else {
            bidValue = Number(payload);
        }

        const currentHigh = Number(auc.currentBid || 0);

        if (isNaN(bidValue) || bidValue <= currentHigh) {
            console.log(`[BID REJECTED] Bid $${bidValue} <= $${currentHigh}`);
            return false;
        }
        
        if (bidder.money < bidValue) return false;

        // Apply bid
        auc.currentBid = bidValue;
        auc.highestBidderId = bidder.id;
        
        // Push timer back to 10 seconds on every bid
        auc.timeLeft = 10;

        state.log.push({ type: "bid", text: `<span style="color:#f59e0b; font-weight:800;">${bidder.name}</span> bid <span style="color:#fff; font-weight:800;">$${bidValue}</span>` });
        auc.syncId = Date.now();
        
        return true;
    }

    static endAuction(state) {
        if (!state.auction) return;
        
        const auc = state.auction;
        const tile = state.boardData.find(t => t.id === auc.tileId);
        
        if (auc.highestBidderId !== null) {
            const winner = state.players.find(p => p.id === auc.highestBidderId);
            if (winner) {
                const finalPrice = Number(auc.currentBid);
                winner.money -= finalPrice;
                winner.properties.push(Number(auc.tileId));
                
                const bt = state.boardData.find(t => t.id === auc.tileId);
                if (bt) {
                    bt.owner = winner.id;
                    bt.mortgaged = false;
                    bt.houses = 0;
                }
                
                state.log.push({ type: "sys", text: `<span style="color:#fbbf24; font-weight:bold;">${winner.name}</span> won the auction for ${tile.name} at <span style="font-weight:bold;">$${finalPrice}</span>!` });
            }
        } else {
            state.log.push({ type: "sys", text: `Auction for ${tile.name} ended with no bidders.` });
        }

        state.auction = null;
        state.ui = {
            roll: false,
            endTurn: true,
            buy: false,
            jailFine: (state.players[state.currentPlayerIndex].inJail)
        };
    }
}

module.exports = AuctionEngine;
