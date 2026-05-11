// main.js

const engine = new Engine();
const gameMap = new GameMap(150, 100);
const leader = new Leader(15, 15, gameMap);
const npcs = [];

// Update camera to follow leader
engine.camera.x = leader.x * TILE_SIZE;
engine.camera.y = leader.y * TILE_SIZE;

const contextMenu = document.getElementById('context-menu');
let menuTarget = null; // Stores {x, y} of the tile clicked

function getGridFromEvent(e) {
    const worldPos = engine.screenToWorld(e.clientX, e.clientY);

    // First pass: assume z=0
    let isoPos = Engine.screenToIso(worldPos.x, worldPos.y, 64, 32);
    let gx = Math.round(isoPos.x);
    let gy = Math.round(isoPos.y);

    // Iterative refinement to handle height
    for (let i = 0; i < 3; i++) {
        const elev = gameMap.getTileElevation(gx, gy);
        // We know isoToScreen subtracts elev * 64 from Y.
        // So we add it back to world Y to find the "flat" coordinate that would have resulted in this click.
        const adjustedWorldY = worldPos.y + elev * 64;

        isoPos = Engine.screenToIso(worldPos.x, adjustedWorldY, 64, 32);
        gx = Math.round(isoPos.x);
        gy = Math.round(isoPos.y);
    }

    return { x: gx, y: gy };
}


function hideContextMenu() {
    contextMenu.classList.add('hidden');
    contextMenu.innerHTML = '';
}

function saveGame() {
    const data = {
        leader: {
            x: leader.x, y: leader.y,
            inventory: leader.inventory,
            learnedSkills: Array.from(leader.learnedSkills)
        },
        map: {
            storageWood: gameMap.storageWood,
            storageRaw: gameMap.storageRaw,
            hasStorage: gameMap.hasStorage,
            buildings: Array.from(gameMap.buildings.entries()),
            trees: Array.from(gameMap.trees.entries()),
            cacti: Array.from(gameMap.cacti),
            roads: Array.from(gameMap.roads),
            tiles: gameMap.tiles,
            elevations: Array.from(gameMap.elevations)
        },
        npcs: npcs.map(n => ({
            x: n.x, y: n.y, profession: n.profession, inventory: n.inventory, state: n.state, homePos: n.homePos, isSleeping: n.isSleeping
        })),
        gameTime: gameTime
    };
    localStorage.setItem('spaceFarmSave', JSON.stringify(data));
}

function old_saveGame() {
    const data = {
        leader: {
            x: leader.x, y: leader.y,
            inventory: leader.inventory,
            learnedSkills: Array.from(leader.learnedSkills)
        },
        map: {
            buildings: Array.from(gameMap.buildings.entries()),
            trees: Array.from(gameMap.trees.entries()),
            storageWood: gameMap.storageWood,
            storageRaw: gameMap.storageRaw,
            hasStorage: gameMap.hasStorage,
            storagePos: gameMap.storagePos,
            roads: Array.from(gameMap.roads || [])
        },
        currentStage: currentStage,
        npcs: npcs.map(n => ({
            x: n.x, y: n.y,
            profession: n.profession,
            inventory: n.inventory
        }))
    };
    localStorage.setItem('spaceFarmSave', JSON.stringify(data));
    const status = document.getElementById('save-status');
    status.textContent = 'Saved!';
    setTimeout(() => status.textContent = '', 2000);
}

