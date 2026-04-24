const classicBoard = require('./board/classicedition');
const nycBoard = require('./board/newyorkcityedition');

const AuctionEngine = require('./auctionLogic');
const TradeEngine = require('./tradeLogic');
const crypto = require('crypto');

const chanceDeck = [
    { text: "Reverse Gear: Go back 3 spaces", type: "move_relative", amount: -3 },
    { text: "Speeding Fine: Pay $100 (Added to Tax Heaven)", type: "tax_pot", amount: 100 },
    { text: "Go to Jail: Advance directly to Jail. Do not pass Go.", type: "jail" },
    { text: "Debt Collector: Pay $100 to clear your outstanding debts. (Added to Tax Heaven)", type: "tax_pot", amount: 100 },
    { text: "Unlucky Investment: Lose $150 from your balance due to a bad investment. (Added to Tax Heaven)", type: "tax_pot", amount: 150 },
    { text: "Family Support: Receive $100 from a distant relative to help with your expenses.", type: "money", amount: 100 },
    { text: "It's time to renovate your properties: Pay $30 per house and $120 per hotel you own", type: "property_tax", house: 30, hotel: 120 },
    { text: "Generous Gift: Receive $150 as a gift from a grateful friend.", type: "money", amount: 150 },
    { text: "Doctor's Fees: Pay $50 (Added to Tax Heaven)", type: "tax_pot", amount: 50 },
    { text: "Prize Draw Winner: Receive $100 after winning a lucky draw contest.", type: "money", amount: 100 },
    { text: "Advance to Go: Collect $300", type: "move", position: 0 }
];

const communityDeck = [
    { text: "Bank Dividend: Bank pays you dividend of $50", type: "money", amount: 50 },
    { text: "Loan Maturity: Your building loan matures. Collect $150", type: "money", amount: 150 },
    { text: "Competition Winner: You have won a crossword competition. Collect $100", type: "money", amount: 100 },
    { text: "Bank Error: Bank error in your favor. Collect $200", type: "money", amount: 200 },
    { text: "Stock Sale: From sale of stock you get $50", type: "money", amount: 50 },
    { text: "Holiday Fund: Holiday fund matures. Receive $100", type: "money", amount: 100 },
    { text: "Tax Refund: Income tax refund. Collect $50", type: "money", amount: 50 },
    { text: "Life Insurance: Life insurance matures. Collect $100", type: "money", amount: 100 },
    { text: "Loan Maturity: Your building loan matures. Collect $150", type: "money", amount: 150 }
];

class GameEngine {
    constructor() {}

    static initializeState(settings, players) {
        const board = settings.boardType === 'nyc' ? nycBoard : classicBoard;
        
        // Ensure houseCost exists for all properties
        const houseCosts = {
            'brown': 50, 'lightblue': 50,
            'pink': 100, 'orange': 100,
            'red': 150, 'yellow': 150,
            'green': 200, 'darkblue': 200
        };

        const processedBoard = board.map(tile => {
            if (tile.type === 'property' && tile.color && !tile.houseCost) {
                return { ...tile, houseCost: houseCosts[tile.color] || 50 };
            }
            return tile;
        });

        const state = {
            version: 1,
            started: true,
            boardData: processedBoard,
            settings: {
                auctions: settings.auctions !== false,
                evenBuild: settings.evenBuild !== false,
                startCash: settings.startCash || 1500
            },
            players: players.map((p, index) => ({
                id: index,
                uniqueId: p.uniqueId,
                socketId: p.id,
                name: p.name,
                color: p.color,
                money: settings.startCash || 1500,
                position: 0,
                properties: [],
                inJail: false,
                jailTurns: 0,
                sleepingTurns: 0,
                bankrupt: false,
                isDisconnected: false,
                lastDisconnectedAt: null
            })),
            currentPlayerIndex: crypto.randomBytes(4).readUInt32BE(0) % players.length,
            taxHeavenPot: 0,
            doublesCount: 0,
            canRollAgain: false,
            diceRollCount: 0,
            auction: null,
            trade: null,
            pendingTrades: [],
            activeCard: null,
            log: [],
            lastRollValue: 0,
            ui: { roll: true, endTurn: false, buy: false, jailFine: false }
        };

        const firstPlayer = state.players[state.currentPlayerIndex];
        state.log.push({ type: "sys", text: `<span style="color:#8b5cf6; font-weight:bold;">Game Started! ${firstPlayer.name} goes first.</span>` });
        
        return state;
    }

