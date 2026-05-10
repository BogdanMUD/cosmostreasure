import sys

def main():
    filepath = 'src/main.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # I accidentally removed engine.start(update, render) from the button click handlers when doing the massive rewrite earlier.
    # Let's add it back.
    search1 = """document.getElementById('btn-start-game').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

});"""
    replace1 = """document.getElementById('btn-start-game').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    engine.start(update, render);
});"""

    search2 = """document.getElementById('btn-load-main').addEventListener('click', () => {
    if (localStorage.getItem('spaceFarmSave')) {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        loadGame();

    } else {"""
    replace2 = """document.getElementById('btn-load-main').addEventListener('click', () => {
    if (localStorage.getItem('spaceFarmSave')) {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        loadGame();
        engine.start(update, render);
    } else {"""

    content = content.replace(search1, replace1)
    content = content.replace(search2, replace2)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