function loadGame() {
    const saved = localStorage.getItem('spaceFarmSave');
    if (!saved) {
        document.getElementById('save-status').innerText = 'No save found';
        return;
    }
    try {
        const data = JSON.parse(saved);
        leader.x = data.leader.x;
        leader.y = data.leader.y;
        leader.targetX = data.leader.x;
        leader.targetY = data.leader.y;
        leader.path = [];
        leader.inventory = data.leader.inventory || { wood: 0, raw: 0 };
        leader.learnedSkills = new Set(data.leader.learnedSkills || ['chop']);

        gameMap.storageWood = data.map.storageWood;
        gameMap.storageRaw = data.map.storageRaw || 0;
        gameMap.hasStorage = data.map.hasStorage;
        gameMap.buildings = new Map(data.map.buildings);
        gameMap.trees = new Map(data.map.trees);
        gameMap.cacti = new Set(data.map.cacti || []);
        gameMap.roads = new Set(data.map.roads || []);

        if (data.map.tiles) gameMap.tiles = data.map.tiles;
        if (data.map.elevations) gameMap.elevations = new Float32Array(data.map.elevations);
        if (data.gameTime !== undefined) gameTime = data.gameTime;

        npcs.length = 0; // clear
        for (const n of data.npcs) {
            const npc = new NPC(n.x, n.y, gameMap, n.profession, n.homePos);
            npc.inventory = n.inventory || { wood: 0, raw: 0 };
            npc.state = n.state || 'idle';
            npc.isSleeping = n.isSleeping || false;
            npcs.push(npc);
        }

        // Restore camera
        const targetScreenBase = Engine.isoToScreen(leader.x, leader.y, 64, 32, gameMap.getTileElevation(leader.x, leader.y));
        engine.camera.x = targetScreenBase.x;
        engine.camera.y = targetScreenBase.y;

        updateUI();
        document.getElementById('save-status').innerText = 'Game Loaded!';
        setTimeout(() => { document.getElementById('save-status').innerText = ''; }, 2000);
    } catch(e) {
        console.error("Save corrupted", e);
    }
}

function old_loadGame() {
    const saved = localStorage.getItem('spaceFarmSave');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            leader.x = data.leader.x;
            leader.y = data.leader.y;
            leader.targetX = data.leader.x;
            leader.targetY = data.leader.y;
            leader.inventory = data.leader.inventory;
            leader.learnedSkills = new Set(data.leader.learnedSkills);

            gameMap.buildings = new Map(data.map.buildings);
            gameMap.trees = new Map(data.map.trees);
            gameMap.storageWood = data.map.storageWood;
            gameMap.storageRaw = data.map.storageRaw || 0;
            gameMap.hasStorage = data.map.hasStorage;
            gameMap.storagePos = data.map.storagePos;
            gameMap.roads = new Set(data.map.roads || []);
            if (data.currentStage) currentStage = data.currentStage;

            npcs.length = 0; // Clear existing
            for (const n of data.npcs) {
                const npc = new NPC(n.x, n.y, gameMap, n.profession);
                npc.inventory = n.inventory;
                npcs.push(npc);
            }

            updateUI();

            const status = document.getElementById('save-status');
            status.textContent = 'Loaded!';
            setTimeout(() => status.textContent = '', 2000);
        } catch (e) {
            console.error('Failed to load save', e);
        }
    }
}

document.getElementById('btn-save').addEventListener('click', saveGame);
document.getElementById('btn-load').addEventListener('click', loadGame);

// Main Menu functionality
document.getElementById('btn-start-game').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    engine.start(update, render);
});

document.getElementById('btn-load-main').addEventListener('click', () => {
    if (localStorage.getItem('spaceFarmSave')) {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        loadGame();
        engine.start(update, render);
    } else {
        alert("No saved game found!");
    }
});

// Auto-save every 60 seconds
setInterval(saveGame, 60000);

let currentStage = 1;
function updateUI() {
    const invTotal = (leader.inventory.wood || 0) + (leader.inventory.raw || 0);
    document.getElementById('res-inv-wood').textContent = leader.inventory.wood || 0;
    document.getElementById('res-inv-raw').textContent = leader.inventory.raw || 0;
    document.getElementById('res-inv-total').textContent = invTotal;

    document.getElementById('res-wood').textContent = gameMap.storageWood || 0;
    document.getElementById('res-raw').textContent = gameMap.storageRaw || 0;

    const woodSpan = document.getElementById('res-wood');
    if (gameMap.storageWood >= gameMap.maxStorageWood) {
        woodSpan.classList.add('pulsate-text');
    } else {
        woodSpan.classList.remove('pulsate-text');
    }

    // Check Stages
    if (currentStage === 1 && gameMap.storageRaw >= 5) {
        currentStage = 2;
        showStagePopup("Stage 2: Raw Material Unlocked!");
    } else if (currentStage === 2 && Array.from(gameMap.buildings.values()).some(b => b.type === 'spaceport' || b === 'spaceport')) {
        currentStage = 3;
        showStagePopup("Stage 3: Rocket Building Unlocked!");
    }

    let stageText = "Stage 1: Wood";
    if (currentStage === 2) stageText = "Stage 2: Raw Material";
    if (currentStage === 3) stageText = "Stage 3: Rocket";
    document.getElementById('current-stage').textContent = stageText;

    updateBuildMenu();
}

