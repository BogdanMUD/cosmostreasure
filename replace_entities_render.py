import sys

def main():
    filepath = 'src/entities.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # We need to replace NPC and Leader render methods to use Engine.isoToScreen
    search_npc = """    render(ctx) {
        ctx.fillStyle = this.profession === 'lumberjack' ? '#f44336' : (this.profession === 'agronomist' ? '#8bc34a' : '#9e9e9e');
        ctx.beginPath();
        ctx.arc(this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }"""

    replace_npc = """    render(ctx) {
        const screenPos = Engine.isoToScreen(this.x, this.y, 64, 32);
        ctx.fillStyle = this.profession === 'lumberjack' ? '#f44336' : (this.profession === 'agronomist' ? '#8bc34a' : '#9e9e9e');
        ctx.beginPath();
        // Shift up slightly to stand on the tile
        ctx.arc(screenPos.x, screenPos.y - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }"""

    search_leader = """    render(ctx) {
        ctx.fillStyle = '#ff9800'; // Orange leader
        ctx.beginPath();
        ctx.arc(this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }"""

    replace_leader = """    render(ctx) {
        const screenPos = Engine.isoToScreen(this.x, this.y, 64, 32);
        ctx.fillStyle = '#ff9800'; // Orange leader
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y - 15, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }"""

    content = content.replace(search_npc, replace_npc)
    content = content.replace(search_leader, replace_leader)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
