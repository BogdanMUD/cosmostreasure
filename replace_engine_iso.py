import sys

def main():
    filepath = 'src/engine.js'
    with open(filepath, 'r') as f:
        content = f.read()

    append_code = """
    // Isometric helpers
    // Assuming TILE_WIDTH = 64, TILE_HEIGHT = 32
    static isoToScreen(gridX, gridY, tileW = 64, tileH = 32) {
        return {
            x: (gridX - gridY) * (tileW / 2),
            y: (gridX + gridY) * (tileH / 2)
        };
    }

    static screenToIso(screenX, screenY, tileW = 64, tileH = 32) {
        return {
            x: (screenX / (tileW / 2) + screenY / (tileH / 2)) / 2,
            y: (screenY / (tileH / 2) - screenX / (tileW / 2)) / 2
        };
    }

    screenToWorld(screenX, screenY) {"""

    search_class = """    screenToWorld(screenX, screenY) {"""

    content = content.replace(search_class, append_code)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