function showStagePopup(text) {
    const popup = document.getElementById('stage-popup');
    document.getElementById('stage-popup-text').textContent = text;
    popup.classList.remove('hidden');
    // Re-trigger animation
    popup.style.animation = 'none';
    popup.offsetHeight;
    popup.style.animation = null;

    setTimeout(() => {
        popup.classList.add('hidden');
    }, 4000);
}

document.getElementById('btn-main-menu').addEventListener('click', () => {
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    // Stop engine update loop? Engine doesn't have stop, but we can pause it or let it run in background
});

document.getElementById('btn-toggle-build').addEventListener('click', () => {
    const menu = document.getElementById('build-menu');
    menu.classList.toggle('hidden');
    updateBuildMenu();
});

function updateBuildMenu() {
    const buildButtons = document.querySelectorAll('.build-btn');

    let houses = 0;
    let factories = 0;
    const processedIds = new Set();
    for (const [key, bldData] of gameMap.buildings.entries()) {
        if (bldData && bldData.id && !processedIds.has(bldData.id)) {
            processedIds.add(bldData.id);
            const t = bldData.type;
            if (t === 'house' || t.type === 'house') houses++;
            if (t === 'factory' || t.type === 'factory') factories++;
        }
    }

    let maxHouses = 2, maxFactories = 2;
    if (currentStage === 2) { maxHouses = 4; maxFactories = 4; }
    if (currentStage === 3) { maxHouses = 6; maxFactories = 5; }

    buildButtons.forEach(btn => {
        const type = btn.getAttribute('data-type');
        let canAfford = false;
        let limitReached = false;

        if (type === 'storage') {
            canAfford = (leader.inventory.wood >= parseInt(btn.getAttribute('data-cost'))) && !gameMap.hasStorage;
        } else if (type === 'spaceport') {
            canAfford = gameMap.hasStorage && gameMap.storageWood >= parseInt(btn.getAttribute('data-cost')) && gameMap.storageRaw >= parseInt(btn.getAttribute('data-cost-raw'));
        } else {
            canAfford = gameMap.hasStorage && gameMap.storageWood >= parseInt(btn.getAttribute('data-cost'));
        }

        if (type === 'house' && houses >= maxHouses) limitReached = true;
        if (type === 'factory' && factories >= maxFactories) limitReached = true;

        if (!canAfford || limitReached) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    });
}


let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let currentBuildMode = null; // {type, cost, width, height}
let mouseTileX = 0;
let mouseTileY = 0;

const minimapCanvas = document.getElementById('minimapCanvas');
if (minimapCanvas) {
    minimapCanvas.addEventListener('mousedown', (e) => {
        const rect = minimapCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const scaleX = minimapCanvas.width / gameMap.width;
        const scaleY = minimapCanvas.height / gameMap.height;

        const targetGridX = mx / scaleX;
        const targetGridY = my / scaleY;

        // Find the center of the screen
        const centerScreenX = engine.canvas.width / 2;
        const centerScreenY = engine.canvas.height / 2;

        // Find the screen position of the target grid point (without camera offset)
        const targetScreenBase = Engine.isoToScreen(targetGridX, targetGridY, 64, 32);

        // Target screen base (if camera x,y were 0,0) is targetScreenBase
        // We want engine.camera.x and y to be exactly at targetScreenBase
        engine.camera.x = targetScreenBase.x;
        engine.camera.y = targetScreenBase.y;
    });
}