    static processAction(state, uniqueId, action, payload) {
        state.version = (state.version || 0) + 1;
        
        const p = state.players[state.currentPlayerIndex];

        // CONNECTION GUARD: Block any action from a disconnected player
        const actingPlayer = state.players.find(pl => pl.uniqueId === uniqueId);
        if (actingPlayer && actingPlayer.isDisconnected) {
            console.log(`[GUARD] Blocked action "${action}" from disconnected player ${actingPlayer.name}`);
            return false;
        }
        
        // Validation: Is it this player's turn? (Bypass for auctions, trading, and bankruptcy)
        if (p.uniqueId !== uniqueId && action !== "BID" && action !== "BANKRUPTCY" && !action.startsWith("TRADE_")) {
            return false; 
        }

        switch (action) {
            case "ROLL":
                return this.handleRoll(state);
            case "END_TURN":
                return this.handleEndTurn(state);
            case "BUY":
                return this.handleBuy(state);
            case "JAIL_FINE":
                return this.handleJailFine(state);
            case "AUCTION":
                const res = AuctionEngine.handleAuction(state);
                this.updateUI(state, false, false, false, false, { auctionState: true });
                return res;
            case "BID":
                return AuctionEngine.handleBid(state, uniqueId, payload);
            case "TRADE_OFFER":
                return TradeEngine.handleTradeOffer(state, uniqueId, payload);
            case "TRADE_ACCEPT":
                return TradeEngine.handleTradeAccept(state, uniqueId, payload);
            case "TRADE_DECLINE":
                return TradeEngine.handleTradeDecline(state, uniqueId, payload);
            case "TRADE_CANCEL":
                return TradeEngine.handleTradeCancel(state, uniqueId, payload);
            case "TRADE_OPEN":
                return TradeEngine.handleTradeOpen(state, uniqueId, payload);
            case "TRADE_CLOSE":
                return TradeEngine.handleTradeClose(state, uniqueId, payload);
            case "MORTGAGE":
                return this.handleMortgage(state, uniqueId, payload);
            case "UNMORTGAGE":
                return this.handleUnmortgage(state, uniqueId, payload);
            case "BUILD":
                return this.handleBuild(state, uniqueId, payload);
            case "BUILD_ALL":
                return this.handleBuildAll(state, uniqueId, payload);
            case "SELL_BUILDING":
                return this.handleSellBuilding(state, uniqueId, payload);
            case "BANKRUPTCY":
                return this.handleBankruptcy(state, uniqueId);
            case "DRAW_CARD":
                return this.handleDrawCard(state, uniqueId, payload);
            case "RESOLVE_CARD":
                return this.handleResolveCard(state, uniqueId);
        }
        return true;
    }

    static handleRoll(state) {
        if (!state.ui.roll) return false;

        const p = state.players[state.currentPlayerIndex];
        
        // FIX 3: True Dice Randomization using crypto entropy
        const d1 = (crypto.randomBytes(4).readUInt32BE(0) % 6) + 1;
        const d2 = (crypto.randomBytes(4).readUInt32BE(0) % 6) + 1;
        state.diceRollCount++;
        state.lastRollValue = d1 + d2;

        const isDouble = (d1 === d2);
        
        state.log.push({ type: "sys", text: `${p.name} rolled ${d1} and ${d2}` });

        if (p.inJail) {
            if (isDouble) {
                p.inJail = false;
                p.jailTurns = 0;
                state.log.push({ type: "sys", text: `${p.name} rolled doubles and got out of prison!` });
                this.movePlayer(state, p, d1 + d2);
                state.canRollAgain = false;
                this.updateUI(state, false, true, false, false);
            } else {
                p.jailTurns++;
                if (p.jailTurns >= 3) {
                    state.log.push({ type: "sys", text: `${p.name} has been in prison for 3 turns! Time served.` });
                    p.inJail = false;
                    p.jailTurns = 0;
                    state.canRollAgain = false;
                    this.updateUI(state, false, true, false, false);
                } else {
                    state.log.push({ type: "sys", text: `${p.name} did not roll doubles.` });
                    state.canRollAgain = false;
                    this.updateUI(state, false, true, false, false);
                }
            }
            return { d1, d2 };
        }

        if (isDouble) {
            state.doublesCount++;
            if (state.doublesCount === 3) {
                state.log.push({ type: "sys", text: `${p.name} rolled 3 doubles! Go to Prison!` });
                this.goToJail(state, p);
                state.doublesCount = 0;
                state.canRollAgain = false;
                this.updateUI(state, false, true, false, false);
                return { d1, d2 };
            } else {
                state.canRollAgain = true;
            }
        } else {
            state.doublesCount = 0;
            state.canRollAgain = false;
        }

        this.movePlayer(state, p, d1 + d2);
        return { d1, d2 };
    }

