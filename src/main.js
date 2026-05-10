// main.js

const engine = new Engine();
const gameMap = new GameMap(30, 30);
const leader = new Leader(15, 15, gameMap);
const npcs = [];

// Update camera to follow leader
engine.camera.x = leader.x * TILE_SIZE;
engine.camera.y = leader.y * TILE_SIZE;

const contextMenu = document.getElementById('context-menu');
let menuTarget = null; // Stores {x, y} of the tile clicked

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

engine.canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
        // Check for factory raw material harvest
        const worldPos = engine.screenToWorld(e.clientX, e.clientY);
        const tileX = Math.floor(worldPos.x / 32);
        const tileY = Math.floor(worldPos.y / 32);

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

    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    const tileX = Math.floor(worldPos.x / 32);
    const tileY = Math.floor(worldPos.y / 32);

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
    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    mouseTileX = Math.floor(worldPos.x / 32);
    mouseTileY = Math.floor(worldPos.y / 32);

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
    engine.camera.zoom = Math.max(0.3, Math.min(engine.camera.zoom, 3.0));
}, { passive: false });

function update(dt) {
    gameMap.update(dt);
    leader.update(dt);
    for (const npc of npcs) {
        npc.update(dt);
    }

    // Camera is now manually controlled
}

function render(ctx) {
    gameMap.render(ctx);
    leader.render(ctx);
    for (const npc of npcs) {
        npc.render(ctx);
    }

    // Render ghost building
    if (currentBuildMode) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

        let canBuild = true;
        for(let wy=0; wy < currentBuildMode.height; wy++) {
            for(let wx=0; wx < currentBuildMode.width; wx++) {
                if(!gameMap.isWalkable(mouseTileX + wx, mouseTileY + wy)) {
                    canBuild = false;
                }
            }
        }

        if (!canBuild) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        }

        ctx.fillRect(mouseTileX * 32, mouseTileY * 32, currentBuildMode.width * 32, currentBuildMode.height * 32);

        // Outline
        ctx.strokeStyle = canBuild ? '#0f0' : '#f00';
        ctx.lineWidth = 2;
        ctx.strokeRect(mouseTileX * 32, mouseTileY * 32, currentBuildMode.width * 32, currentBuildMode.height * 32);
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
