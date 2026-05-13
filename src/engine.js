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
        // Shift by 0.5 so that integer coordinates point to the center of the tile
        const cx = gridX + 0.5;
        const cy = gridY + 0.5;
        return {
            x: (cx - cy) * (tileW / 2),
            y: (cx + cy) * (tileH / 2) - z * tileH * 2
        };
    }

    static screenToIso(screenX, screenY, tileW = 64, tileH = 32) {
        const cx = (screenX / (tileW / 2) + screenY / (tileH / 2)) / 2;
        const cy = (screenY / (tileH / 2) - screenX / (tileW / 2)) / 2;
        // Shift back
        return {
            x: cx - 0.5,
            y: cy - 0.5
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
        // Run physics/logic update independently of rendering using setInterval
        // Target 60 FPS (approx 16.6ms)
        const updateInterval = 1000 / 60;
        let lastLogicTime = performance.now();

        setInterval(() => {
            const now = performance.now();
            const dt = (now - lastLogicTime) / 1000;
            lastLogicTime = now;

            // Allow up to 1 second of catch-up if the tab was suspended,
            let timeAccumulator = Math.min(dt, 1.0); // max 1 second simulation catch-up

            while (timeAccumulator > 0) {
                const tickDt = Math.min(timeAccumulator, 0.05); // max 50ms per physics tick
                updateFn(tickDt);
                timeAccumulator -= tickDt;
            }
        }, updateInterval);

        // Rendering loop bound to screen refresh rate
        const renderLoop = () => {
            this.clear();

            this.ctx.save();
            this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.ctx.translate(-this.camera.x, -this.camera.y);

            renderFn(this.ctx);

            this.ctx.restore();

            requestAnimationFrame(renderLoop);
        };
        requestAnimationFrame(renderLoop);
    }
}
