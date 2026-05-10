// entities.js

class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.speed = 3; // tiles per second
        this.path = [];
    }

    setPath(path) {
        if (path && path.length > 0) {
            this.path = path;
            // The first node is usually the current position, so skip it if needed
            if (this.path[0].x === Math.round(this.x) && this.path[0].y === Math.round(this.y)) {
                this.path.shift();
            }
            if (this.path.length > 0) {
                this.targetX = this.path[0].x;
                this.targetY = this.path[0].y;
            }
        }
    }

    update(dt) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 0.05) {
            const move = Math.min(this.speed * dt, dist);
            this.x += (dx / dist) * move;
            this.y += (dy / dist) * move;
            this.checkAutoDeposit();
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
            this.checkAutoDeposit();

            // Arrived at current target, move to next in path
            if (this.path.length > 0) {
                this.path.shift();
                if (this.path.length > 0) {
                    this.targetX = this.path[0].x;
                    this.targetY = this.path[0].y;
                }
            } else {
                this.onReachDestination();
            }
        }
    }

    checkAutoDeposit() {
        if (this.inventory && this.inventory.wood > 0 && this.mapRef && this.mapRef.hasStorage && this.mapRef.storagePos) {
            const dx = Math.abs(this.x - this.mapRef.storagePos.x);
            const dy = Math.abs(this.y - this.mapRef.storagePos.y);
            // If within 1.5 tiles distance, deposit wood
            if (Math.sqrt(dx*dx + dy*dy) < 1.5) {
                this.mapRef.storageWood += this.inventory.wood;
                this.inventory.wood = 0;
                if (typeof updateUI === 'function') updateUI();
            }
        }
    }

    onReachDestination() {
        // override
    }

    render(ctx) {
        // override
    }
}

class NPC extends Entity {
    constructor(x, y, mapRef, profession) {
        super(x, y);
        this.mapRef = mapRef;
        this.profession = profession; // 'lumberjack' or 'agronomist' or 'idle'
        this.inventory = { wood: 0 };
        this.maxInventory = 5;
        this.speed = 3;
        this.state = 'idle';
        this.timer = 0;
    }

    update(dt) {
        super.update(dt);
        if (this.path.length === 0) {
            this.think(dt);
        }
    }

    think(dt) {
        this.timer -= dt;
        if (this.timer > 0) return;
        this.timer = 1; // Think every second

        if (this.profession === 'lumberjack') {
            if (this.inventory.wood >= this.maxInventory) {
                // Deposit to storage
                if (this.mapRef.hasStorage) {
                    const startX = Math.round(this.x);
                    const startY = Math.round(this.y);
                    const path = AStar.findPath(this.mapRef, startX, startY, this.mapRef.storagePos.x, this.mapRef.storagePos.y, true);
                    if (path) this.setPath(path);
                }
            } else {
                // Find a tree
                let closestTree = null;
                let minDist = Infinity;
                for (const [key, tree] of this.mapRef.trees.entries()) {
                    if (tree.state === 'grown') {
                        const [tx, ty] = key.split(',').map(Number);
                        const dist = Math.abs(this.x - tx) + Math.abs(this.y - ty);
                        if (dist < minDist) {
                            // Check if path exists
                            const startX = Math.round(this.x);
                            const startY = Math.round(this.y);
                            const path = AStar.findPath(this.mapRef, startX, startY, tx, ty, true);
                            if (path) {
                                minDist = dist;
                                closestTree = { x: tx, y: ty, path: path };
                            }
                        }
                    }
                }

                if (closestTree) {
                    this.setPath(closestTree.path);
                    this.targetTree = closestTree;
                }
            }
        } else if (this.profession === 'agronomist') {
            // Find empty spot near forest to plant
            // Simple logic: pick random walkable tile and plant if it doesn't have a tree nearby
            if (Math.random() < 0.2) {
                const rx = Math.floor(Math.random() * this.mapRef.width);
                const ry = Math.floor(Math.random() * this.mapRef.height);
                if (this.mapRef.isWalkable(rx, ry) && !this.mapRef.trees.has(`${rx},${ry}`)) {
                    const startX = Math.round(this.x);
                    const startY = Math.round(this.y);
                    const path = AStar.findPath(this.mapRef, startX, startY, rx, ry);
                    if (path) {
                        this.setPath(path);
                        this.targetPlantSpot = { x: rx, y: ry };
                    }
                }
            }
        }
    }

