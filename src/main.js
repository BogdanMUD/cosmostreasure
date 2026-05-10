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
            hasStorage: gameMap.hasStorage,
            storagePos: gameMap.storagePos
        },
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
            gameMap.hasStorage = data.map.hasStorage;
            gameMap.storagePos = data.map.storagePos;

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

});

document.getElementById('btn-load-main').addEventListener('click', () => {
    if (localStorage.getItem('spaceFarmSave')) {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        loadGame();

    } else {
        alert("No saved game found!");
    }
});

// Auto-save every 60 seconds
setInterval(saveGame, 60000);

function updateUI() {
    document.getElementById('res-inv').textContent = leader.inventory.wood;
    document.getElementById('res-wood').textContent = gameMap.storageWood;
}

let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let currentBuildMode = null; // {type, cost, width, height}
let mouseTileX = 0;
let mouseTileY = 0;

engine.canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
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
        if (gameMap.isWalkable(tileX, tileY) || gameMap.buildings.has(`${tileX},${tileY}`)) {
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
            } else if (!gameMap.buildings.has(`${tileX},${tileY}`)) {
                const btnWalk = document.createElement('button');
                btnWalk.textContent = 'Walk Here';
                btnWalk.onclick = () => {
                    hideContextMenu();
                    const startX = Math.round(leader.x);
                    const startY = Math.round(leader.y);
                    const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
                    if (path) leader.setPath(path);
                };
                contextMenu.appendChild(btnWalk);
            } else if (gameMap.buildings.has(`${tileX},${tileY}`)) {
                const bldData = gameMap.buildings.get(`${tileX},${tileY}`);

                const btnDestroy = document.createElement('button');
                btnDestroy.textContent = 'Destroy Building';
                btnDestroy.style.color = '#ff6b6b';
                btnDestroy.onclick = () => {
                    hideContextMenu();
                    leader.actionQueue = { type: 'destroy_building', x: tileX, y: tileY, anchor: bldData.id || `${tileX},${tileY}` };
                    const startX = Math.round(leader.x);
                    const startY = Math.round(leader.y);
                    const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true);
                    if (path) leader.setPath(path);
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

        // Check cost
        let canAfford = false;
        if (type === 'storage') {
            canAfford = leader.inventory.wood >= cost;
        } else {
            canAfford = gameMap.hasStorage && gameMap.storageWood >= cost;
        }

        if (!canAfford) {
            alert('Not enough wood!');
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
