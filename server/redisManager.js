const Redis = require('ioredis');

class RedisManager {
    constructor() {
        this.client = null;
        this.isReady = false;
        
        // Fallback in-memory map if Redis is not configured or disabled
        this.memoryStore = new Map();
    }

    async connect() {
        if (!process.env.REDIS_URL) {
            console.log('No REDIS_URL found. Running with local in-memory store.');
            return;
        }

        const rawUrl = process.env.REDIS_URL.trim();
        console.log(`REDIS_URL Diagnostic: Length is ${rawUrl.length}. Starts with: ${rawUrl.substring(0, 10)}...`);

        try {
            console.log('Attempting to connect to Redis via ioredis...');
            this.client = new Redis(rawUrl, {
                maxRetriesPerRequest: 3,
                connectTimeout: 10000, 
                tls: {
                    rejectUnauthorized: false // Often needed for cloud certificates
                },
                retryStrategy: (times) => {
                    console.log(`Redis reconnect attempt #${times}...`);
                    if (times > 3) return null;
                    return 2000;
                }
            });

            this.client.on('error', (err) => console.log('ioredis Client Error:', err.message));
            
            this.client.on('connect', () => {
                console.log('ioredis: Handshake established.');
            });

            this.client.on('ready', () => {
                this.isReady = true;
                console.log('Redis successfully connected via ioredis!');
            });

            this.client.on('reconnecting', () => {
                console.log('ioredis: Attempting to reconnect...');
            });
        } catch (error) {
            console.log('Failed to initialize ioredis:', error.message);
        }
    }

    // Save a room's entire state. Expiry defaults to 2 hours to prevent zombie games.
    async saveState(roomCode, state, expirySeconds = 7200) {
        const key = `reign:room:${roomCode}`;
        const data = JSON.stringify(state);

        if (this.isReady) {
            try {
                // ioredis uses 'EX' as a positional argument
                await this.client.set(key, data, 'EX', expirySeconds);
            } catch (err) {
                console.error(`Redis save failed for ${roomCode}:`, err);
            }
        } else {
            this.memoryStore.set(key, data);
        }
    }

    // Load a room's state
    async loadState(roomCode) {
        const key = `reign:room:${roomCode}`;
        let rawData = null;

        if (this.isReady) {
            try {
                rawData = await this.client.get(key);
            } catch (err) {
                console.error(`Redis load failed for ${roomCode}:`, err);
            }
        } else {
            rawData = this.memoryStore.get(key);
        }

        if (rawData) {
            try {
                return JSON.parse(rawData);
            } catch (e) {
                console.error('Failed to parse state from store:', e);
                return null;
            }
        }
        return null;
    }

    // Delete room state explicitly (e.g. game over)
    async deleteState(roomCode) {
        const key = `reign:room:${roomCode}`;
        if (this.isReady) {
            try {
                await this.client.del(key);
            } catch (err) {
                console.error(`Redis del failed for ${roomCode}:`, err);
            }
        } else {
            this.memoryStore.delete(key);
        }
    }
}

module.exports = new RedisManager();
