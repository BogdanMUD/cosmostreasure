import sys

def main():
    filepath = 'src/map.js'
    with open(filepath, 'r') as f:
        content = f.read()

    # Need to render pulsating icon on factory when rawReady = true
    # The map.js draws the buildings in the z-sort pass

    search_factory = """                } else if (bldType === 'factory') {
                    ctx.fillStyle = '#607d8b'; // metal color
                    ctx.fillRect(centerX - 30, isoBottom - 40, 60, 40);
                    ctx.fillStyle = '#e0e0e0';
                    ctx.fillRect(centerX - 10, isoBottom - 55, 10, 15); // smokestack
                } else if (bldType === 'spaceport') {"""

    replace_factory = """                } else if (bldType === 'factory') {
                    ctx.fillStyle = '#607d8b'; // metal color
                    ctx.fillRect(centerX - 30, isoBottom - 40, 60, 40);
                    ctx.fillStyle = '#e0e0e0';
                    ctx.fillRect(centerX - 10, isoBottom - 55, 10, 15); // smokestack

                    if (item.bldType.rawReady) {
                        const time = Date.now() / 300;
                        const pulse = Math.abs(Math.sin(time));
                        ctx.fillStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(centerX, isoBottom - 60 - pulse * 10, 8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#000';
                        ctx.stroke();
                    }
                } else if (bldType === 'spaceport') {"""

    content = content.replace(search_factory, replace_factory)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
