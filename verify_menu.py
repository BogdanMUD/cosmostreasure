from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # Wait a sec for the animation
        time.sleep(1)
        page.screenshot(path="main_menu_fixed.png")

        # Click start
        page.click("#btn-start-game")

        # Force evaluation to see classes
        classes = page.evaluate("document.getElementById('game-container').className")
        print("Classes on game-container:", classes)

        # Take a screenshot right after clicking
        time.sleep(1)
        page.screenshot(path="game_started.png")

        browser.close()

run()
