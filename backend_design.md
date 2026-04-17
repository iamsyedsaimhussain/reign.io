# Phase 2: System & Backend Architecture Design

This document details the architecture for adding a scalable backend, converting the current local multiplayer/hotseat prototype into a real-time, authoritative multiplayer Reign game.

## 1. Technology Stack
*   **Backend Server:** Node.js with Express (for routing and REST API)
*   **Real-time Communication:** Socket.IO / WebSockets (for ultra-low latency game state synchronization)
*   **Database:** MongoDB via Mongoose (for flexible document storage schemas)
*   **In-Memory Store (Optional):** Redis (To maintain active game state without hammering the DB on every dice roll)
*   **Frontend Extension:** Integrate Socket.IO-client in `reign.js`

## 2. Separation of Concerns & Security (Server Authoritative)
The most critical rule for a game backend is **"Never trust the client."** 

*   **Client (Frontend):** Renders the UI, plays animations, and captures user input. If a user presses "Roll Dice", it just sends an event: `socket.emit("request_roll")`. It does *not* generate the dice numbers.
*   **Server (Backend):** Holds the true `GameState`. When receiving `request_roll`, the server runs `Math.random()`, updates positions, subtracts rent, and broadcasts: `io.to(roomId).emit("state_update", newGameState)`.

## 3. Database Schema Design (MongoDB)

### User Schema
```javascript
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    reignScore: { type: Number, default: 1000 } // Ranked matchmaking score
});
```

### Game/Room Schema
```javascript
const GameSchema = new mongoose.Schema({
    roomId: { type: String, unique: true, required: true },
    status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
    settings: {
        auctionsEnabled: Boolean,
        evenBuildRule: Boolean,
        startingCash: Number,
        boardType: String
    },
    players: [{
        userId: mongoose.Schema.Types.ObjectId,
        username: String,
        color: String,
        money: Number,
        position: Number,
        inJail: Boolean,
        properties: [Number] // Array of board tile IDs
    }],
    currentPlayerIndex: Number,
    turnPhase: { type: String, enum: ['roll', 'action', 'trading', 'auction', 'end'] },
    logHistory: [String] // "Player X bought Y"
}, { timestamps: true });
```

## 4. WebSocket Event Architecture

### Lobby / Connection
*   `join_room(roomId)`: Client requests to enter a lobby.
*   `room_update(roomState)`: Server broadcasts when someone joins/leaves.
*   `start_game(settings)`: Host initiates the game.

### Core Gameplay Loop
1.  **Client:** `roll_dice()`
2.  **Server:** Validates turn -> rolls 2d6 -> updates position -> resolves tile rules (e.g., land on tax, pay owner). 
3.  **Server:** `dice_result(d1, d2)` -> Broadcast to all to play animation.
4.  **Server:** `state_update(partialState)` -> Broadcast new balances and positions to UI.
5.  **Server:** If tile is unowned property, server sends `offer_property(tileId)` to the current player.
6.  **Client:** `buy_property(tileId)`
7.  **Server:** Validates funds, deducts money, updates owner, broadcasts `state_update()`.
8.  **Client:** `end_turn()`
9.  **Server:** Increments `currentPlayerIndex`, broadcasts `turn_change()`.

### Trading & Auctions
*   `create_trade({ toPlayer, offerMoney, requestCards, ... })`
*   `accept_trade(tradeId)`
*   `bid_auction({ tileId, amount })` -> Server tracks highest bidder on an interval timer, auto-closes if no bids for X seconds.

## 5. Deployment & Scalability Strategy
*   **Stateless Scaling:** Socket.IO uses `socket.io-redis` adapter so that multiple Node.js instances can share the events. If a user on Server A rolls the dice, users connected to Server B for that same Room ID still get the events.
*   **State Recovery:** On disconnect, the client reauthenticates with their JWT. The server checks if their `roomId` is active, and sends the latest authoritative `GameState`, successfully jumping them right back into the game.
