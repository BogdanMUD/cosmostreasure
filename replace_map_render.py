import sys

def main():
    filepath = 'src/map.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # The render function logic needs to draw tiles isometrically.
    # We will replace the entire render function block.
    # Note that there is an `Engine.isoToScreen` we can use, but `Engine` is defined in engine.js.
    # We need to make sure we use `Engine.isoToScreen` to get the screen coordinates for the tile's x, y.

    search = """    render(ctx) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.getTile(x, y);
                if (tile === 0) {
                    ctx.fillStyle = '#4caf50'; // grass
                } else if (tile === 1) {
                    ctx.fillStyle = '#2196f3'; // water
                }
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                // Draw tree
                const tree = this.trees.get(`${x},${y}`);
                if (tree) {
                    if (tree.state === 'grown') {
                        ctx.fillStyle = '#2e7d32'; // dark green for tree
                        ctx.beginPath();
                        ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (tree.state === 'sapling') {
                        ctx.fillStyle = '#8bc34a'; // light green for sapling
                        ctx.beginPath();
                        ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Draw buildings
                const bld = this.buildings.get(`${x},${y}`);
                if (bld) {
                    if (bld === 'storage') {
                        ctx.fillStyle = '#795548'; // brown box
                        ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        ctx.fillStyle = '#ffc107'; // gold lock/accent
                        ctx.fillRect(x * TILE_SIZE + TILE_SIZE/2 - 4, y * TILE_SIZE + TILE_SIZE/2 - 4, 8, 8);
                    } else if (bld === 'house') {
                        ctx.fillStyle = '#8d6e63'; // lighter brown
                        ctx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 10, TILE_SIZE - 8, TILE_SIZE - 10);
                        ctx.fillStyle = '#d84315'; // red roof
                        ctx.beginPath();
                        ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE + 10);
                        ctx.lineTo(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE);
                        ctx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + 10);
                        ctx.fill();
                    } else if (bld === 'factory' || bld.type === 'factory') {
                        ctx.fillStyle = '#607d8b'; // metal color
                        ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        ctx.fillStyle = '#e0e0e0';
                        ctx.fillRect(x * TILE_SIZE + TILE_SIZE/2 - 4, y * TILE_SIZE, 8, 10); // smokestack
                    } else if (bld === 'spaceport') {
                        ctx.fillStyle = '#37474f';
                        ctx.beginPath();
                        ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#00bcd4';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.lineWidth = 1;
                    }
                }
            }
        }
    }"""

    replace = """    render(ctx) {
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
            }
        }

        // We will move trees and buildings to a z-sorted pass later,
        // but for now let's draw them in order from top-left to bottom-right to approximate depth.
        // The loop above already goes top to bottom, left to right, which works reasonably well for isometric Z-sorting.
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const screenPos = Engine.isoToScreen(x, y, tileW, tileH);

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

                // Draw tree
                const tree = this.trees.get(`${x},${y}`);
                if (tree) {
                    if (tree.state === 'grown') {
                        ctx.fillStyle = '#2e7d32'; // dark green for tree
                        ctx.beginPath();
                        // Anchor at the bottom center of the tile
                        ctx.arc(screenPos.x, screenPos.y - 10, 12, 0, Math.PI * 2);
                        ctx.fill();
                        // Tree trunk
                        ctx.fillStyle = '#5d4037';
                        ctx.fillRect(screenPos.x - 2, screenPos.y - 10, 4, 10);
                    } else if (tree.state === 'sapling') {
                        ctx.fillStyle = '#8bc34a'; // light green for sapling
                        ctx.beginPath();
                        ctx.arc(screenPos.x, screenPos.y - 5, 6, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#5d4037';
                        ctx.fillRect(screenPos.x - 1, screenPos.y - 5, 2, 5);
                    }
                }

                // Draw buildings
                const bldData = this.buildings.get(`${x},${y}`);
                if (bldData && bldData.id === `${x},${y}`) { // Only draw if anchor tile
                    let bldType = bldData.type;
                    if (typeof bldType === 'object') bldType = bldType.type;

                    const w = bldData.width || 1;
                    const h = bldData.height || 1;

                    // Approximate center of the building in screen coordinates
                    const endScreenPos = Engine.isoToScreen(x + w - 1, y + h - 1, tileW, tileH);
                    const centerX = (screenPos.x + endScreenPos.x) / 2;
                    const centerY = (screenPos.y + endScreenPos.y) / 2;

                    const drawWidth = w * (tileW / 2) + h * (tileW / 2); // approximate
                    const drawHeight = drawWidth * 0.7; // approximate
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
                    } else if (bldType === 'factory') {
                        ctx.fillStyle = '#607d8b'; // metal color
                        ctx.fillRect(centerX - 30, isoBottom - 40, 60, 40);
                        ctx.fillStyle = '#e0e0e0';
                        ctx.fillRect(centerX - 10, isoBottom - 55, 10, 15); // smokestack
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
    }"""

    content = content.replace(search, replace)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
