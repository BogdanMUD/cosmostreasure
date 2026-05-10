import sys

def main():
    filepath = 'src/main.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # Left click harvest (inside mousedown)
    search_lc1 = """        const worldPos = engine.screenToWorld(e.clientX, e.clientY);
        const tileX = Math.floor(worldPos.x / 32);
        const tileY = Math.floor(worldPos.y / 32);"""
    replace_lc1 = """        const gridPos = getGridFromEvent(e);
        const tileX = gridPos.x;
        const tileY = gridPos.y;"""
    content = content.replace(search_lc1, replace_lc1)

    # Right click handling (inside mousedown, above if e.button === 2)
    search_rc = """    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    const tileX = Math.floor(worldPos.x / 32);
    const tileY = Math.floor(worldPos.y / 32);"""
    replace_rc = """    const gridPos = getGridFromEvent(e);
    const tileX = gridPos.x;
    const tileY = gridPos.y;"""
    content = content.replace(search_rc, replace_rc)

    # Mouse move handling
    search_move = """    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    mouseTileX = Math.floor(worldPos.x / 32);
    mouseTileY = Math.floor(worldPos.y / 32);"""
    replace_move = """    const gridPos = getGridFromEvent(e);
    mouseTileX = gridPos.x;
    mouseTileY = gridPos.y;"""
    content = content.replace(search_move, replace_move)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
