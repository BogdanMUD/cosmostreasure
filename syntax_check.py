import esprima
try:
    with open('src/entities.js', 'r') as f:
        esprima.parseScript(f.read())
except Exception as e:
    print(f"entities.js: {e}")

try:
    with open('src/main.js', 'r') as f:
        esprima.parseScript(f.read())
except Exception as e:
    print(f"main.js: {e}")
