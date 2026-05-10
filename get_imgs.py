import base64
with open("isometric_view.png", "rb") as image_file:
    print(base64.b64encode(image_file.read()).decode('utf-8'))
