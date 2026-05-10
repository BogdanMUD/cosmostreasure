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

    render(ctx, entities = []) {
        // Draw base tiles (grass, water, roads)
        const tileW = 64;
        const tileH = 32;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const screenPos = Engine.isoToScreen(x, y, tileW, tileH);

                const tile = this.getTile(x, y);
                if (tile === 0) {
                    ctx.fillStyle = '#4caf50'; // grass
                } else if (tile === 1) {
                    ctx.fillStyle = '#2196f3'; // water
                }

                if (this.roads.has(`${x},${y}`)) {
                    ctx.fillStyle = '#9e9e9e'; // road color
                }

                // Draw rhombus
                ctx.beginPath();
                ctx.moveTo(screenPos.x, screenPos.y - tileH / 2); // Top
                ctx.lineTo(screenPos.x + tileW / 2, screenPos.y); // Right
                ctx.lineTo(screenPos.x, screenPos.y + tileH / 2); // Bottom
                ctx.lineTo(screenPos.x - tileW / 2, screenPos.y); // Left
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.stroke();

                // Draw road animation overlay if needed
                const roadProg = this.roadAnimProgress.get(`${x},${y}`);
                if (roadProg !== undefined && roadProg < 1) {
                    ctx.fillStyle = `rgba(255, 255, 0, ${1 - roadProg})`;
                    ctx.beginPath();
                    ctx.moveTo(screenPos.x, screenPos.y - tileH / 2);
                    ctx.lineTo(screenPos.x + tileW / 2, screenPos.y);
                    ctx.lineTo(screenPos.x, screenPos.y + tileH / 2);
                    ctx.lineTo(screenPos.x - tileW / 2, screenPos.y);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }

        // Z-Sorting Phase
        const renderables = [];

        // Add trees
        for (const [key, tree] of this.trees.entries()) {
            const [x, y] = key.split(',').map(Number);
            renderables.push({
                type: 'tree',
                x, y,
                depth: x + y,
                state: tree.state
            });
        }

        // Add buildings
        for (const [key, bldData] of this.buildings.entries()) {
            if (bldData && bldData.id === key) { // Only add anchor tiles
                const [x, y] = key.split(',').map(Number);
                const w = bldData.width || 1;
                const h = bldData.height || 1;

                // For a multi-tile building, the depth should be based on its most forward tile
                // which is x + w - 1 and y + h - 1
                const depth = (x + w - 1) + (y + h - 1);

                renderables.push({
                    type: 'building',
                    x, y, w, h,
                    depth: depth,
                    bldType: bldData.type
                });
            }
        }

        // Add entities
        for (const entity of entities) {
            renderables.push({
                type: 'entity',
                x: entity.x,
                y: entity.y,
                depth: entity.x + entity.y,
                entity: entity
            });
        }

        // Sort by depth
        renderables.sort((a, b) => a.depth - b.depth);

        // Dynamic Shadows calculation
        // Shadow angle changes from 07:00 (-1) to 19:00 (1). 12:00 is 0.
        // It's accessible via the global `gameTime`.
        let shadowAngleX = 0;
        let shadowLength = 0;
        let drawShadows = false;
        if (typeof gameTime !== 'undefined') {
            if (gameTime >= 7 && gameTime <= 19) {
                drawShadows = true;
                // At 7:00, progress is -1. At 13:00, 0. At 19:00, 1.
                let progress = ((gameTime - 7) / 12) * 2 - 1;
                shadowAngleX = progress * 60; // Max 60 pixels horizontal shift
                shadowLength = Math.abs(progress) * 0.5 + 0.2; // Min length at noon, longer at morning/evening
            }
        }

        // Render sorted objects
        for (const item of renderables) {
            // Draw Shadows
            if (drawShadows) {
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';

                if (item.type === 'entity') {
                    ctx.beginPath();
                    // Elipse skewed by shadow angle
                    ctx.ellipse(screenPos.x + shadowAngleX * 0.5, screenPos.y, 8, 4 * shadowLength, 0, 0, Math.PI * 2);
                    ctx.fill();
                } else if (item.type === 'tree') {
                    ctx.beginPath();
                    ctx.moveTo(screenPos.x, screenPos.y);
                    ctx.lineTo(screenPos.x + shadowAngleX * 0.8, screenPos.y - 15 * shadowLength);
                    ctx.lineTo(screenPos.x + shadowAngleX * 1.2, screenPos.y - 5 * shadowLength);
                    ctx.fill();
                } else if (item.type === 'building') {
                    const endScreenPos = Engine.isoToScreen(item.x + item.w - 1, item.y + item.h - 1, tileW, tileH);
                    const centerX = (screenPos.x + endScreenPos.x) / 2;
                    const centerY = (screenPos.y + endScreenPos.y) / 2;
                    const isoBottom = centerY + tileH/2;

                    ctx.beginPath();
                    ctx.moveTo(centerX - 20, isoBottom);
                    ctx.lineTo(centerX + shadowAngleX, isoBottom - 30 * shadowLength);
                    ctx.lineTo(centerX + 20 + shadowAngleX, isoBottom - 30 * shadowLength);
                    ctx.lineTo(centerX + 20, isoBottom);
                    ctx.fill();
                }
            }

            if (item.type === 'entity') {
                item.entity.render(ctx);
            } else if (item.type === 'tree') {
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH);
                if (item.state === 'grown') {
                    ctx.fillStyle = '#2e7d32'; // dark green for tree
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y - 10, 12, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#5d4037';
                    ctx.fillRect(screenPos.x - 2, screenPos.y - 10, 4, 10);
                } else if (item.state === 'sapling') {
                    ctx.fillStyle = '#8bc34a'; // light green for sapling
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y - 5, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#5d4037';
                    ctx.fillRect(screenPos.x - 1, screenPos.y - 5, 2, 5);
                }
            } else if (item.type === 'building') {
                let bldType = item.bldType;
                if (typeof bldType === 'object') bldType = bldType.type;

                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH);
                const endScreenPos = Engine.isoToScreen(item.x + item.w - 1, item.y + item.h - 1, tileW, tileH);
                const centerX = (screenPos.x + endScreenPos.x) / 2;
                const centerY = (screenPos.y + endScreenPos.y) / 2;
                const isoBottom = centerY + tileH/2;

                if (bldType === 'storage') {
                    ctx.fillStyle = '#795548'; // brown box
                    ctx.fillRect(centerX - 12, isoBottom - 24, 24, 24);
                    ctx.fillStyle = '#ffc107'; // gold lock/accent
                    ctx.fillRect(centerX - 4, isoBottom - 12, 8, 8);
                } else if (bldType === 'house') {
                    ctx.fillStyle = '#8d6e63'; // lighter brown
                    ctx.fillRect(centerX - 20, isoBottom - 30, 40, 30);
                    ctx.fillStyle = '#d84315'; // red roof
                    ctx.beginPath();
                    ctx.moveTo(centerX - 24, isoBottom - 30);
                    ctx.lineTo(centerX, isoBottom - 45);
                    ctx.lineTo(centerX + 24, isoBottom - 30);
                    ctx.fill();

                    // Draw Zzz if night, not raining, and has sleeping NPCs
                    const isNight = typeof gameTime !== 'undefined' && (gameTime < 7 || gameTime >= 19);
                    const isBadWeather = typeof weatherState !== 'undefined' && weatherState === 'rain';
                    if (isNight && !isBadWeather && typeof npcs !== 'undefined') {
                        // Check if any npc is sleeping at this house
                        let hasSleeper = false;
                        for (let npc of npcs) {
                            if (npc.isSleeping && npc.homePos.x === item.x && npc.homePos.y === item.y) {
                                hasSleeper = true;
                                break;
                            }
                        }

                        if (hasSleeper) {
                            const time = Date.now() / 500;
                            const bounce = Math.abs(Math.sin(time)) * 5;
                            ctx.fillStyle = 'white';
                            ctx.font = 'bold 16px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('Zzz', centerX, isoBottom - 50 - bounce);
                        }
                    }
                } else if (bldType === 'factory') {
                    ctx.fillStyle = '#607d8b'; // metal color
                    ctx.fillRect(centerX - 30, isoBottom - 40, 60, 40);
                    ctx.fillStyle = '#e0e0e0';
                    ctx.fillRect(centerX - 10, isoBottom - 55, 10, 15); // smokestack

                    if (item.bldType.rawReady) {
                        const time = Date.now() / 300;
                        const pulse = Math.abs(Math.sin(time));
                        ctx.fillStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(centerX, isoBottom - 60 - pulse * 10, 8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#000';
                        ctx.stroke();
                    }
                } else if (bldType === 'spaceport') {
                    ctx.fillStyle = '#37474f';
                    ctx.beginPath();
                    ctx.arc(centerX, isoBottom - 20, 30, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#00bcd4';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.lineWidth = 1;

                    // draw rocket
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(centerX - 5, isoBottom - 50, 10, 30);
                    ctx.fillStyle = '#f44336';
                    ctx.beginPath();
                    ctx.moveTo(centerX - 5, isoBottom - 50);
                    ctx.lineTo(centerX, isoBottom - 65);
                    ctx.lineTo(centerX + 5, isoBottom - 50);
                    ctx.fill();
                }
            }
        }
    }
}
