from PIL import Image

SRC = "assets/paw.png"
DST = "assets/paw_only.png"

# 알파가 있는 영역의 아래쪽 비율을 발로 잘라냄
FOOT_FRACTION = 0.28  # 발(발바닥) 부분만

img = Image.open(SRC).convert("RGBA")
bbox = img.getbbox()
if bbox is None:
    raise SystemExit("empty image (no opaque pixels)")

left, upper, right, lower = bbox
content_h = lower - upper
foot_top = lower - int(content_h * FOOT_FRACTION)

# 좌우는 콘텐츠 양쪽으로 4px 여유
pad = 4
left = max(0, left - pad)
right = min(img.width, right + pad)

foot = img.crop((left, foot_top, right, lower))
foot.save(DST, "PNG")
print(f"bbox={bbox} foot_top={foot_top} -> {DST} size={foot.size}")