engine.canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
        // Check for factory raw material harvest
        const gridPos = getGridFromEvent(e);
        const tileX = gridPos.x;
        const tileY = gridPos.y;

        if (gameMap.buildings.has(`${tileX},${tileY}`)) {
            const bldData = gameMap.buildings.get(`${tileX},${tileY}`);
            const anchorData = gameMap.buildings.get(bldData.id);
            if (anchorData && anchorData.type && anchorData.type.type === 'factory' && anchorData.type.rawReady) {
                // Command leader to walk and harvest
                leader.actionQueue = { type: 'harvest_raw', anchor: bldData.id };
                const startX = Math.round(leader.x);
                const startY = Math.round(leader.y);
                const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true);
                if (path) {
                    leader.setPath(path);
                    return; // Prevent dragging
                }
            }
        }

        if (currentBuildMode) {
            // Place building if valid
            let canBuild = true;
            for(let wy=0; wy < currentBuildMode.height; wy++) {
                for(let wx=0; wx < currentBuildMode.width; wx++) {
                    if(!gameMap.isWalkable(mouseTileX + wx, mouseTileY + wy)) {
                        canBuild = false;
                    }
                }
            }
            if (canBuild) {
                // Command leader to walk here and build
                leader.actionQueue = {
                    type: `build_${currentBuildMode.type}`,
                    x: mouseTileX,
                    y: mouseTileY,
                    width: currentBuildMode.width,
                    height: currentBuildMode.height
                };
                const startX = Math.round(leader.x);
                const startY = Math.round(leader.y);
                const path = AStar.findPath(gameMap, startX, startY, mouseTileX, mouseTileY, true);
                if (path) leader.setPath(path);

                currentBuildMode = null;
                buildButtons.forEach(b => b.classList.remove('active'));
                cancelBuildBtn.classList.add('hidden');
            }
            return;
        } else {
            isDragging = true;
            lastMousePos.x = e.clientX;
            lastMousePos.y = e.clientY;
            hideContextMenu();
            return;
        }
    }

    const gridPos = getGridFromEvent(e);
    const tileX = gridPos.x;
    const tileY = gridPos.y;

    if (e.button === 2) { // Right click - Context Menu / Movement
        hideContextMenu();

        const isWalkableEmpty = gameMap.isWalkable(tileX, tileY) && !gameMap.trees.has(`${tileX},${tileY}`);
        const hasTree = gameMap.trees.has(`${tileX},${tileY}`);
        const hasBuilding = gameMap.buildings.has(`${tileX},${tileY}`);

        if (isWalkableEmpty && !hasBuilding) {
            // Default walk command
            const startX = Math.round(leader.x);
            const startY = Math.round(leader.y);
            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
            if (path) leader.setPath(path);
            return;
        }

        if (hasTree || hasBuilding) {
            menuTarget = { x: tileX, y: tileY };

            const tree = gameMap.trees.get(`${tileX},${tileY}`);
            if (tree && tree.state === 'grown') {
                const btnChop = document.createElement('button');
                btnChop.textContent = 'Chop Tree';
                btnChop.onclick = () => {
                    hideContextMenu();
                    leader.actionQueue = { type: 'chop', x: tileX, y: tileY };
                    const startX = Math.round(leader.x);
                    const startY = Math.round(leader.y);
                    const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true);
                    if (path) leader.setPath(path);
                };
                contextMenu.appendChild(btnChop);
            } else if (tree && tree.state === 'sapling') {
                const btnUproot = document.createElement('button');
                btnUproot.textContent = 'Uproot Sapling';
                btnUproot.onclick = () => {
                    hideContextMenu();
                    leader.actionQueue = { type: 'uproot', x: tileX, y: tileY };
                    const startX = Math.round(leader.x);
                    const startY = Math.round(leader.y);
                    const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true);
                    if (path) leader.setPath(path);
                };
                contextMenu.appendChild(btnUproot);
            }

            if (hasBuilding) {
                const bldData = gameMap.buildings.get(`${tileX},${tileY}`);

                const btnDestroy = document.createElement('button');
                btnDestroy.textContent = 'Destroy Building';
                btnDestroy.style.color = '#ff6b6b';
                btnDestroy.onclick = () => {
                    hideContextMenu();
                    let proceed = true;
                    let bType = bldData;
                    if (typeof bldData === 'object') bType = bldData.type;

                    if (bType === 'storage' || (typeof bType === 'object' && bType.type === 'storage')) {
                        proceed = confirm("Warning: Destroying the storage will lose all stored resources. Are you sure?");
                    }
                    if (proceed) {
                        leader.actionQueue = { type: 'destroy_building', x: tileX, y: tileY, anchor: bldData.id || `${tileX},${tileY}` };
                        const startX = Math.round(leader.x);
                        const startY = Math.round(leader.y);
                        const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true);
                        if (path) leader.setPath(path);
                    }
                };
                contextMenu.appendChild(btnDestroy);

                let bType = bldData;
                if (typeof bldData === 'object') bType = bldData.type;

                if (bType === 'spaceport' || (typeof bType === 'object' && bType.type === 'spaceport')) {
                    const btnBuildRocket = document.createElement('button');
                    const rocketCost = 100;
                    btnBuildRocket.textContent = `Build Rocket & Launch (${rocketCost} Wood in Storage)`;
                    btnBuildRocket.disabled = gameMap.storageWood < rocketCost;
                    if (gameMap.storageWood < rocketCost) {
                        btnBuildRocket.style.opacity = '0.5';
                        btnBuildRocket.style.cursor = 'not-allowed';
                    }
                    btnBuildRocket.onclick = () => {
                        if (gameMap.storageWood >= rocketCost) {
                            hideContextMenu();
                            leader.actionQueue = { type: 'build_rocket', x: tileX, y: tileY };
                            const startX = Math.round(leader.x);
                            const startY = Math.round(leader.y);
                            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true);
                            if (path) leader.setPath(path);
                        }
                    };
                    contextMenu.appendChild(btnBuildRocket);
                }
            }

            if (contextMenu.children.length > 0) {
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.classList.remove('hidden');
            }
        }
    }
});

