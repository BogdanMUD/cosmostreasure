import sys

def main():
    filepath = 'src/style.css'
    with open(filepath, 'r') as f:
        content = f.read()

    # The user requested that the buttons and title on the main menu be centered.
    # Looking at the CSS:
    # #main-menu { ... display: flex; flex-direction: column; align-items: center; justify-content: center; }
    # This should already center them. But let's make sure the .menu-buttons div is also flex center.
    search = """.menu-buttons button {
    padding: 15px 30px;"""
    replace = """.menu-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.menu-buttons button {
    padding: 15px 30px;"""

    content = content.replace(search, replace)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