    static goToJail(state, player) {
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        state.log.push({ type: "sys", text: `${player.name} was sent to PRISON!` });
        this.updateUI(state, false, true, false, false);
    }

    static movePlayer(state, player, spaces) {
        player.position += spaces;
        if (player.position >= 40) {
            player.position -= 40;
            
            // GO Salary - 300 if landed directly, 200 for passing
            if (player.position === 0) {
                player.money += 300;
                state.log.push({ type: "sys", text: `<span style="color:#fbbf24; font-weight:bold;">Landed on START! Collect $300</span>` });
            } else {
                player.money += 200;
                state.log.push({ type: "sys", text: `${player.name} passed START and collected $200` });
            }
        }
        this.resolveTile(state, player, state.boardData[player.position]);
    }

    static resolveTile(state, player, tile) {
        // Evaluate land logic
        let canEndTurn = true;
        let canBuy = false;
        let endTurnText = "End Turn";

        if (tile.type === "property" || tile.type === "railroad" || tile.type === "utility") {
            const ownerId = this.getOwner(state, tile.id);
            if (ownerId === null) {
                canBuy = true;
                if (state.settings.auctions) {
                    canEndTurn = true;
                    endTurnText = "Auction";
                } else {
                    // If auctions are disabled, the player can gracefully skip buying
                    canEndTurn = true; 
                    endTurnText = "End Turn";
                }
            } else if (ownerId !== player.id) {
                const owner = state.players.find(p => p.id === ownerId);
                if (!owner.inJail) {
                    const rent = this.calculateRent(state, tile, player);
                    player.money -= rent;
                    owner.money += rent;
                    state.log.push({ type: "sys", text: `${player.name} paid $${rent} rent to ${owner.name}` });
                }
            }
        } else if (tile.type === "tax") {
            player.money -= tile.price;
            state.taxHeavenPot += tile.price;
            state.log.push({ type: "sys", text: `${player.name} paid $${tile.price} tax` });
        } else if (tile.type === "tax_heaven") {
            if (state.taxHeavenPot > 0) {
                player.money += state.taxHeavenPot;
                state.log.push({ type: "sys", text: `${player.name} landed on Tax Heaven and collected $${state.taxHeavenPot}!` });
                state.taxHeavenPot = 0;
            }
        } else if (tile.type === "chance" || tile.type === "community_chest") {
            this.handleDrawCard(state, player.uniqueId, { type: tile.type });
            return; // handleDrawCard updates UI and return early
        } else if (tile.type === "go_to_jail") {
            this.goToJail(state, player);
            return; // UI already handled in goToJail
        }

        const canAuction = canBuy && state.settings.auctions;
        if (canAuction) {
            canEndTurn = false;
        }

        if (canBuy || canAuction) {
            // Must choose Buy or Auction first — hide everything else
            this.updateUI(state, false, false, canBuy, false, {
                buyText: `Buy for $${tile.price}`,
                auction: canAuction
            });
        } else if (state.canRollAgain) {
            // Doubles: show ONLY the Roll button but with custom text
            this.updateUI(state, true, false, false, false, { rollText: "Roll Again" });
        } else {
            this.updateUI(state, false, canEndTurn, false, false);
        }
    }

    static handleBuy(state) {
        if (!state.ui.buy) return;
        const p = state.players[state.currentPlayerIndex];
        const tile = state.boardData[p.position];
        
        if (p.money >= tile.price) {
            p.money -= tile.price;
            p.properties.push(Number(tile.id));
            // Establish ownership properly
            state.boardData[tile.id].owner = p.id;
            state.boardData[tile.id].mortgaged = false;
            state.boardData[tile.id].houses = 0;
            
            state.log.push({ type: "sys", text: `${p.name} bought <span style="font-weight:bold;">${tile.name}</span> for $${tile.price}` });
            if (state.canRollAgain) {
                this.updateUI(state, true, false, false, false, { rollText: "Roll Again" });
            } else {
                this.updateUI(state, false, true, false, false);
            }
        }
    }

    static handleEndTurn(state, force = false) {
        if (!state.ui.endTurn && !force) return;

        state.ui.roll = true;
        state.ui.endTurn = false;
        state.ui.buy = false;
        state.canRollAgain = false;
        state.doublesCount = 0;
        
        // Loop to next player
        do {
            state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        } while (state.players[state.currentPlayerIndex].bankrupt);

        const nextP = state.players[state.currentPlayerIndex];
        this.updateUI(state, true, false, false, nextP.inJail);
    }