engine.canvas.addEventListener('mousemove', (e) => {
    const gridPos = getGridFromEvent(e);
    mouseTileX = gridPos.x;
    mouseTileY = gridPos.y;

    if (isDragging) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        engine.camera.x -= dx / engine.camera.zoom;
        engine.camera.y -= dy / engine.camera.zoom;
        lastMousePos.x = e.clientX;
        lastMousePos.y = e.clientY;
    }
});

engine.canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isDragging = false;
    }
});

engine.canvas.addEventListener('mouseleave', (e) => {
    isDragging = false;
});

engine.canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomAmount = 0.1;
    if (e.deltaY < 0) {
        engine.camera.zoom += zoomAmount;
    } else {
        engine.camera.zoom -= zoomAmount;
    }
    // Clamp zoom
    engine.camera.zoom = Math.max(0.6, Math.min(engine.camera.zoom, 3.0));
}, { passive: false });

// Time and Weather System
// 1 in-game day (24h) = 6 real minutes = 360 real seconds.
// 1 in-game hour = 15 real seconds.
let gameTime = 8.0; // Start at 8:00 AM

// Weather System
let weatherState = 'clear'; // 'clear', 'cloudy', 'rain'
let weatherTimer = 10; // Time until next weather check
let cloudOffsets = [{x: 0, y: 0}, {x: 500, y: 300}];
let rainParticles = [];
for(let i=0; i<100; i++) {
    rainParticles.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 1000 - 500,
        vy: Math.random() * 10 + 15,
        length: Math.random() * 10 + 10
    });
}

