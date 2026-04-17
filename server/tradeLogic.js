class TradeEngine {
    static handleTradeOffer(state, uniqueId, payload) {
        const fromPlayer = state.players.find(p => p.uniqueId === uniqueId);
        if (!fromPlayer) return false;
        
        // Find target by uniqueId (sent from client)
        const targetPlayer = state.players.find(p => p.uniqueId === payload.targetUniqueId);
        if (!targetPlayer) return false;

        const newTrade = {
            id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            fromId: fromPlayer.id,
            toId: targetPlayer.id,
            senderName: fromPlayer.name,
            senderUniqueId: fromPlayer.uniqueId,
            targetUniqueId: targetPlayer.uniqueId, // For client filtering
            offerMoney: payload.offerMoney || 0,
            wantMoney: payload.wantMoney || 0,
            offerProps: payload.offerProps || [],
            wantProps: payload.wantProps || [],
            viewers: []
        };

        state.pendingTrades.push(newTrade);
        state.log.push({ type: "sys", text: `${fromPlayer.name} sent a trade offer.` });
        return true;
    }

    static handleTradeOpen(state, uniqueId, payload) {
        const trade = state.pendingTrades.find(t => t.id === payload.tradeId);
        if (!trade) return false;
        if (!trade.viewers.includes(uniqueId)) {
            trade.viewers.push(uniqueId);
            return true;
        }
        return false;
    }

    static handleTradeClose(state, uniqueId, payload) {
        const trade = state.pendingTrades.find(t => t.id === payload.tradeId);
        if (!trade) return false;
        trade.viewers = trade.viewers.filter(uid => uid !== uniqueId);
        return true;
    }

    static handleTradeAccept(state, uniqueId, payload) {
        const trade = state.pendingTrades.find(t => t.id === payload.tradeId);
        if (!trade) return false;
        const index = state.pendingTrades.indexOf(trade);
        if (!trade) return false;

        const from = state.players.find(p => p.id === trade.fromId);
        const to = state.players.find(p => p.id === trade.toId);
        if (!from || !to) return false;

        // Validation
        if (from.money < trade.offerMoney || to.money < trade.wantMoney) return false;
        for (let pid of trade.offerProps) if (!from.properties.includes(pid)) return false;
        for (let pid of trade.wantProps) if (!to.properties.includes(pid)) return false;

        // Swap money
        from.money -= trade.offerMoney;
        from.money += trade.wantMoney;
        to.money -= trade.wantMoney;
        to.money += trade.offerMoney;

        // Swap props
        trade.offerProps.forEach(pid => {
            from.properties = from.properties.filter(id => id !== pid);
            to.properties.push(pid);
            const bt = state.boardData.find(t => t.id === pid);
            if (bt) bt.owner = to.id;
        });
        trade.wantProps.forEach(pid => {
            to.properties = to.properties.filter(id => id !== pid);
            from.properties.push(pid);
            const bt = state.boardData.find(t => t.id === pid);
            if (bt) bt.owner = from.id;
        });

        state.pendingTrades.splice(index, 1);
        state.log.push({ type: "sys", text: `${to.name} accepted ${from.name}'s trade.` });
        return true;
    }

    static handleTradeDecline(state, uniqueId, payload) {
        const trade = state.pendingTrades.find(t => t.id === payload.tradeId);
        if (!trade) return false;
        const index = state.pendingTrades.indexOf(trade);
        state.pendingTrades.splice(index, 1);
        return true;
    }

    static handleTradeCancel(state, uniqueId, payload) {
        const trade = state.pendingTrades.find(t => t.id === payload.tradeId);
        if (!trade) return false;
        const index = state.pendingTrades.indexOf(trade);
        
        // Ensure only sender can cancel
        if (trade.senderUniqueId !== uniqueId) return false;
        
        state.pendingTrades.splice(index, 1);
        return true;
    }
}

module.exports = TradeEngine;
