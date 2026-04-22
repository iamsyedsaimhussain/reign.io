require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const GameEngine = require('./gameLogic');
const AuctionEngine = require('./auctionLogic');
const TradeEngine = require('./tradeLogic');
const redisManager = require('./redisManager');

const app = express();

const server = http.createServer(app);
const io = new Server(server);

// Serve the client directory as static files
app.use(express.static(path.join(__dirname, '../client')));

// Store active rooms and their hosts
const rooms = {};

// Generate a random 4-letter room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Host creating a room
    socket.on('create_room', (data) => {
        const { maxPlayers, uniqueId } = data;
        let roomCode;
        do {
            roomCode = generateRoomCode();
        } while (rooms[roomCode]);

        rooms[roomCode] = {
            hostId: socket.id,
            hostUniqueId: uniqueId,
            players: [socket.id], 
            playerDetails: {
                [socket.id]: { id: socket.id, uniqueId, name: '', color: '' }
            }, 
            maxPlayers: maxPlayers || 4,
            gameState: null
        };

        socket.reignRoom = roomCode;
        socket.reignUid = uniqueId;
        socket.join(roomCode);
        console.log(`Room created: ${roomCode} by Host: ${socket.id} (${uniqueId})`);
        socket.emit('room_created', roomCode);
        
        // Initial lobby update since host is now in it
        socket.emit('lobby_update', {
            players: Object.values(rooms[roomCode].playerDetails),
            maxPlayers: rooms[roomCode].maxPlayers
        });
    });

    // Client joining a room
    socket.on('join_room', (data) => {
        const roomCode = (typeof data === 'string' ? data : data.roomCode).toUpperCase();
        const uniqueId = (typeof data === 'object' ? data.uniqueId : null);
        const room = rooms[roomCode];
        
        if (room) {
            // AUTHORITATIVE RECONNECTION: Check if this uniqueId is already in an active game
            if (uniqueId && room.gameState) {
                const existingPlayer = room.gameState.players.find(p => p.uniqueId === uniqueId);
                if (existingPlayer) {
                    socket.reignRoom = roomCode; // TAG FOR INSTANT RECOVERY
                    socket.reignUid = uniqueId;
                    
                    existingPlayer.socketId = socket.id;
                    existingPlayer.isDisconnected = false;
                    existingPlayer.lastDisconnectedAt = null;
                    socket.join(roomCode);
                    console.log(`Persistent Player Reconnected: ${existingPlayer.name} (${uniqueId})`);
                    
                    // RE-REGISTER in playerDetails so disconnect handler finds them later
                    room.playerDetails[socket.id] = { id: socket.id, uniqueId, name: existingPlayer.name, color: existingPlayer.color };

                    // If they were the host, restore that status
                    const wasHost = (uniqueId === room.hostUniqueId);
                    if (wasHost) room.hostId = socket.id;

                    socket.emit('room_joined', { roomCode, isHost: wasHost, gameStarted: true });
                    socket.emit('game_start_confirmed', { state: room.gameState });
                    
                    // BROADCAST to clear (AWAY) tag on all clients
                    io.to(roomCode).emit('state_update', room.gameState);
                    return;
                }
            }
            
            // Lobby-phase reconnection (before game starts)
            const lobbyMatch = Object.values(room.playerDetails).find(p => p.uniqueId === uniqueId);
            if (lobbyMatch) {
                socket.reignRoom = roomCode;
                socket.reignUid = uniqueId;
                delete room.playerDetails[lobbyMatch.id]; // Remove old socket entry
                room.playerDetails[socket.id] = { ...lobbyMatch, id: socket.id };
                socket.join(roomCode);
                const wasHost = (uniqueId === room.hostUniqueId);
                if (wasHost) room.hostId = socket.id;
                
                socket.emit('room_joined', { 
                    roomCode, 
                    isHost: wasHost, 
                    players: Object.values(room.playerDetails),
                    gameStarted: !!room.gameState
                });
                io.to(roomCode).emit('lobby_update', {
                    players: Object.values(room.playerDetails),
                    maxPlayers: room.maxPlayers
                });
                return;
            }

            if (Object.keys(room.playerDetails).length < room.maxPlayers) {
                socket.reignRoom = roomCode;
                socket.reignUid = uniqueId;
                socket.join(roomCode);
                room.playerDetails[socket.id] = { id: socket.id, uniqueId, name: '', color: '' };
                if (!room.players.includes(socket.id)) room.players.push(socket.id);
                
                socket.emit('room_joined', { 
                    roomCode, 
                    isHost: false, 
                    players: Object.values(room.playerDetails),
                    gameStarted: false
                });
                io.to(roomCode).emit('lobby_update', {
                    players: Object.values(room.playerDetails),
                    maxPlayers: room.maxPlayers
                });
            } else {
                socket.emit('error_message', 'Room is full!');
            }
        } else {
            socket.emit('error_message', 'Room not found!');
        }
    });

    // Player updating their profile (name/color)
    socket.on('update_profile', (data) => {
        const { roomCode, name, color } = data;
        const room = rooms[roomCode];
        if (room && room.playerDetails[socket.id]) {
            let finalColor = color;
            
            // Fix: Enforce color uniqueness on the server
            const takenColors = Object.values(room.playerDetails)
                .filter(p => p.id !== socket.id && p.color)
                .map(p => p.color);
                
            if (takenColors.includes(color)) {
                const DEFAULT_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
                const available = DEFAULT_COLORS.filter(c => !takenColors.includes(c));
                if (available.length > 0) {
                    finalColor = available[0];
                }
            }

            room.playerDetails[socket.id].name = name;
            room.playerDetails[socket.id].color = finalColor;

            if (room.gameState) {
                const uid = room.playerDetails[socket.id].uniqueId;
                const p = room.gameState.players.find(player => player.uniqueId === uid);
                if (p) {
                    p.name = name;
                    p.color = finalColor;
                }
            }

            io.to(roomCode).emit('lobby_update', {
                players: Object.values(room.playerDetails),
                maxPlayers: room.maxPlayers
            });
        }
    });

    // Host starting the game
    socket.on('start_game', (data) => {
        const { roomCode, settings } = data;
        const room = rooms[roomCode];
        if (room && socket.id === room.hostId) {
            const participants = Object.values(room.playerDetails);
            if (participants.length < 2) {
                socket.emit('error_message', "You need at least 2 players to start!");
                return;
            } 

            // Initialize server authoritative state
            room.gameState = GameEngine.initializeState(settings, participants);
            
            io.to(roomCode).emit('game_start_confirmed', {
                state: room.gameState
            });

            // Initial state sync to ensure everyone has the correct UI and identities
            io.to(roomCode).emit('state_update', room.gameState);

            redisManager.saveState(roomCode, room.gameState);
        }
    });

    // Reset game (Host only)
    socket.on('reset_game', (data) => {
        const { roomCode } = data;
        const room = rooms[roomCode];
        if (room && socket.id === room.hostId) {
            room.gameState = null; // Wipe state
            io.to(roomCode).emit('game_reset'); // Tell everyone to return to lobby
            // Send fresh lobby data so the waiting area doesn't look empty
            io.to(roomCode).emit('lobby_update', {
                players: Object.values(room.playerDetails),
                maxPlayers: room.maxPlayers
            });
        }
    });

    // Client sending an authoritative action to the Server!
    socket.on('client_action', (data) => {
        const { roomCode, uniqueId, action, payload } = data;
        const room = rooms[roomCode];
        if (room && room.gameState) {
            // Process the action using the Engine
            const diceResult = GameEngine.processAction(room.gameState, uniqueId, action, payload);
            
            if (diceResult && diceResult.d1 !== undefined) {
                const { d1, d2 } = diceResult;
                const laps = 5 * room.gameState.diceRollCount;
                const tilt = () => (Math.random() * 10 - 5);
                const rotations = [{x:0,y:0}, {x:-90,y:0}, {x:0,y:-90}, {x:0,y:90}, {x:90,y:0}, {x:0,y:180}];
                const d1_rot = rotations[d1 - 1];
                const d2_rot = rotations[d2 - 1];
                const t0 = `rotateX(${d1_rot.x + (laps * 360) + tilt()}deg) rotateY(${d1_rot.y + (laps * 360) + tilt()}deg) rotateZ(${tilt()}deg)`;
                const t1 = `rotateX(${d2_rot.x + (laps * 360) + tilt()}deg) rotateY(${d2_rot.y + (laps * 360) + tilt()}deg) rotateZ(${tilt()}deg)`;
                
                io.to(roomCode).emit('dice_anim', { t0, t1 });
                
                setTimeout(() => {
                    redisManager.saveState(roomCode, room.gameState);
                    io.to(roomCode).emit('state_update', room.gameState);
                }, 1500);
            } else {
                redisManager.saveState(roomCode, room.gameState);
                io.to(roomCode).emit('state_update', room.gameState);
            }
        }
    });

    socket.on('send_chat', (data) => {
        const { roomCode, uniqueId, text } = data;
        const room = rooms[roomCode];
        if (room) {
            const player = Object.values(room.playerDetails).find(p => p.uniqueId === uniqueId) || 
                           (room.gameState && room.gameState.players.find(p => p.uniqueId === uniqueId));
            if (player && text) {
                io.to(roomCode).emit('chat_received', {
                    name: player.name,
                    color: player.color,
                    text: text.substring(0, 200)
                });
            }
        }
    });

    // Handle Disconnects
    socket.on('disconnect', () => {
        const code = socket.reignRoom;
        if (!code) return;
        const room = rooms[code];
        if (!room) return;

        const uniqueId = socket.reignUid;
        if (room.gameState) {
            const p = room.gameState.players.find(pl => pl.uniqueId === uniqueId);
            if (p) {
                p.isDisconnected = true;
                p.lastDisconnectedAt = Date.now();
                io.to(code).emit('state_update', room.gameState);
                redisManager.saveState(code, room.gameState);
            }
        }
        
        if (room.hostId === socket.id && !room.gameState) {
            socket.to(code).emit('host_disconnected');
            delete rooms[code];
        } else {
            delete room.playerDetails[socket.id];
            room.players = room.players.filter(id => id !== socket.id);
            io.to(code).emit('lobby_update', {
                players: Object.values(room.playerDetails),
                maxPlayers: room.maxPlayers
            });
        }
    });

});