function update(dt) {
    engine.camera.zoom = Math.max(0.6, Math.min(engine.camera.zoom, 3.0));
    // 24 hours per 360 seconds -> dt seconds * (24 / 360) hours per real second
    gameTime += dt * (24.0 / 360.0);
    if (gameTime >= 24) gameTime -= 24;

    // Update weather
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
        if (weatherState === 'clear') {
            if (Math.random() < 0.2) {
                weatherState = 'cloudy';
                weatherTimer = Math.random() * 30 + 30; // 30-60s
            } else {
                weatherTimer = 10;
            }
        } else if (weatherState === 'cloudy') {
            if (Math.random() < 0.3) {
                weatherState = 'rain';
                weatherTimer = Math.random() * (8 * 60 - 30) + 30; // 30s to 8m
            } else {
                weatherState = 'clear';
                weatherTimer = Math.random() * 60 + 30;
            }
        } else if (weatherState === 'rain') {
            weatherState = 'clear';
            weatherTimer = Math.random() * 60 + 60;
        }
    }

    // Move clouds
    if (weatherState === 'cloudy' || weatherState === 'rain') {
        for(let c of cloudOffsets) {
            c.x += 10 * dt;
            c.y += 5 * dt;
            if (c.x > 2000) c.x = -1000;
            if (c.y > 1500) c.y = -1000;
        }
    }

    // Move rain
    if (weatherState === 'rain') {
        for(let p of rainParticles) {
            p.y += p.vy * dt * 60;
            p.x += 2 * dt * 60; // slight wind
            if (p.y > engine.camera.y + 1000) {
                p.y = engine.camera.y - 500;
                p.x = engine.camera.x + Math.random() * 2000 - 1000;
            }
        }
    }

    gameMap.update(dt);
    leader.update(dt);
    for (const npc of npcs) {
        npc.update(dt);
    }

    updateClockUI();
}

function updateClockUI() {
    const clockElement = document.getElementById('clock-display');
    if (!clockElement) return;

    let hours = Math.floor(gameTime);
    let minutes = Math.floor((gameTime - hours) * 60);

    let hStr = hours < 10 ? '0' + hours : hours;
    let mStr = minutes < 10 ? '0' + minutes : minutes;

    clockElement.innerText = `${hStr}:${mStr}`;
}

