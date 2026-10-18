"""Render QUARRY's app icons (a geometric amber Q on near-black). Run: python scripts/make_icons.py"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public"
GROUND = (10, 11, 13, 255)
AMBER = (245, 165, 36, 255)


def icon(size: int, *, maskable: bool = False, rounded: bool = False) -> Image.Image:
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=GROUND)
    else:
        d.rectangle([0, 0, s, s], fill=GROUND)
    # Maskable icons keep the glyph inside the central 80% safe zone.
    pad = s * (0.24 if maskable else 0.18)
    w = s * 0.085
    d.ellipse([pad, pad, s - pad, s - pad], outline=AMBER, width=int(w))
    c = s / 2
    d.line([(c + s * 0.06, c + s * 0.06), (s - pad + w * 0.2, s - pad + w * 0.2)], fill=AMBER, width=int(w))
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
icon(192).save(OUT / "icon-192.png")
icon(512).save(OUT / "icon-512.png")
icon(512, maskable=True).save(OUT / "icon-512-maskable.png")
icon(180).save(OUT / "apple-touch-icon.png")
print("icons written to", OUT)
