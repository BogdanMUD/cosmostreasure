const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/src/index.html');

    // Wait for game to initialize
    await page.waitForTimeout(1000);

    // Start game
    await page.click('#btn-start-game');
    await page.waitForTimeout(1000);

    // Take a screenshot
    await page.screenshot({ path: 'isometric_view.png' });
    console.log("Screenshot taken: isometric_view.png");

    // Click on a tile slightly to the right to test movement
    await page.mouse.click(400, 300, { button: 'right' });

    // Wait for movement
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'isometric_moved.png' });
    console.log("Screenshot taken: isometric_moved.png");

    await browser.close();
})();