function render(ctx) {
    // Calculate visible grid bounds based on camera position and zoom
    // We sample the 4 corners of the screen to find the min/max X and Y in isometric space.
    // We add a large buffer because tall mountains might stick into the screen from below.
    const wTl = engine.screenToWorld(0, 0);
    const wTr = engine.screenToWorld(engine.canvas.width, 0);
    const wBl = engine.screenToWorld(0, engine.canvas.height);
    const wBr = engine.screenToWorld(engine.canvas.width, engine.canvas.height);

    // Convert to flat grid coords to find bounds
    const tl = Engine.screenToIso(wTl.x, wTl.y, 64, 32);
    const tr = Engine.screenToIso(wTr.x, wTr.y, 64, 32);
    const bl = Engine.screenToIso(wBl.x, wBl.y, 64, 32);
    const br = Engine.screenToIso(wBr.x, wBr.y, 64, 32);

    const minX = Math.min(tl.x, tr.x, bl.x, br.x);
    const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
    const minY = Math.min(tl.y, tr.y, bl.y, br.y);
    const maxY = Math.max(tl.y, tr.y, bl.y, br.y);

    const cameraBounds = { minX, maxX, minY, maxY };

    // Pass entities to map so it can z-sort them with buildings/trees
    gameMap.render(ctx, [leader, ...npcs], cameraBounds);

    // Render ghost building
    if (currentBuildMode) {
        let canBuild = true;
        for(let wy=0; wy < currentBuildMode.height; wy++) {
            for(let wx=0; wx < currentBuildMode.width; wx++) {
                if(!gameMap.isWalkable(mouseTileX + wx, mouseTileY + wy) || !gameMap.isFlat(mouseTileX, mouseTileY, currentBuildMode.width, currentBuildMode.height)) {
                    canBuild = false;
                }
            }
        }

        ctx.fillStyle = canBuild ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
        ctx.strokeStyle = canBuild ? '#0f0' : '#f00';
        ctx.lineWidth = 2;

        const tileW = 64;
        const tileH = 32;

        for(let wy=0; wy < currentBuildMode.height; wy++) {
            for(let wx=0; wx < currentBuildMode.width; wx++) {
                // Must be flat to build, but we should show ghost at current tile elev
                const elev = gameMap.getTileElevation(mouseTileX + wx, mouseTileY + wy);
                const screenPos = Engine.isoToScreen(mouseTileX + wx, mouseTileY + wy, tileW, tileH, elev);

                ctx.beginPath();
                ctx.moveTo(screenPos.x, screenPos.y - tileH / 2);
                ctx.lineTo(screenPos.x + tileW / 2, screenPos.y);
                ctx.lineTo(screenPos.x, screenPos.y + tileH / 2);
                ctx.lineTo(screenPos.x - tileW / 2, screenPos.y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.lineWidth = 1;
    }

    renderAmbientLight();
    renderMinimap();
}

function renderMinimap() {
    const minimap = document.getElementById('minimapCanvas');
    if (!minimap) return;

    const mCtx = minimap.getContext('2d');
    const mWidth = minimap.width;
    const mHeight = minimap.height;

    mCtx.clearRect(0, 0, mWidth, mHeight);

    // Calculate scaling
    // Map bounds in world coordinates:
    // Since it's isometric, drawing it top-down is easier for the minimap.
    const mapTilesW = gameMap.width;
    const mapTilesH = gameMap.height;
    const scaleX = mWidth / mapTilesW;
    const scaleY = mHeight / mapTilesH;

    // Draw tiles
    for (let y = 0; y < mapTilesH; y++) {
        for (let x = 0; x < mapTilesW; x++) {
            const tile = gameMap.getTile(x, y);
            if (tile === 0) mCtx.fillStyle = '#4caf50';
            else if (tile === 1) mCtx.fillStyle = '#2196f3';

            if (gameMap.roads.has(`${x},${y}`)) {
                mCtx.fillStyle = '#9e9e9e';
            }

            mCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);

            // Draw buildings/trees
            if (gameMap.buildings.has(`${x},${y}`)) {
                mCtx.fillStyle = '#607d8b';
                mCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
            } else if (gameMap.trees.has(`${x},${y}`)) {
                mCtx.fillStyle = '#2e7d32';
                mCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
            }
        }
    }

    // Draw camera bounds
    // We need to find the bounds of the screen in isometric grid coordinates
    // We can sample the 4 corners of the screen
    const wTl = engine.screenToWorld(0, 0);
    const wTr = engine.screenToWorld(engine.canvas.width, 0);
    const wBl = engine.screenToWorld(0, engine.canvas.height);
    const wBr = engine.screenToWorld(engine.canvas.width, engine.canvas.height);

    const tl = Engine.screenToIso(wTl.x, wTl.y, 64, 32);
    const tr = Engine.screenToIso(wTr.x, wTr.y, 64, 32);
    const bl = Engine.screenToIso(wBl.x, wBl.y, 64, 32);
    const br = Engine.screenToIso(wBr.x, wBr.y, 64, 32);

    mCtx.strokeStyle = 'white';
    mCtx.lineWidth = 1;
    mCtx.beginPath();
    mCtx.moveTo(tl.x * scaleX, tl.y * scaleY);
    mCtx.lineTo(tr.x * scaleX, tr.y * scaleY);
    mCtx.lineTo(br.x * scaleX, br.y * scaleY);
    mCtx.lineTo(bl.x * scaleX, bl.y * scaleY);
    mCtx.closePath();
    mCtx.stroke();
}


function renderAmbientLight() {
    const overlay = document.getElementById('overlay-ambient');
    if (!overlay) return;

    // Sync size with main canvas
    if (overlay.width !== engine.canvas.width || overlay.height !== engine.canvas.height) {
        overlay.width = engine.canvas.width;
        overlay.height = engine.canvas.height;
    }

    const oCtx = overlay.getContext('2d');
    oCtx.clearRect(0, 0, overlay.width, overlay.height);

    // Day is 07:00 to 19:00, night is 19:00 to 07:00.
    // Darkness goes from 0 (day) to 0.6 (night)
    let darkness = 0;

    // Smooth transitions
    if (gameTime > 18 && gameTime <= 20) {
        // Sunset 18:00 to 20:00 -> darkness goes 0 to 0.6
        darkness = ((gameTime - 18) / 2) * 0.6;
    } else if (gameTime > 20 || gameTime <= 5) {
        // Full night
        darkness = 0.6;
    } else if (gameTime > 5 && gameTime <= 7) {
        // Sunrise 05:00 to 07:00 -> darkness goes 0.6 to 0
        darkness = 0.6 - ((gameTime - 5) / 2) * 0.6;
    }

    if (darkness > 0) {
        oCtx.fillStyle = `rgba(10, 10, 30, ${darkness})`;
        oCtx.fillRect(0, 0, overlay.width, overlay.height);
    }

    // Weather Effects Render
    if (weatherState === 'cloudy' || weatherState === 'rain') {
        for (let c of cloudOffsets) {
            // Transform world coordinates of cloud to screen
            const sc = engine.worldToScreen(c.x, c.y);
            const screenX = sc.x;
            const screenY = sc.y;
            const radGrad = oCtx.createRadialGradient(screenX, screenY, 50, screenX, screenY, 400);
            radGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
            radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            oCtx.fillStyle = radGrad;
            oCtx.fillRect(0, 0, overlay.width, overlay.height);
        }
    }

    if (weatherState === 'rain') {
        oCtx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
        oCtx.lineWidth = 1;
        oCtx.beginPath();
        for (let p of rainParticles) {
            const sc = engine.worldToScreen(p.x, p.y);
            oCtx.moveTo(sc.x, sc.y);
            oCtx.lineTo(sc.x - 2, sc.y + p.length);
        }
        oCtx.stroke();
    }
}




// Build Menu Logic
const buildButtons = document.querySelectorAll('.build-btn');
const cancelBuildBtn = document.getElementById('btn-cancel-build');

buildButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const cost = parseInt(btn.getAttribute('data-cost'));
        const width = parseInt(btn.getAttribute('data-width'));
        const height = parseInt(btn.getAttribute('data-height'));

        if (btn.classList.contains('disabled')) {
            return;
        }

        buildButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentBuildMode = { type, cost, width, height };
        cancelBuildBtn.classList.remove('hidden');
    });
});