// Cleanup Interval: Remove players disconnected > 2 mins
setInterval(() => {
    const GRACE_PERIOD = 120000; // 2 minutes
    const now = Date.now();
    for (const code in rooms) {
        const room = rooms[code];
        if (room.gameState) {
            let changed = false;
            room.gameState.players.forEach(p => {
                if (p.isDisconnected && !p.bankrupt && p.lastDisconnectedAt) {
                    if (now - p.lastDisconnectedAt > GRACE_PERIOD) {
                        // Player exceeded grace period - mark as bankrupt to clear their properties
                        console.log(`[CLEANUP] Player ${p.name} timed out in room ${code}`);
                        GameEngine.handleBankruptcy(room.gameState, p.uniqueId);
                        changed = true;
                    }
                }
            });
            if (changed) {
                io.to(code).emit('state_update', room.gameState);
                redisManager.saveState(code, room.gameState);
            }
        }
    }
}, 10000);


// Global Game Loop for Server-Side Timers (Auctions)
setInterval(() => {
    for (const roomCode in rooms) {
        const room = rooms[roomCode];
        if (room.gameState && room.gameState.auction) {
            const auc = room.gameState.auction;
            auc.timeLeft = Number(auc.timeLeft) - 0.5;

            if (auc.timeLeft <= 0) {
                AuctionEngine.endAuction(room.gameState);
                redisManager.saveState(roomCode, room.gameState);
                io.to(roomCode).emit('state_update', room.gameState);
            } else {
                // Heartbeat sync for timer
                io.to(roomCode).emit('state_update', room.gameState);
            }
        }
    }
}, 500);

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    // Initialize Redis before accepting game logic
    await redisManager.connect();
    console.log(`Server is running on http://localhost:${PORT}`);
});
