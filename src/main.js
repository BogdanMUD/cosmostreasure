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

// Auto-save every 60 seconds
setInterval(saveGame, 60000);

function updateUI() {
    document.getElementById('res-inv').textContent = leader.inventory.wood;
    document.getElementById('res-wood').textContent = gameMap.storageWood;
}

engine.canvas.addEventListener('mousedown', (e) => {
    // Need to explicitly reference TILE_SIZE from map.js if not imported, but it's global
    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    const tileX = Math.floor(worldPos.x / 32); // Use literal or global TILE_SIZE
    const tileY = Math.floor(worldPos.y / 32);

    if (e.button === 2) { // Right click - Move
        hideContextMenu();
        if (gameMap.isWalkable(tileX, tileY)) {
            const startX = Math.round(leader.x);
            const startY = Math.round(leader.y);
            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
            if (path) {
                leader.setPath(path);
            }
        }
    } else if (e.button === 0) { // Left click - Context Menu
        hideContextMenu();
        // Allow clicking on buildings (like spaceport) or walkable tiles
        if (gameMap.isWalkable(tileX, tileY) || gameMap.buildings.has(`${tileX},${tileY}`)) {
            menuTarget = { x: tileX, y: tileY };

            // Check what is on this tile
            const tree = gameMap.trees.get(`${tileX},${tileY}`);

            if (tree && tree.state === 'grown') {
                const btnChop = document.createElement('button');
                btnChop.textContent = 'Chop Tree';
                btnChop.onclick = () => {
                    hideContextMenu();
                    leader.actionQueue = { type: 'chop', x: tileX, y: tileY };
                    const startX = Math.round(leader.x);
                    const startY = Math.round(leader.y);
                    const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true); // true to allow adjacent targeting
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

                if (!gameMap.hasStorage) {
                    const btnBuildStorage = document.createElement('button');
                    btnBuildStorage.textContent = `Build Storage (10 Wood)`;
                    btnBuildStorage.disabled = leader.inventory.wood < 10;
                    if (leader.inventory.wood < 10) {
                         btnBuildStorage.style.opacity = '0.5';
                         btnBuildStorage.style.cursor = 'not-allowed';
                    }
                    btnBuildStorage.onclick = () => {
                        if (leader.inventory.wood >= 10) {
                            hideContextMenu();
                            leader.actionQueue = { type: 'build_storage', x: tileX, y: tileY };
                            const startX = Math.round(leader.x);
                            const startY = Math.round(leader.y);
                            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
                            if (path) leader.setPath(path);
                        }
                    };
                    contextMenu.appendChild(btnBuildStorage);
                } else {
                    const btnBuildHouse = document.createElement('button');
                    const houseCost = 15;
                    btnBuildHouse.textContent = `Build House (${houseCost} Wood in Storage)`;
                    btnBuildHouse.disabled = gameMap.storageWood < houseCost;
                    if (gameMap.storageWood < houseCost) {
                        btnBuildHouse.style.opacity = '0.5';
                        btnBuildHouse.style.cursor = 'not-allowed';
                    }
                    btnBuildHouse.onclick = () => {
                        if (gameMap.storageWood >= houseCost) {
                            hideContextMenu();
                            leader.actionQueue = { type: 'build_house', x: tileX, y: tileY };
                            const startX = Math.round(leader.x);
                            const startY = Math.round(leader.y);
                            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
                            if (path) leader.setPath(path);
                        }
                    };
                    contextMenu.appendChild(btnBuildHouse);

                    const btnBuildFactory = document.createElement('button');
                    const factoryCost = 30;
                    btnBuildFactory.textContent = `Build Factory (${factoryCost} Wood in Storage)`;
                    btnBuildFactory.disabled = gameMap.storageWood < factoryCost;
                    if (gameMap.storageWood < factoryCost) {
                        btnBuildFactory.style.opacity = '0.5';
                        btnBuildFactory.style.cursor = 'not-allowed';
                    }
                    btnBuildFactory.onclick = () => {
                        if (gameMap.storageWood >= factoryCost) {
                            hideContextMenu();
                            leader.actionQueue = { type: 'build_factory', x: tileX, y: tileY };
                            const startX = Math.round(leader.x);
                            const startY = Math.round(leader.y);
                            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
                            if (path) leader.setPath(path);
                        }
                    };
                    contextMenu.appendChild(btnBuildFactory);

                    const btnBuildSpaceport = document.createElement('button');
                    const spaceportCost = 50;
                    btnBuildSpaceport.textContent = `Build Spaceport (${spaceportCost} Wood in Storage)`;
                    btnBuildSpaceport.disabled = gameMap.storageWood < spaceportCost;
                    if (gameMap.storageWood < spaceportCost) {
                        btnBuildSpaceport.style.opacity = '0.5';
                        btnBuildSpaceport.style.cursor = 'not-allowed';
                    }
                    btnBuildSpaceport.onclick = () => {
                        if (gameMap.storageWood >= spaceportCost) {
                            hideContextMenu();
                            leader.actionQueue = { type: 'build_spaceport', x: tileX, y: tileY };
                            const startX = Math.round(leader.x);
                            const startY = Math.round(leader.y);
                            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
                            if (path) leader.setPath(path);
                        }
                    };
                    contextMenu.appendChild(btnBuildSpaceport);

                    if (!gameMap.trees.has(`${tileX},${tileY}`)) {
                        const btnPlant = document.createElement('button');
                        btnPlant.textContent = 'Plant Sapling';
                        btnPlant.onclick = () => {
                            hideContextMenu();
                            leader.actionQueue = { type: 'plant', x: tileX, y: tileY };
                            leader.learnedSkills.add('plant');
                            const startX = Math.round(leader.x);
                            const startY = Math.round(leader.y);
                            const path = AStar.findPath(gameMap, startX, startY, tileX, tileY);
                            if (path) leader.setPath(path);
                        };
                        contextMenu.appendChild(btnPlant);
                    }
                }
            } else if (gameMap.buildings.get(`${tileX},${tileY}`) === 'spaceport') {
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
                        const path = AStar.findPath(gameMap, startX, startY, tileX, tileY, true); // true to allow adjacent targeting
                        if (path) leader.setPath(path);
                    }
                };
                contextMenu.appendChild(btnBuildRocket);
            }

            if (contextMenu.children.length > 0) {
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.classList.remove('hidden');
            }
        }
    }
});

function update(dt) {
    gameMap.update(dt);
    leader.update(dt);
    for (const npc of npcs) {
        npc.update(dt);
    }

    // Smooth camera follow
    const targetCamX = leader.x * TILE_SIZE + TILE_SIZE / 2;
    const targetCamY = leader.y * TILE_SIZE + TILE_SIZE / 2;
    engine.camera.x += (targetCamX - engine.camera.x) * 5 * dt;
    engine.camera.y += (targetCamY - engine.camera.y) * 5 * dt;
}

function render(ctx) {
    gameMap.render(ctx);
    leader.render(ctx);
    for (const npc of npcs) {
        npc.render(ctx);
    }
}

engine.start(update, render);
