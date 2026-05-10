import sys

def main():
    filepath = 'src/main.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # Make sure we add `getGridFromEvent` if it isn't there.
    if "function getGridFromEvent" not in content:
        search = "let menuTarget = null; // Stores {x, y} of the tile clicked"
        replace = """let menuTarget = null; // Stores {x, y} of the tile clicked

function getGridFromEvent(e) {
    const worldPos = engine.screenToWorld(e.clientX, e.clientY);
    const isoPos = Engine.screenToIso(worldPos.x, worldPos.y, 64, 32);
    return {
        x: Math.floor(isoPos.x),
        y: Math.floor(isoPos.y)
    };
}
"""
        content = content.replace(search, replace)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
