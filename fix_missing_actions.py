import sys

def main():
    filepath = 'src/entities.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # The issue: the git reset in phase 2 broke the code I wrote then, and I missed some of the rebuilt logic
    # for harvest_raw, uproot, destroy_building in Leader.onReachDestination when I copy pasted it back.

    search_rocket = """            } else if (action.type === 'build_rocket') {
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
    }"""

    replace_rocket = """            } else if (action.type === 'build_rocket') {
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
    }"""

    content = content.replace(search_rocket, replace_rocket)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