cancelBuildBtn.addEventListener('click', () => {
    currentBuildMode = null;
    buildButtons.forEach(b => b.classList.remove('active'));
    cancelBuildBtn.classList.add('hidden');
});

function generateRoads(startX, startY) {
    const bldCenters = [];
    const processedIds = new Set();
    for (const [key, bldData] of gameMap.buildings.entries()) {
        if (bldData && bldData.id && !processedIds.has(bldData.id)) {
            processedIds.add(bldData.id);
            const w = bldData.width || 1;
            const h = bldData.height || 1;
            const [bx, by] = bldData.id.split(',').map(Number);
            bldCenters.push({ x: bx + Math.floor(w/2), y: by + Math.floor(h/2) });
        }
    }

    if (bldCenters.length < 2) return;

    const recentCenter = bldCenters[bldCenters.length - 1];

    for (let i = 0; i < bldCenters.length - 1; i++) {
        const other = bldCenters[i];
        const dist = Math.abs(recentCenter.x - other.x) + Math.abs(recentCenter.y - other.y);
        // Connect if within 4 tiles loosely (let's say manhattan distance <= 8 for centers of big buildings)
        if (dist <= 10) {
            // Simple L-shape road
            let cx = recentCenter.x;
            let cy = recentCenter.y;

            const steps = [];
            while (cx !== other.x) {
                steps.push({x: cx, y: cy});
                cx += Math.sign(other.x - cx);
            }
            while (cy !== other.y) {
                steps.push({x: cx, y: cy});
                cy += Math.sign(other.y - cy);
            }

            steps.forEach((step, idx) => {
                const key = `${step.x},${step.y}`;
                if (!gameMap.buildings.has(key)) { // don't draw road under building
                    gameMap.roads.add(key);
                    // Cascade animation delay based on idx
                    setTimeout(() => {
                        gameMap.roadAnimProgress.set(key, 0.01);
                    }, idx * 100);
                }
            });
        }
    }
}
