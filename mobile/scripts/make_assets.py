"""Generate StockSense app assets (icon, adaptive icon, splash).

Run from mobile/:  python scripts/make_assets.py
Produces PNGs in mobile/assets/. Re-run any time you tweak the brand colors.
"""

import os

from PIL import Image, ImageDraw

BG = (11, 14, 20)  # #0B0E14
UP = (46, 204, 113)  # #2ECC71
ACCENT = (76, 141, 255)  # #4C8DFF

ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(ASSETS, exist_ok=True)


def _chart(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float):
    """A rising line with an arrow head — the brand mark."""
    pts = [(-0.42, 0.18), (-0.18, 0.30), (0.02, -0.02), (0.24, 0.10), (0.44, -0.30)]
    px = [(cx + x * scale, cy + y * scale) for x, y in pts]
    draw.line(px, fill=UP, width=max(2, int(scale * 0.05)), joint="curve")
    # arrow head at the last point
    ax, ay = px[-1]
    s = scale * 0.12
    draw.line([(ax - s, ay), (ax, ay), (ax, ay + s)], fill=UP,
              width=max(2, int(scale * 0.05)), joint="curve")


def make_icon(size: int, path: str, rounded: bool):
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)
    _chart(draw, size // 2, int(size * 0.52), size * 0.9)
    # subtle accent dot (the "S")
    r = size * 0.04
    draw.ellipse(
        [size * 0.5 - r, size * 0.20 - r, size * 0.5 + r, size * 0.20 + r],
        fill=ACCENT,
    )
    img.save(path)
    print("wrote", path)


def make_splash(path: str):
    size = 1284
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)
    _chart(draw, size // 2, size // 2, size * 0.5)
    img.save(path)
    print("wrote", path)


if __name__ == "__main__":
    make_icon(1024, os.path.join(ASSETS, "icon.png"), rounded=False)
    make_icon(1024, os.path.join(ASSETS, "adaptive-icon.png"), rounded=False)
    make_icon(48, os.path.join(ASSETS, "favicon.png"), rounded=False)
    make_splash(os.path.join(ASSETS, "splash.png"))
