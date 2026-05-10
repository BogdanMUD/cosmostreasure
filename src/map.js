// map.js
const TILE_SIZE = 32;

class GameMap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = []; // 1D array, y * width + x
        this.initMap();
    }

    initMap() {
        this.trees = new Map(); // "x,y" => state
        this.buildings = new Map(); // "x,y" => type
        this.storageWood = 0;
        this.storageRaw = 0;
        this.maxStorageWood = 30;
        this.hasStorage = false;
        this.roads = new Set();
        this.roadAnimProgress = new Map(); // "x,y" -> progress 0 to 1
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Simple generation: mostly grass/plains (0), some water (1) at edges
                let type = 0;
                if (x < 2 || x > this.width - 3 || y < 2 || y > this.height - 3) {
                    type = 1; // water
                } else {
                    // Randomly add trees
                    if (Math.random() < 0.1) {
                        this.trees.set(`${x},${y}`, { state: 'grown' });
                    }
                }
                this.tiles.push(type);
            }
        }
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
        return this.tiles[y * this.width + x];
    }

    isWalkable(x, y) {
        if (this.buildings.has(`${x},${y}`)) return false;
        const tree = this.trees.get(`${x},${y}`);
        if (tree && tree.state === 'sapling') return false;
        return this.getTile(x, y) === 0; // Only grass is walkable for now
    }

    update(dt) {
        // Handle road animations
        for (const [key, prog] of this.roadAnimProgress.entries()) {
            if (prog < 1) {
                this.roadAnimProgress.set(key, Math.min(1, prog + dt * 2));
            }
        }

        // Handle tree growth
        for (const [key, tree] of this.trees.entries()) {
            if (tree.state === 'sapling') {
                tree.timer -= dt;
                if (tree.timer <= 0) {
                    tree.state = 'grown';
                }
            }
        }

        // Handle wood factories
        for (const [key, bldData] of this.buildings.entries()) {
            if (bldData && bldData.id === key) { // Only process anchor tile
                let bld = bldData.type;
                if (bld === 'factory' || (typeof bld === 'object' && bld.type === 'factory')) {
                    if (typeof bld === 'string') {
                        bldData.type = { type: 'factory', timer: 0 };
                        bld = bldData.type;
                    }

                    bld.timer += dt;
                    if (bld.timer >= 10) { // Generates raw material every 10 seconds
                        bld.timer = 0;
                        bldData.rawReady = true; // Flag for UI harvest
                        if (typeof updateUI === 'function') updateUI();
                    }
                }
            }
        }
    }

    render(ctx) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.getTile(x, y);
                if (tile === 0) {
                    ctx.fillStyle = '#4caf50'; // grass
                } else if (tile === 1) {
                    ctx.fillStyle = '#2196f3'; // water
                }
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                // Draw tree
                const tree = this.trees.get(`${x},${y}`);
                if (tree) {
                    if (tree.state === 'grown') {
                        ctx.fillStyle = '#2e7d32'; // dark green for tree
                        ctx.beginPath();
                        ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (tree.state === 'sapling') {
                        ctx.fillStyle = '#8bc34a'; // light green for sapling
                        ctx.beginPath();
                        ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Draw buildings
                const bld = this.buildings.get(`${x},${y}`);
                if (bld) {
                    if (bld === 'storage') {
                        ctx.fillStyle = '#795548'; // brown box
                        ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        ctx.fillStyle = '#ffc107'; // gold lock/accent
                        ctx.fillRect(x * TILE_SIZE + TILE_SIZE/2 - 4, y * TILE_SIZE + TILE_SIZE/2 - 4, 8, 8);
                    } else if (bld === 'house') {
                        ctx.fillStyle = '#8d6e63'; // lighter brown
                        ctx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 10, TILE_SIZE - 8, TILE_SIZE - 10);
                        ctx.fillStyle = '#d84315'; // red roof
                        ctx.beginPath();
                        ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE + 10);
                        ctx.lineTo(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE);
                        ctx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + 10);
                        ctx.fill();
                    } else if (bld === 'factory' || bld.type === 'factory') {
                        ctx.fillStyle = '#607d8b'; // metal color
                        ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        ctx.fillStyle = '#e0e0e0';
                        ctx.fillRect(x * TILE_SIZE + TILE_SIZE/2 - 4, y * TILE_SIZE, 8, 10); // smokestack
                    } else if (bld === 'spaceport') {
                        ctx.fillStyle = '#37474f';
                        ctx.beginPath();
                        ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#00bcd4';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.lineWidth = 1;
                    }
                }
            }
        }
    }
}
