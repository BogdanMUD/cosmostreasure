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
        this.cacti = new Set(); // "x,y"
        this.storageWood = 0;
        this.storageRaw = 0;
        this.maxStorageWood = 30;
        this.hasStorage = false;
        this.roads = new Set();
        this.roadAnimProgress = new Map(); // "x,y" -> progress 0 to 1

        const perlinE = new PerlinNoise();
        const perlinM = new PerlinNoise();

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) / 2 - 2; // Leave a small border

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Check if inside circle
                const dx = x - centerX;
                const dy = y - centerY;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist > radius) {
                    this.tiles.push(-1); // Empty void outside circle
                    continue;
                }

                // Generate biomes with distinct borders
                // Scale noise to make big chunks
                const e = perlinE.octaveNoise(x, y, 2, 0.5, 0.02); // Elevation/Temperature
                const m = perlinM.octaveNoise(x + 100, y + 100, 2, 0.5, 0.02); // Moisture

                // e and m are roughly -1 to 1
                let type = 0; // grass

                // Very sharp thresholds for distinct biomes
                if (e > 0.3) {
                    // High mountains
                    if (e > 0.6) type = 4; // snow
                    else type = 3; // stone
                } else if (e < -0.3) {
                    type = 1; // water
                } else {
                    // Mid elevation
                    if (m > 0.2) type = 0; // grass
                    else type = 2; // desert
                }

                // Force spawn area to be grass
                if (x >= 10 && x <= 20 && y >= 10 && y <= 20) {
                    type = 0;
                }

                this.tiles.push(type);

                // Add objects
                if (type === 0 && Math.random() < 0.05 && dist < radius - 2) {
                    this.trees.set(`${x},${y}`, { state: 'grown' });
                } else if (type === 2 && Math.random() < 0.02 && dist < radius - 2) {
                    this.cacti.add(`${x},${y}`);
                }
            }
        }
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
        return this.tiles[y * this.width + x];
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        if (this.buildings.has(`${x},${y}`)) return false;
        if (this.cacti.has(`${x},${y}`)) return false;
        const tree = this.trees.get(`${x},${y}`);
        if (tree && tree.state === 'sapling') return false;

        const tileType = this.getTile(x, y);
        // Water(1), Mountain(3), Snow(4) are non-walkable
        if (tileType === 1 || tileType === 3 || tileType === 4 || tileType === -1) return false;

        return true;
    }

    isFlat(x, y, width = 1, height = 1) {
        for (let wy = 0; wy < height; wy++) {
            for (let wx = 0; wx < width; wx++) {
                if (this.getTile(x + wx, y + wy) === -1) return false;
            }
        }
        return true;
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

                    // Disable factory at night
                    const isNight = typeof gameTime !== 'undefined' && (gameTime < 7 || gameTime >= 19);
                    if (!isNight) {
                        bld.timer += dt;
                        if (bld.timer >= 10) { // Generates raw material every 10 seconds
                            bld.timer = 0;
                            bld.rawReady = true; // Flag for UI harvest
                            if (typeof updateUI === 'function') updateUI();
                        }
                    }
                }
            }
        }
    }

    render(ctx, entities = [], cameraBounds = null) {
        const tileW = 64;
        const tileH = 32;

        let startX = 0, startY = 0, endX = this.width, endY = this.height;

        if (cameraBounds) {
            // Add a buffer because mountains can stick up high and cast shadows
            startX = Math.max(0, Math.floor(cameraBounds.minX) - 10);
            startY = Math.max(0, Math.floor(cameraBounds.minY) - 10);
            endX = Math.min(this.width, Math.ceil(cameraBounds.maxX) + 10);
            // Increase bottom margin buffer significantly for tall mountains
            endY = Math.min(this.height, Math.ceil(cameraBounds.maxY) + 25);
        }

        // Z-Sorting Phase
        const renderables = [];

        // Add tiles as renderables so they depth-sort correctly with tall objects
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                renderables.push({
                    type: 'tile',
                    x, y,
                    depth: x + y
                });
            }
        }

        // Add trees
        for (const [key, tree] of this.trees.entries()) {
            const [x, y] = key.split(',').map(Number);
            if (x >= startX && x < endX && y >= startY && y < endY) {
                renderables.push({
                    type: 'tree',
                    x, y,
                    depth: x + y,
                    state: tree.state
                });
            }
        }

        // Add cacti
        for (const key of this.cacti) {
            const [x, y] = key.split(',').map(Number);
            if (x >= startX && x < endX && y >= startY && y < endY) {
                renderables.push({
                    type: 'cactus',
                    x, y,
                    depth: x + y
                });
            }
        }

        // Add buildings
        for (const [key, bldData] of this.buildings.entries()) {
            if (bldData && bldData.id === key) { // Only add anchor tiles
                const [x, y] = key.split(',').map(Number);
                if (x < startX - 5 || x > endX || y < startY - 5 || y > endY) continue; // cull

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
            let elev = 0; // Flat

            // Draw Shadows
            if (drawShadows) {
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';

                if (item.type === 'entity') {
                    ctx.beginPath();
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

            if (item.type === 'tile') {
                const tileType = this.getTile(item.x, item.y);
                if (tileType === -1) continue; // Don't draw void

                // isoToScreen now returns the exact center of the tile
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH);

                if (tileType === 0) ctx.fillStyle = '#4caf50'; // grass
                else if (tileType === 1) ctx.fillStyle = '#2196f3'; // water
                else if (tileType === 2) ctx.fillStyle = '#ffcc80'; // desert
                else if (tileType === 3) ctx.fillStyle = '#9e9e9e'; // stone
                else if (tileType === 4) ctx.fillStyle = '#ffffff'; // snow

                if (this.roads.has(`${item.x},${item.y}`)) {
                    ctx.fillStyle = '#795548'; // dirt road
                }

                ctx.beginPath();
                ctx.moveTo(screenPos.x, screenPos.y - tileH / 2); // Top tip
                ctx.lineTo(screenPos.x + tileW / 2, screenPos.y); // Right tip
                ctx.lineTo(screenPos.x, screenPos.y + tileH / 2); // Bottom tip
                ctx.lineTo(screenPos.x - tileW / 2, screenPos.y); // Left tip
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.stroke();

                // Draw road animation overlay if needed
                const roadProg = this.roadAnimProgress.get(`${item.x},${item.y}`);
                if (roadProg !== undefined && roadProg < 1) {
                    ctx.fillStyle = `rgba(255, 255, 0, ${1 - roadProg})`;
                    ctx.beginPath();
                    ctx.moveTo(screenPos.x, screenPos.y - tileH / 2); // Top tip
                    ctx.lineTo(screenPos.x + tileW / 2, screenPos.y); // Right tip
                    ctx.lineTo(screenPos.x, screenPos.y + tileH / 2); // Bottom tip
                    ctx.lineTo(screenPos.x - tileW / 2, screenPos.y); // Left tip
                    ctx.closePath();
                    ctx.fill();
                }
            } else if (item.type === 'entity') {
                item.entity.render(ctx);
            } else if (item.type === 'cactus') {
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH, elev);
                ctx.fillStyle = '#8bc34a'; // Light green cactus
                ctx.fillRect(screenPos.x - 4, screenPos.y - 15, 8, 15);
                ctx.fillStyle = '#33691e'; // Dark green details
                ctx.fillRect(screenPos.x - 4, screenPos.y - 10, 3, 5); // left arm
                ctx.fillRect(screenPos.x + 1, screenPos.y - 12, 3, 5); // right arm
            } else if (item.type === 'tree') {
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH);

                // Occlusion check
                let isOccluding = false;
                for (let e of entities) {
                    if (Math.round(e.x) === item.x && Math.round(e.y) === item.y) {
                        isOccluding = true;
                        break;
                    }
                }
                if (isOccluding) ctx.globalAlpha = 0.5;

                if (item.state === 'grown') {
                    // Tree trunk
                    ctx.fillStyle = '#5d4037';
                    ctx.fillRect(screenPos.x - 3, screenPos.y - 20, 6, 20);
                    // Tree leaves (2x taller than player)
                    ctx.fillStyle = '#2e7d32'; // dark green
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y - 30, 20, 0, Math.PI * 2);
                    ctx.fill();
                } else if (item.state === 'sapling') {
                    ctx.fillStyle = '#8bc34a'; // light green for sapling
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y - 5, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#5d4037';
                    ctx.fillRect(screenPos.x - 1, screenPos.y - 5, 2, 5);
                }
                ctx.globalAlpha = 1.0; // Reset
            } else if (item.type === 'building') {
                let bldType = item.bldType;
                if (typeof bldType === 'object') bldType = bldType.type;

                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH, elev);
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

                    const isNight = typeof gameTime !== 'undefined' && (gameTime < 7 || gameTime >= 19);
                    if (isNight) {
                        const time = Date.now() / 500;
                        const pulse = Math.abs(Math.sin(time));
                        ctx.fillStyle = `rgba(150, 150, 150, ${0.5 + pulse * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(centerX, isoBottom - 60 - pulse * 5, 10, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#000';
                        ctx.stroke();
                        ctx.fillStyle = '#fff';
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('⏳', centerX, isoBottom - 56 - pulse * 5);
                    } else if (item.bldType && item.bldType.rawReady) {
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
