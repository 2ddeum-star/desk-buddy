from PIL import Image

SRC = "assets/paw.png"
DST = "assets/paw.png"

# 밝기 임계값: 이 값 이상 = 완전 투명, 아래 임계값 = 불투명, 사이는 부드럽게
HI = 240
LO = 200

img = Image.open(SRC).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, _ = pixels[x, y]
        brightness = (r + g + b) / 3
        if brightness >= HI:
            pixels[x, y] = (r, g, b, 0)
        elif brightness > LO:
            a = int((HI - brightness) / (HI - LO) * 255)
            pixels[x, y] = (r, g, b, a)

img.save(DST, "PNG")
print(f"Saved {DST} size={img.size} mode={img.mode}")
