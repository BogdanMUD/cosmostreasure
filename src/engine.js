// engine.js
class Engine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.lastTime = 0;
        this.camera = { x: 0, y: 0, zoom: 1 };

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Disable right click menu
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }


    // Isometric helpers
    // Assuming TILE_WIDTH = 64, TILE_HEIGHT = 32
    static isoToScreen(gridX, gridY, tileW = 64, tileH = 32, z = 0) {
        return {
            x: (gridX - gridY) * (tileW / 2),
            y: (gridX + gridY) * (tileH / 2) - z * tileH * 2
        };
    }

    static screenToIso(screenX, screenY, tileW = 64, tileH = 32) {
        return {
            x: (screenX / (tileW / 2) + screenY / (tileH / 2)) / 2,
            y: (screenY / (tileH / 2) - screenX / (tileW / 2)) / 2
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.canvas.width / 2) / this.camera.zoom + this.camera.x,
            y: (screenY - this.canvas.height / 2) / this.camera.zoom + this.camera.y
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.camera.x) * this.camera.zoom + this.canvas.width / 2,
            y: (worldY - this.camera.y) * this.camera.zoom + this.canvas.height / 2
        };
    }

    start(updateFn, renderFn) {
        const loop = (timestamp) => {
            const dt = (timestamp - this.lastTime) / 1000; // in seconds
            this.lastTime = timestamp;

            if (dt < 0.1) { // cap dt to prevent huge jumps if tab was inactive
                updateFn(dt);
            }
            this.clear();

            this.ctx.save();
            this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.ctx.translate(-this.camera.x, -this.camera.y);

            renderFn(this.ctx);

            this.ctx.restore();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}
