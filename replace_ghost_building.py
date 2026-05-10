import sys

def main():
    filepath = 'src/main.js'
    with open(filepath, 'r') as f:
        content = f.read()

    search = """    // Render ghost building
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
    }"""

    replace = """    // Render ghost building
    if (currentBuildMode) {
        let canBuild = true;
        for(let wy=0; wy < currentBuildMode.height; wy++) {
            for(let wx=0; wx < currentBuildMode.width; wx++) {
                if(!gameMap.isWalkable(mouseTileX + wx, mouseTileY + wy)) {
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
                const screenPos = Engine.isoToScreen(mouseTileX + wx, mouseTileY + wy, tileW, tileH);

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
    }"""

    content = content.replace(search, replace)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
