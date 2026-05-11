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
        this.elevations = new Float32Array((this.width + 1) * (this.height + 1));

        const perlinE = new PerlinNoise();
        const perlinM = new PerlinNoise();

        // Generate vertex elevations
        for (let y = 0; y <= this.height; y++) {
            for (let x = 0; x <= this.width; x++) {
                // Base noise for mountains
                let e = perlinE.octaveNoise(x, y, 4, 0.5, 0.03);
                // Shift range to roughly 0-1
                e = (e + 1) / 2;

                let h = 0;
                if (e > 0.6) {
                    // Mountain slope
                    h = (e - 0.6) * 10;
                } else {
                    // Small rolling hills
                    h = e * 1.5;
                }

                // Force edges to be water (low elevation)
                const distToEdgeX = Math.min(x, this.width - x);
                const distToEdgeY = Math.min(y, this.height - y);
                const minDist = Math.min(distToEdgeX, distToEdgeY);
                if (minDist < 5) {
                    h -= (5 - minDist) * 0.5;
                }

                // Flatten out negative heights
                if (h < 0.2) h = 0;

                this.elevations[y * (this.width + 1) + x] = h;
            }
        }

        // Generate tiles based on vertex elevation and moisture
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const hTl = this.elevations[y * (this.width + 1) + x];
                const hTr = this.elevations[y * (this.width + 1) + (x + 1)];
                const hBl = this.elevations[(y + 1) * (this.width + 1) + x];
                const hBr = this.elevations[(y + 1) * (this.width + 1) + (x + 1)];

                const avgH = (hTl + hTr + hBl + hBr) / 4;
                const m = (perlinM.octaveNoise(x, y, 3, 0.5, 0.05) + 1) / 2; // Moisture 0-1

                let type = 0; // Grass default

                if (avgH <= 0.1) {
                    type = 1; // Water
                } else if (avgH > 2.5) {
                    type = 4; // Snow peak
                } else if (avgH > 1.2) {
                    type = 3; // Stone mountain
                } else {
                    if (m < 0.4) {
                        type = 2; // Desert
                    } else {
                        type = 0; // Grass
                    }
                }

                this.tiles.push(type);

                // Spawn objects
                if (type === 0 && avgH > 0.1) {
                    // Trees on grass
                    if (Math.random() < 0.05) {
                        this.trees.set(`${x},${y}`, { state: 'grown' });
                    }
                } else if (type === 2 && avgH > 0.1) {
                    // Cactus on desert
                    if (Math.random() < 0.02) {
                        this.cacti.add(`${x},${y}`);
                    }
                }
            }
        }

        // Ensure starting area is flat and grass for player to spawn
        for (let y = 10; y <= 20; y++) {
            for (let x = 10; x <= 20; x++) {
                this.elevations[y * (this.width + 1) + x] = 0.2;
                if (y < this.height && x < this.width) {
                    this.tiles[y * this.width + x] = 0;
                    this.cacti.delete(`${x},${y}`);
                }
            }
        }
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
        return this.tiles[y * this.width + x];
    }

    getElevation(x, y) {
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > this.width) x = this.width;
        if (y > this.height) y = this.height;
        return this.elevations[y * (this.width + 1) + x];
    }

    getTileElevation(x, y) {
        const tl = this.getElevation(x, y);
        const tr = this.getElevation(x+1, y);
        const bl = this.getElevation(x, y+1);
        const br = this.getElevation(x+1, y+1);
        return (tl + tr + bl + br) / 4;
    }

    isWalkable(x, y, fromX = null, fromY = null) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        if (this.buildings.has(`${x},${y}`)) return false;
        if (this.cacti.has(`${x},${y}`)) return false;
        const tree = this.trees.get(`${x},${y}`);
        if (tree && tree.state === 'sapling') return false;

        const tileType = this.getTile(x, y);
        // Water(1), Mountain(3), Snow(4) are non-walkable
        if (tileType === 1 || tileType === 3 || tileType === 4) return false;

        if (fromX !== null && fromY !== null) {
            const currentElev = this.getTileElevation(fromX, fromY);
            const targetElev = this.getTileElevation(x, y);
            // Can't jump up or down a cliff > 0.5
            if (Math.abs(currentElev - targetElev) > 0.5) return false;
        }

        return true;
    }

    isFlat(x, y, width = 1, height = 1) {
        let minE = Infinity;
        let maxE = -Infinity;
        for (let wy = 0; wy <= height; wy++) {
            for (let wx = 0; wx <= width; wx++) {
                const e = this.getElevation(x + wx, y + wy);
                if (e < minE) minE = e;
                if (e > maxE) maxE = e;
            }
        }
        return (maxE - minE) <= 0.1;
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
            let elev = 0;
            if (item.type !== 'tile' && item.type !== 'building') {
                elev = this.getTileElevation(item.x, item.y);
            }
            if (item.type === 'building') {
                elev = this.getTileElevation(item.x + item.w/2, item.y + item.h/2);
            }

            // Draw Shadows
            if (drawShadows) {
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH, elev);
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

            if (item.type === 'tile') {
                const hTl = this.getElevation(item.x, item.y);
                const hTr = this.getElevation(item.x + 1, item.y);
                const hBl = this.getElevation(item.x, item.y + 1);
                const hBr = this.getElevation(item.x + 1, item.y + 1);

                const pTl = Engine.isoToScreen(item.x, item.y, tileW, tileH, hTl);
                // The right corner is gridX+1, gridY
                const pTr = Engine.isoToScreen(item.x + 1, item.y, tileW, tileH, hTr);
                // The bottom corner is gridX+1, gridY+1
                const pBr = Engine.isoToScreen(item.x + 1, item.y + 1, tileW, tileH, hBr);
                // The left corner is gridX, gridY+1
                const pBl = Engine.isoToScreen(item.x, item.y + 1, tileW, tileH, hBl);

                const tileType = this.getTile(item.x, item.y);
                if (tileType === 0) ctx.fillStyle = '#4caf50'; // grass
                else if (tileType === 1) ctx.fillStyle = '#2196f3'; // water
                else if (tileType === 2) ctx.fillStyle = '#ffcc80'; // desert
                else if (tileType === 3) ctx.fillStyle = '#9e9e9e'; // stone
                else if (tileType === 4) ctx.fillStyle = '#ffffff'; // snow

                if (this.roads.has(`${item.x},${item.y}`)) {
                    ctx.fillStyle = '#795548'; // dirt road
                }

                ctx.beginPath();
                ctx.moveTo(pTl.x, pTl.y); // Top
                ctx.lineTo(pTr.x, pTr.y); // Right
                ctx.lineTo(pBr.x, pBr.y); // Bottom
                ctx.lineTo(pBl.x, pBl.y); // Left
                ctx.closePath();
                ctx.fill();

                // If it's a steep cliff, draw a wall/skirt
                const minH = Math.min(hTl, hTr, hBl, hBr);
                const maxH = Math.max(hTl, hTr, hBl, hBr);
                if (maxH - minH > 0.2) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Darken steep slopes slightly
                    ctx.fill();
                }

                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.stroke();

                // Draw road animation overlay if needed
                const roadProg = this.roadAnimProgress.get(`${item.x},${item.y}`);
                if (roadProg !== undefined && roadProg < 1) {
                    ctx.fillStyle = `rgba(255, 255, 0, ${1 - roadProg})`;
                    ctx.beginPath();
                    ctx.moveTo(pTl.x, pTl.y);
                    ctx.lineTo(pTr.x, pTr.y);
                    ctx.lineTo(pBr.x, pBr.y);
                    ctx.lineTo(pBl.x, pBl.y);
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
                const screenPos = Engine.isoToScreen(item.x, item.y, tileW, tileH, elev);
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
