class AStar {
    static findPath(gameMap, startX, startY, goalX, goalY, allowAdjacentGoal = false) {
        const start = { x: startX, y: startY };
        const goal = { x: goalX, y: goalY };

        // If goal is unwalkable and we allow adjacent targeting, we will stop 1 tile away.
        // For simplicity of A*, if it's unwalkable and we don't allow adjacent, fail early.
        if (!gameMap.isWalkable(goal.x, goal.y) && !allowAdjacentGoal) return null;

        const openSet = [start];
        const cameFrom = new Map();

        const gScore = new Map();
        gScore.set(`${start.x},${start.y}`, 0);

        const fScore = new Map();
        fScore.set(`${start.x},${start.y}`, this.heuristic(gameMap, start, goal));

        while (openSet.length > 0) {
            let current = openSet.reduce((min, node) => {
                const score1 = fScore.has(`${node.x},${node.y}`) ? fScore.get(`${node.x},${node.y}`) : Infinity;
                const score2 = fScore.has(`${min.x},${min.y}`) ? fScore.get(`${min.x},${min.y}`) : Infinity;
                return score1 < score2 ? node : min;
            }, openSet[0]);

            if (current.x === goal.x && current.y === goal.y) {
                return this.reconstructPath(cameFrom, current);
            }

            if (allowAdjacentGoal && Math.abs(current.x - goal.x) <= 1 && Math.abs(current.y - goal.y) <= 1) {
                 return this.reconstructPath(cameFrom, current);
            }

            openSet.splice(openSet.indexOf(current), 1);

            for (const neighbor of this.getNeighbors(gameMap, current)) {
                const tentativeGScore = (gScore.has(`${current.x},${current.y}`) ? gScore.get(`${current.x},${current.y}`) : Infinity) + 1;

                if (tentativeGScore < (gScore.has(`${neighbor.x},${neighbor.y}`) ? gScore.get(`${neighbor.x},${neighbor.y}`) : Infinity)) {
                    cameFrom.set(`${neighbor.x},${neighbor.y}`, current);
                    gScore.set(`${neighbor.x},${neighbor.y}`, tentativeGScore);
                    fScore.set(`${neighbor.x},${neighbor.y}`, tentativeGScore + this.heuristic(gameMap, neighbor, goal));

                    if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return null;
    }

    static heuristic(gameMap, a, b) {
        // Flat heuristic
        const flatDist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (!gameMap || !gameMap.getTileElevation) return flatDist;

        // Add vertical distance to heuristic so they prefer flatter routes if possible
        const ea = gameMap.getTileElevation(a.x, a.y);
        const eb = gameMap.getTileElevation(b.x, b.y);
        return flatDist + Math.abs(ea - eb) * 2;
    }

    static getNeighbors(gameMap, node) {
        const neighbors = [];
        const dirs = [
            { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
            // Add diagonal movement for better pathfinding on 3D terrain
            { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
        ];

        for (const dir of dirs) {
            const nx = node.x + dir.x;
            const ny = node.y + dir.y;
            // Pass current node x, y to isWalkable to check elevation differences
            if (gameMap.isWalkable(nx, ny, node.x, node.y)) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        return neighbors;
    }

    static reconstructPath(cameFrom, current) {
        const path = [current];
        while (cameFrom.has(`${current.x},${current.y}`)) {
            current = cameFrom.get(`${current.x},${current.y}`);
            path.unshift(current);
        }
        return path;
    }
}