    static getOwner(state, tileId) {
        for (let p of state.players) {
            if (p.properties.includes(tileId)) return p.id;
        }
        return null;
    }

    static calculateRent(state, tile, player) {
        if (tile.mortgaged) return 0;
        const ownerId = this.getOwner(state, tile.id);
        if (ownerId === null) return 0;
        const owner = state.players.find(p => p.id === ownerId);

        if (tile.type === "property") {
            // Rent logic for properties
            const houses = tile.houses || 0;
            if (houses > 0) {
                return tile.rent[houses];
            }
            
            // Check for Monopoly (colors)
            const sameColorTiles = state.boardData.filter(t => t.color === tile.color);
            const ownsAll = sameColorTiles.every(t => owner.properties.includes(t.id));
            
            if (ownsAll) return tile.rent[0] * 2; // Double rent for monopoly with no houses
            return tile.rent[0];
        } 
        
        else if (tile.type === "railroad") {
            const railroads = state.boardData.filter(t => t.type === "railroad");
            const ownedCount = railroads.filter(t => owner.properties.includes(t.id)).length;
            // Rent is 25, 50, 100, 200 based on count
            const rrRent = [25, 50, 100, 200];
            return rrRent[ownedCount - 1] || 25;
        } 
        
        else if (tile.type === "utility") {
            const utilities = state.boardData.filter(t => t.type === "utility");
            const ownedCount = utilities.filter(t => owner.properties.includes(t.id)).length;
            
            // Standard rules: use the roll that landed them there
            const roll = state.lastRollValue || 7;
            return ownedCount === 2 ? roll * 10 : roll * 4;
        }

        return 25;
    }


    static handleMortgage(state, uniqueId, payload) {
        const p = state.players.find(player => player.uniqueId === uniqueId);
        const tile = state.boardData.find(t => t.id === payload.tileId);
        if (p && tile && p.properties.includes(tile.id) && !tile.mortgaged) {
            tile.mortgaged = true;
            p.money += (tile.price / 2);
            state.log.push({ type: "sys", text: `${p.name} mortgaged ${tile.name}` });
        }
        return true;
    }

    static handleUnmortgage(state, uniqueId, payload) {
        const p = state.players.find(player => player.uniqueId === uniqueId);
        const tile = state.boardData.find(t => t.id === payload.tileId);
        const cost = Math.floor((tile.price / 2) * 1.1);
        if (p && tile && tile.mortgaged && p.money >= cost) {
            tile.mortgaged = false;
            p.money -= cost;
            state.log.push({ type: "sys", text: `${p.name} unmortgaged ${tile.name}` });
        }
        return true;
    }

    static handleBuild(state, uniqueId, payload) {
        const p = state.players.find(player => player.uniqueId === uniqueId);
        const tile = state.boardData.find(t => t.id === payload.tileId);
        
        // Rules: must be owner, must be property type, must NOT be mortgaged, must own FULL SET
        if (p && tile && tile.owner === p.id && tile.type === "property" && !tile.mortgaged) {
            const sameColorTiles = state.boardData.filter(t => t.color === tile.color);
            const ownsFullSet = sameColorTiles.every(t => t.owner === p.id);
            if (!ownsFullSet) return false;

            if (p.money >= tile.houseCost && (tile.houses || 0) < 5) {
                tile.houses = (tile.houses || 0) + 1;
                p.money -= tile.houseCost;
                state.log.push({ type: "sys", text: `${p.name} built on ${tile.name}` });
                return true;
            }
        }
        return false;
    }

    static handleBuildAll(state, uniqueId, payload) {
        const p = state.players.find(player => player.uniqueId === uniqueId);
        const refTile = state.boardData.find(t => t.id === payload.tileId);
        if (!p || !refTile || refTile.type !== "property") return false;

        const set = state.boardData.filter(t => t.color === refTile.color);
        let builtAny = false;
        
        set.forEach(tile => {
            if (tile.owner === p.id && (tile.houses || 0) < 5 && p.money >= tile.houseCost && !tile.mortgaged) {
                tile.houses = (tile.houses || 0) + 1;
                p.money -= tile.houseCost;
                builtAny = true;
            }
        });

        if (builtAny) {
            state.log.push({ type: "sys", text: `${p.name} built on the entire ${refTile.color} set!` });
        }
        return true;
    }

