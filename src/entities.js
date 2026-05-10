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
        if (this.inventory && (this.inventory.wood > 0 || this.inventory.raw > 0) && this.mapRef && this.mapRef.hasStorage && this.mapRef.storagePos) {
            const dx = Math.abs(this.x - this.mapRef.storagePos.x);
            const dy = Math.abs(this.y - this.mapRef.storagePos.y);
            // If within 2.5 tiles distance to account for 2x2 storage
            if (Math.sqrt(dx*dx + dy*dy) < 2.5) {
                if (this.inventory.wood > 0 && this.mapRef.storageWood < this.mapRef.maxStorageWood) {
                    const space = this.mapRef.maxStorageWood - this.mapRef.storageWood;
                    const dep = Math.min(space, this.inventory.wood);
                    this.mapRef.storageWood += dep;
                    this.inventory.wood -= dep;
                }
                if (this.inventory.raw > 0) {
                    this.mapRef.storageRaw = (this.mapRef.storageRaw || 0) + this.inventory.raw;
                    this.inventory.raw = 0;
                }
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
    constructor(x, y, mapRef, profession, homePos) {
        super(x, y);
        this.mapRef = mapRef;
        this.profession = profession; // 'lumberjack' or 'agronomist' or 'idle'
        this.inventory = { wood: 0, raw: 0 };
        this.maxInventory = 5;
        this.speed = 3;
        this.state = 'idle';
        this.timer = 0;
        this.homePos = homePos || { x, y }; // Where they sleep
        this.isSleeping = false;
    }

    update(dt) {
        if (!this.isSleeping) {
            super.update(dt);
        }
        if (this.path.length === 0) {
            this.think(dt);
        }
    }

    think(dt) {
        this.timer -= dt;
        if (this.timer > 0) return;
        this.timer = 1; // Think every second

        // Weather/Night behavior
        const isNight = gameTime < 7 || gameTime >= 19;
        const isBadWeather = typeof weatherState !== 'undefined' && weatherState === 'rain';
        const shouldShelter = isNight || isBadWeather;

        if (shouldShelter) {
            // Need to drop off items first
            if (this.inventory.wood > 0 && this.mapRef.hasStorage && (this.state !== 'going_home' && this.state !== 'depositing')) {
                const startX = Math.round(this.x);
                const startY = Math.round(this.y);
                const path = AStar.findPath(this.mapRef, startX, startY, this.mapRef.storagePos.x, this.mapRef.storagePos.y, true);
                if (path) {
                    this.setPath(path);
                    this.state = 'depositing';
                }
            } else if (this.inventory.wood === 0 || !this.mapRef.hasStorage) {
                // Go home
                const dx = Math.abs(this.x - this.homePos.x);
                const dy = Math.abs(this.y - this.homePos.y);
                if (dx <= 1 && dy <= 1) {
                    this.isSleeping = true;
                } else if (this.state !== 'going_home') {
                    const startX = Math.round(this.x);
                    const startY = Math.round(this.y);
                    const path = AStar.findPath(this.mapRef, startX, startY, this.homePos.x, this.homePos.y, true);
                    if (path) {
                        this.setPath(path);
                        this.state = 'going_home';
                    }
                }
            }
            return; // Skip normal logic
        } else {
            // Wake up
            if (this.isSleeping) {
                this.isSleeping = false;
                this.state = 'idle';
            }
        }

        if (this.profession === 'lumberjack') {
            if (!this.mapRef.claimedTrees) this.mapRef.claimedTrees = new Set();

            if (this.mapRef.hasStorage && this.mapRef.storageWood >= this.mapRef.maxStorageWood) {
                // Storage is full, wander around
                if (Math.random() < 0.5) {
                    const rx = Math.floor(Math.random() * this.mapRef.width);
                    const ry = Math.floor(Math.random() * this.mapRef.height);
                    if (this.mapRef.isWalkable(rx, ry)) {
                        const path = AStar.findPath(this.mapRef, Math.round(this.x), Math.round(this.y), rx, ry);
                        if (path) this.setPath(path);
                    }
                }
                return;
            }

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
                    if (tree.state === 'grown' && !this.mapRef.claimedTrees.has(key)) {
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
                    this.mapRef.claimedTrees.add(`${closestTree.x},${closestTree.y}`);
                    this.setPath(closestTree.path);
                    this.targetTree = closestTree;
                }
            }
        }
    }

    onReachDestination() {
        if (this.state === 'depositing') {
            const dx = Math.abs(this.x - this.mapRef.storagePos.x);
            const dy = Math.abs(this.y - this.mapRef.storagePos.y);
            if (dx <= 1 && dy <= 1) {
                // Deposit up to max capacity
                if (this.mapRef.storageWood < this.mapRef.maxStorageWood) {
                    const space = this.mapRef.maxStorageWood - this.mapRef.storageWood;
                    const depositWood = Math.min(space, this.inventory.wood);
                    this.mapRef.storageWood += depositWood;
                    this.inventory.wood -= depositWood;
                }
                updateUI();
                const startX = Math.round(this.x);
                const startY = Math.round(this.y);
                const path = AStar.findPath(this.mapRef, startX, startY, this.homePos.x, this.homePos.y, true);
                if (path) {
                    this.setPath(path);
                    this.state = 'going_home'; // Then go home
                }
            }
        } else if (this.state === 'going_home') {
            const dx = Math.abs(this.x - this.homePos.x);
            const dy = Math.abs(this.y - this.homePos.y);
            if (dx <= 1 && dy <= 1) {
                this.isSleeping = true;
            }
        }

        if (this.profession === 'lumberjack' && this.targetTree) {
            const dx = Math.abs(this.x - this.targetTree.x);
            const dy = Math.abs(this.y - this.targetTree.y);
            if (dx <= 1 && dy <= 1) {
                const treeKey = `${this.targetTree.x},${this.targetTree.y}`;
                const tree = this.mapRef.trees.get(treeKey);
                if (tree && tree.state === 'grown') {
                    // Only chop if storage isn't full, otherwise just stand there or we wander
                    if (!this.mapRef.hasStorage || this.mapRef.storageWood < this.mapRef.maxStorageWood) {
                        this.mapRef.trees.set(treeKey, { state: 'sapling', timer: 30 });
                        this.inventory.wood += 1;
                    }
                }
            }
            // Release claim
            if (this.targetTree && this.mapRef.claimedTrees) {
                this.mapRef.claimedTrees.delete(`${this.targetTree.x},${this.targetTree.y}`);
            }
            this.targetTree = null;
        } else if (this.profession === 'lumberjack' && this.inventory.wood > 0 && this.mapRef.hasStorage) {
            const dx = Math.abs(this.x - this.mapRef.storagePos.x);
            const dy = Math.abs(this.y - this.mapRef.storagePos.y);
            if (dx <= 1 && dy <= 1) {
                // Deposit up to max capacity
                if (this.mapRef.storageWood < this.mapRef.maxStorageWood) {
                    const space = this.mapRef.maxStorageWood - this.mapRef.storageWood;
                    const depositWood = Math.min(space, this.inventory.wood);
                    this.mapRef.storageWood += depositWood;
                    this.inventory.wood -= depositWood;
                }
                updateUI();
            }
        }
    }

    render(ctx) {
        if (this.isSleeping) return; // Don't draw if sleeping in a house
        const screenPos = Engine.isoToScreen(this.x, this.y, 64, 32);
        ctx.fillStyle = this.profession === 'lumberjack' ? '#f44336' : (this.profession === 'agronomist' ? '#8bc34a' : '#9e9e9e');
        ctx.beginPath();
        // Shift up slightly to stand on the tile
        ctx.arc(screenPos.x, screenPos.y - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }
}

class Leader extends Entity {
    constructor(x, y, mapRef) {
        super(x, y);
        this.mapRef = mapRef;
        this.inventory = { wood: 0, raw: 0 };
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
                            this.mapRef.trees.set(treeKey, { state: 'sapling', timer: 30 });
                            this.inventory.wood += 1;
                            updateUI(); // Function from main.js
                        } else {
                            console.log("Inventory full!");
                        }
                    }
                }
            } else if (action.type.startsWith('build_') && action.type !== 'build_rocket') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    let cost = 0;
                    let canAfford = false;
                    let typeRaw = action.type.replace('build_', '');

                    if (typeRaw === 'storage' && this.inventory.wood >= 10 && !this.mapRef.hasStorage) {
                        this.inventory.wood -= 10;
                        canAfford = true;
                        this.mapRef.hasStorage = true;
                        this.mapRef.storagePos = { x: action.x, y: action.y };
                    } else if (typeRaw === 'house' && this.mapRef.storageWood >= 15) {
                        this.mapRef.storageWood -= 15;
                        canAfford = true;
                    } else if (typeRaw === 'factory' && this.mapRef.storageWood >= 30) {
                        this.mapRef.storageWood -= 30;
                        canAfford = true;
                    } else if (typeRaw === 'spaceport' && this.mapRef.storageWood >= 50 && this.inventory.raw >= 10) {
                        this.mapRef.storageWood -= 50;
                        this.inventory.raw -= 10;
                        canAfford = true;
                    } else if (typeRaw === 'spaceport' && this.mapRef.storageWood >= 50 && typeof this.inventory.raw === 'undefined') {
                        // fallback if raw cost isn't enforced strictly here
                        this.mapRef.storageWood -= 50;
                        canAfford = true;
                    }

                    if (canAfford) {
                        const anchorId = `${action.x},${action.y}`;
                        const bldObj = {
                            id: anchorId,
                            type: typeRaw === 'factory' ? { type: 'factory', timer: 0 } : typeRaw,
                            width: action.width || 1,
                            height: action.height || 1
                        };

                        // Reserve all tiles
                        for (let wy = 0; wy < bldObj.height; wy++) {
                            for (let wx = 0; wx < bldObj.width; wx++) {
                                this.mapRef.buildings.set(`${action.x + wx},${action.y + wy}`, bldObj);
                            }
                        }
                        updateUI();

                        if (typeRaw === 'house') {
                            // Spawn 2 NPCs
                            for (let i = 0; i < 2; i++) {
                                let profession = 'lumberjack';
                                if (this.learnedSkills.has('plant') && Math.random() < 0.5) {
                                    profession = 'agronomist';
                                }
                                if (typeof npcs !== 'undefined') {
                                    npcs.push(new NPC(action.x, action.y, this.mapRef, profession, { x: action.x, y: action.y }));
                                }
                            }
                        }

                        if (typeof generateRoads === 'function') generateRoads();
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
            } else if (action.type === 'harvest_raw') {
                const [ax, ay] = action.anchor.split(',').map(Number);
                const dx = Math.abs(this.x - ax);
                const dy = Math.abs(this.y - ay);
                // Harvest from anywhere adjacent to the multi-tile factory
                // Assuming max distance is roughly 3 since factory is 3x3
                if (dx <= 3 && dy <= 3) {
                    const bldData = this.mapRef.buildings.get(action.anchor);
                    if (bldData && bldData.type && bldData.type.type === 'factory' && bldData.type.rawReady) {
                        if (this.inventory.raw < this.maxInventory) {
                            bldData.type.rawReady = false;
                            this.inventory.raw += 1;
                            updateUI();
                        }
                    }
                }
            } else if (action.type === 'destroy_building') {
                const [ax, ay] = action.anchor.split(',').map(Number);
                const dx = Math.abs(this.x - ax);
                const dy = Math.abs(this.y - ay);
                if (dx <= 5 && dy <= 5) {
                    const bldData = this.mapRef.buildings.get(action.anchor);
                    if (bldData) {
                        const w = bldData.width || 1;
                        const h = bldData.height || 1;
                        let bldType = bldData.type;
                        if (typeof bldType === 'object') bldType = bldType.type;

                        if (bldType === 'storage') this.mapRef.hasStorage = false;

                        for (let wy = 0; wy < h; wy++) {
                            for (let wx = 0; wx < w; wx++) {
                                this.mapRef.buildings.delete(`${ax + wx},${ay + wy}`);
                            }
                        }
                        updateUI();
                    }
                }
            } else if (action.type === 'uproot') {
                const dx = Math.abs(this.x - action.x);
                const dy = Math.abs(this.y - action.y);
                if (dx <= 1 && dy <= 1) {
                    this.mapRef.trees.delete(`${action.x},${action.y}`);
                }
            }
        }
    }

    render(ctx) {
        const screenPos = Engine.isoToScreen(this.x, this.y, 64, 32);
        ctx.fillStyle = '#ff9800'; // Orange leader
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y - 15, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }
}
