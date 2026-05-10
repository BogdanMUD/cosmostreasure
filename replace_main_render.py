import sys

def main():
    filepath = 'src/main.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # The issue is that the map draws trees and buildings, but main.js draws characters over them.
    # To fix this, we should change how rendering works:
    # 1. Map draws floor tiles.
    # 2. Main collects all entities (leader, npcs, trees, buildings).
    # 3. Main sorts them by their Y isometric depth (x + y).
    # 4. Main draws them in order.
    # Wait, the easiest way without completely rewriting map.js is to let map.js render floor,
    # but we move the tree/building drawing to main.js, OR we pass entities to map.js render.

    # Passing entities to gameMap.render(ctx, [leader, ...npcs]) is the cleanest.

    search_render = """function render(ctx) {
    gameMap.render(ctx);
    leader.render(ctx);
    for (const npc of npcs) {
        npc.render(ctx);
    }"""

    replace_render = """function render(ctx) {
    // Pass entities to map so it can z-sort them with buildings/trees
    gameMap.render(ctx, [leader, ...npcs]);"""

    content = content.replace(search_render, replace_render)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