    onReachDestination() {
        if (this.profession === 'lumberjack' && this.targetTree) {
            const dx = Math.abs(this.x - this.targetTree.x);
            const dy = Math.abs(this.y - this.targetTree.y);
            if (dx <= 1 && dy <= 1) {
                const treeKey = `${this.targetTree.x},${this.targetTree.y}`;
                const tree = this.mapRef.trees.get(treeKey);
                if (tree && tree.state === 'grown') {
                    this.mapRef.trees.set(treeKey, { state: 'growing', timer: 10 });
                    this.inventory.wood += 1;
                }
            }
            this.targetTree = null;
        } else if (this.profession === 'agronomist' && this.targetPlantSpot) {
            const dx = Math.abs(this.x - this.targetPlantSpot.x);
            const dy = Math.abs(this.y - this.targetPlantSpot.y);
            if (dx <= 1 && dy <= 1) {
                const spotKey = `${this.targetPlantSpot.x},${this.targetPlantSpot.y}`;
                if (this.mapRef.isWalkable(this.targetPlantSpot.x, this.targetPlantSpot.y) && !this.mapRef.trees.has(spotKey)) {
                     this.mapRef.trees.set(spotKey, { state: 'growing', timer: 10 });
                }
            }
            this.targetPlantSpot = null;
        }
    }

    render(ctx) {
        ctx.fillStyle = this.profession === 'lumberjack' ? '#f44336' : (this.profession === 'agronomist' ? '#8bc34a' : '#9e9e9e');
        ctx.beginPath();
        ctx.arc(this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }
}

class Leader extends Entity {
    constructor(x, y, mapRef) {
        super(x, y);
        this.mapRef = mapRef;
        this.inventory = { wood: 0 };
        this.maxInventory = 10;
        this.speed = 5;
        this.actionQueue = null;
        this.learnedSkills = new Set(['chop']); // Starts with chop
    }

    onReachDestination() {
        if (this.actionQueue) {
            const action = this.actionQueue;
            this.actionQueue = null;

            if (action.type === 'chop') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                // Check if adjacent or on the same tile
                if (dx <= 1 && dy <= 1) {
                    const treeKey = `${action.x},${action.y}`;
                    const tree = this.mapRef.trees.get(treeKey);
                    if (tree && tree.state === 'grown') {
                        if (this.inventory.wood < this.maxInventory) {
                            // Chop the tree
                            this.mapRef.trees.set(treeKey, { state: 'growing', timer: 10 });
                            this.inventory.wood += 1;
                            updateUI(); // Function from main.js
                        } else {
                            console.log("Inventory full!");
                        }
                    }
                }
            } else if (action.type === 'build_storage') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    if (this.inventory.wood >= 10 && !this.mapRef.hasStorage) {
                        this.inventory.wood -= 10;
                        this.mapRef.buildings.set(`${action.x},${action.y}`, 'storage');
                        this.mapRef.hasStorage = true;
                        this.mapRef.storagePos = { x: action.x, y: action.y };
                        updateUI();
                    }
                }
            } else if (action.type === 'build_house') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    if (this.mapRef.storageWood >= 15) {
                        this.mapRef.storageWood -= 15;
                        this.mapRef.buildings.set(`${action.x},${action.y}`, 'house');
                        updateUI();

                        // Spawn 2 NPCs
                        for (let i = 0; i < 2; i++) {
                            // Assign profession based on leader's learned skills
                            let profession = 'lumberjack';
                            if (this.learnedSkills.has('plant') && Math.random() < 0.5) {
                                profession = 'agronomist';
                            }
                            // Call a global function or event to add NPC. We'll assume a global `npcs` array exists in main.js
                            if (typeof npcs !== 'undefined') {
                                npcs.push(new NPC(action.x, action.y, this.mapRef, profession));
                            }
                        }
                    }
                }
            } else if (action.type === 'plant') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    const spotKey = `${action.x},${action.y}`;
                    if (this.mapRef.isWalkable(action.x, action.y) && !this.mapRef.trees.has(spotKey)) {
                         this.mapRef.trees.set(spotKey, { state: 'growing', timer: 10 });
                    }
                }
            } else if (action.type === 'build_factory') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    if (this.mapRef.storageWood >= 30) {
                        this.mapRef.storageWood -= 30;
                        this.mapRef.buildings.set(`${action.x},${action.y}`, { type: 'factory', timer: 0 });
                        updateUI();
                    }
                }
            } else if (action.type === 'build_spaceport') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    if (this.mapRef.storageWood >= 50) {
                        this.mapRef.storageWood -= 50;
                        this.mapRef.buildings.set(`${action.x},${action.y}`, 'spaceport');
                        updateUI();
                    }
                }
            } else if (action.type === 'build_rocket') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    if (this.mapRef.storageWood >= 100) {
                        this.mapRef.storageWood -= 100;
                        updateUI();
                        // Trigger Win Condition
                        document.getElementById('win-screen').classList.remove('hidden');
                        if (typeof saveGame === 'function') saveGame();
                    }
                }
            }
        }
    }

    render(ctx) {
        ctx.fillStyle = '#ff9800'; // Orange leader
        ctx.beginPath();
        ctx.arc(this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }
}