    static handleBankruptcy(state, uniqueId) {
        const p = state.players.find(player => player.uniqueId === uniqueId);
        if (p) {
            p.bankrupt = true;
            p.money = 0;
            
            // Clean up properties: Remove ownership from board and clear player's list
            p.properties.forEach(tileId => {
                const boardTile = state.boardData.find(t => t.id === tileId);
                if (boardTile) {
                    boardTile.owner = null;
                    boardTile.mortgaged = false;
                    boardTile.houses = 0;
                }
            });
            p.properties = [];
            
            state.log.push({ type: "sys", text: `${p.name} has declared bankruptcy and left the game!` });
            
            // Check win condition
            const activePlayers = state.players.filter(pl => !pl.bankrupt);
            if (activePlayers.length === 1) {
                state.winner = activePlayers[0];
                state.log.push({ type: "sys", text: `${activePlayers[0].name} is the winner!` });
            }

            if (state.players[state.currentPlayerIndex].uniqueId === uniqueId) {
                this.handleEndTurn(state, true);
            }
        }
        return true;
    }

    static handleJailFine(state) {
        const p = state.players[state.currentPlayerIndex];
        if (!p.inJail || p.money < 50) return false;

        p.money -= 50;
        p.inJail = false;
        p.jailTurns = 0;
        state.log.push({ type: "sys", text: `${p.name} paid $50 and is free from prison!` });
        
        // After paying, they can roll
        this.updateUI(state, true, false, false, false);
        return true;
    }

    static handleDrawCard(state, uniqueId, payload) {
        const type = payload.type; // 'chance' or 'community'
        const deck = type === "chance" ? chanceDeck : communityDeck;
        // FIX: True Card Randomization using crypto entropy
        const index = crypto.randomBytes(4).readUInt32BE(0) % deck.length;
        const card = deck[index];

        state.activeCard = {
            type,
            index,
            text: card.text,
            isChance: type === "chance"
        };
        
        state.log.push({ type: "sys", text: `${state.players[state.currentPlayerIndex].name} drew: ${card.text}` });
        this.updateUI(state, false, true, false, false, { 
            cardActive: true,
            endTurnText: "End Turn"
        });
        return true;
    }

    static handleResolveCard(state, uniqueId) {
        if (!state.activeCard) return false;
        
        const p = state.players[state.currentPlayerIndex];
        const deck = state.activeCard.type === "chance" ? chanceDeck : communityDeck;
        const card = deck[state.activeCard.index];

        if (card.type === "money") {
            p.money += card.amount;
        } else if (card.type === "move") {
            // GO check: if target position is behind current, we passed START
            if (card.position < p.position && card.position !== 0) {
                p.money += 200;
                state.log.push({ type: "sys", text: `${p.name} passed START and collected $200` });
            } else if (card.position === 0) {
                p.money += 300;
                state.log.push({ type: "sys", text: `<span style="color:#fbbf24; font-weight:bold;">Landed on START! Collect $300</span>` });
            }
            p.position = card.position;
            this.resolveTile(state, p, state.boardData[p.position]);
        } else if (card.type === "jail") {
            this.goToJail(state, p);
        } else if (card.type === "move_relative") {
             p.position = (p.position + card.amount + state.boardData.length) % state.boardData.length;
             this.resolveTile(state, p, state.boardData[p.position]);
        } else if (card.type === "pay_players") {
            state.players.forEach(other => {
                if (other.id !== p.id && !other.bankrupt) {
                    p.money -= card.amount;
                    other.money += card.amount;
                }
            });
        } else if (card.type === "tax_pot") {
            p.money -= card.amount;
            state.taxHeavenPot += card.amount;
        } else if (card.type === "property_tax") {
            let total = 0;
            p.properties.forEach(id => {
                const tile = state.boardData[id];
                if (tile.type === "property") {
                    const h = tile.houses || 0;
                    if (h === 5) {
                        total += card.hotel;
                    } else {
                        total += (h * card.house);
                    }
                }
            });
            p.money -= total;
            state.log.push({ type: "sys", text: `${p.name} paid $${total} for property renovations.` });
        }

        state.activeCard = null;
        if (state.canRollAgain) {
            this.updateUI(state, true, false, false, false, { rollText: "Roll Again" });
        } else {
            this.updateUI(state, false, true, false, false);
        }
        return true;
    }

    static updateUI(state, roll, endTurn, buy, jailFine, extras = {}) {
        state.ui = {
            roll: roll,
            endTurn: endTurn,
            buy: buy,
            jailFine: jailFine,
            ...extras
        };
    }
}

module.exports = GameEngine;
