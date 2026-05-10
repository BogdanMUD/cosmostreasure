import sys

def main():
    filepath = 'src/main.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # The issue: Math.floor(isoPos.x) shifts it half a tile down-right because iso coords visually align with Math.round
    # Actually wait. When isoToScreen is used, x and y are grid indices.
    # The center of tile 0,0 is exactly at screenPos.x, screenPos.y.
    # Therefore, to map back from screen to iso grid, we should use Math.round.

    search_grid = """function getGridFromEvent(e) {
    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    const isoPos = Engine.screenToIso(worldPos.x, worldPos.y, 64, 32);
    return {
        x: Math.floor(isoPos.x),
        y: Math.floor(isoPos.y)
    };
}"""

    replace_grid = """function getGridFromEvent(e) {
    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    const isoPos = Engine.screenToIso(worldPos.x, worldPos.y, 64, 32);
    return {
        x: Math.round(isoPos.x),
        y: Math.round(isoPos.y)
    };
}"""

    content = content.replace(search_grid, replace_grid)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
