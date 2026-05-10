import sys

def main():
    filepath = 'src/main.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # Maybe there are two event listeners? Let's check
    if content.count('btn-start-game') > 1:
        print("Multiple listeners found!")

if __name__ == "__main__":
    main()
