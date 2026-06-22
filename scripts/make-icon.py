# Generate build/icon.png from a character.png — face-area crop + resize to 512×512.
# Usage: python make-icon.py <src character.png> <dst icon.png>
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
w, h = img.size
s = min(w, h)
left = (w - s) // 2
top = int(h * 0.05)
if top + s > h:
    top = h - s
img.crop((left, top, left + s, top + s)).resize((512, 512), Image.LANCZOS).save(dst)
print(f"icon saved: {dst} ({img.size} -> 512x512)")
