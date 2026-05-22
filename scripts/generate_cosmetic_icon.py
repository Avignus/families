#!/usr/bin/env python3
"""
Generates cosmetic icons from source images.
Applies center-crop, rounded corners, and a rarity-appropriate border + glow.

Usage:
    # Process all known theme images automatically:
    python scripts/generate_cosmetic_icon.py --auto

    # Process a custom image:
    python scripts/generate_cosmetic_icon.py <image_path> <slug> <rarity> [--color #rrggbb]

    Rarity values: padrao | comum | incomum | raro | epico | lendario

Output: public/cosmetics/<slug>.png (320×320 transparent PNG)
"""

import sys
import os
import argparse
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ── Rarity styles ─────────────────────────────────────────────────────────────
RARITY = {
    "padrao":   {"color": (100, 100, 115), "width": 3,  "glow_r": 0,  "stars": False},
    "comum":    {"color": (161, 161, 170), "width": 3,  "glow_r": 0,  "stars": False},
    "incomum":  {"color": ( 52, 211, 153), "width": 4,  "glow_r": 10, "stars": False},
    "raro":     {"color": ( 96, 165, 250), "width": 5,  "glow_r": 14, "stars": False},
    "epico":    {"color": (167, 139, 250), "width": 6,  "glow_r": 16, "stars": False},
    "lendario": {"color": (251, 191,  36), "width": 8,  "glow_r": 20, "stars": True },
}

# ── Predefined mappings: (source_image, slug, rarity, optional_override_color) ─
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "images")

AUTO_MAP = [
    # Terror set (purple #7c3aed)
    ("theme-cripta-ancestral.png",       "capa-cripta-ancestral",  "lendario", (124, 58, 237)),
    ("theme-mansao-sombria-perfil.png",  "bg-mansao-sombria",      "raro",     (124, 58, 237)),
    # Generosidade set (gold #f59e0b)
    ("theme-sala-tesouro.png",           "capa-sala-tesouro",      "lendario", (245, 158, 11)),
    ("theme-sala-tesouro.png",           "bg-sala-tesouro",        "raro",     (245, 158, 11)),
    # Co-op set (emerald #10b981)
    ("theme-fortaleza-cla.png",          "capa-fortaleza-cla",     "lendario", ( 16, 185, 129)),
    ("theme-fortaleza-cla.png",          "bg-fortaleza-cla",       "raro",     ( 16, 185, 129)),
    # Família set (gold #eab308 + sky #38bdf8)
    ("theme-salao-trono.png",            "capa-salao-trono",       "lendario", (234, 179,   8)),
    ("theme-salao-trono-perfil.png",     "bg-salao-trono",         "raro",     (234, 179,   8)),
    # Comportamento set (indigo #818cf8)
    ("theme-cidade-neon.png",            "capa-cidade-neon",       "incomum",  (129, 140, 248)),
]


def center_crop_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    s = min(w, h)
    return img.crop(((w-s)//2, (h-s)//2, (w+s)//2, (h+s)//2))


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    return mask


def draw_corner_star(draw: ImageDraw.Draw, cx: int, cy: int, size: int, color: tuple) -> None:
    """Draw a simple 4-pointed star centered at (cx, cy)."""
    h = size // 2
    t = size // 5
    points = [
        (cx,    cy-h),  # top
        (cx+t,  cy-t),
        (cx+h,  cy),    # right
        (cx+t,  cy+t),
        (cx,    cy+h),  # bottom
        (cx-t,  cy+t),
        (cx-h,  cy),    # left
        (cx-t,  cy-t),
    ]
    draw.polygon(points, fill=color)


def make_border_layer(canvas_size: int, content_start: int, content_end: int,
                      corner_radius: int, border_width: int,
                      color: tuple, glow_radius: int, stars: bool) -> Image.Image:
    """Create a RGBA layer with border ring, glow, and optional corner stars."""
    size = canvas_size
    c0 = content_start
    c1 = content_end

    # Outer boundary of the border ring
    o0 = c0 - border_width
    o1 = c1 + border_width
    outer_r = corner_radius + border_width

    # Build ring mask: outer filled - inner filled
    outer_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(outer_mask).rounded_rectangle([o0, o0, o1, o1], radius=outer_r, fill=255)
    inner_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(inner_mask).rounded_rectangle([c0, c0, c1, c1], radius=corner_radius, fill=255)
    ring_arr = np.clip(np.array(outer_mask).astype(int) - np.array(inner_mask).astype(int), 0, 255).astype(np.uint8)

    # Build colored border RGBA
    r, g, b = color
    border_arr = np.zeros((size, size, 4), dtype=np.uint8)
    border_arr[:, :, 0] = r
    border_arr[:, :, 1] = g
    border_arr[:, :, 2] = b
    border_arr[:, :, 3] = ring_arr
    border_img = Image.fromarray(border_arr, "RGBA")

    # Glow: blur a copy of the border
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if glow_radius > 0:
        glow = border_img.copy()
        glow = glow.filter(ImageFilter.GaussianBlur(radius=glow_radius))
        result = Image.alpha_composite(result, glow)
    result = Image.alpha_composite(result, border_img)

    # Corner stars (legendary)
    if stars:
        star_draw = ImageDraw.Draw(result)
        margin = border_width // 2
        star_size = border_width * 3
        positions = [
            (o0 + margin, o0 + margin),
            (o1 - margin, o0 + margin),
            (o0 + margin, o1 - margin),
            (o1 - margin, o1 - margin),
        ]
        for sx, sy in positions:
            draw_corner_star(star_draw, sx, sy, star_size, color + (255,))

    return result


def generate_icon(source_path: str, slug: str, rarity: str,
                  override_color: tuple | None = None,
                  output_dir: str = "") -> None:
    if rarity not in RARITY:
        print(f"  Unknown rarity '{rarity}', using 'comum'")
        rarity = "comum"

    style = RARITY[rarity]
    color = override_color if override_color else style["color"]
    border_w = style["width"]
    glow_r = style["glow_r"]
    stars = style["stars"]

    CANVAS = 320
    CONTENT = 288    # content area within canvas
    MARGIN = (CANVAS - CONTENT) // 2    # 16px
    CORNER_R = 22

    # Load and prepare source image
    src = Image.open(source_path).convert("RGBA")
    src = center_crop_square(src)
    src = src.resize((CONTENT, CONTENT), Image.LANCZOS)

    # Apply rounded-corner clip to content
    clip_mask = rounded_rect_mask(CONTENT, CORNER_R)
    src_arr = np.array(src)
    src_arr[:, :, 3] = np.minimum(src_arr[:, :, 3], np.array(clip_mask))
    src_clipped = Image.fromarray(src_arr, "RGBA")

    # Place content on canvas
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(src_clipped, (MARGIN, MARGIN), src_clipped)

    # Build border layer
    border = make_border_layer(
        CANVAS, MARGIN, MARGIN + CONTENT - 1,
        CORNER_R, border_w, color, glow_r, stars
    )

    # Composite: content → border on top
    result = Image.alpha_composite(canvas, border)

    out_path = os.path.join(output_dir or os.path.join(
        os.path.dirname(__file__), "..", "public", "cosmetics"
    ), f"{slug}.png")
    result.save(out_path, "PNG")
    print(f"  ✓ {slug}.png  ({rarity}, color={color})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", help="Source image path")
    parser.add_argument("slug", nargs="?", help="Cosmetic slug")
    parser.add_argument("rarity", nargs="?", help="Rarity string")
    parser.add_argument("--color", help="Override border color as R,G,B (e.g. 124,58,237)")
    parser.add_argument("--auto", action="store_true", help="Process all predefined theme images")
    args = parser.parse_args()

    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "cosmetics")
    os.makedirs(out_dir, exist_ok=True)

    if args.auto:
        print(f"Processing {len(AUTO_MAP)} predefined theme images...")
        for fname, slug, rarity, color in AUTO_MAP:
            src = os.path.join(IMAGES_DIR, fname)
            if not os.path.exists(src):
                print(f"  ! {fname} not found, skipping")
                continue
            generate_icon(src, slug, rarity, override_color=color, output_dir=out_dir)
        print("Done.")
        return

    if not args.source or not args.slug or not args.rarity:
        parser.print_help()
        sys.exit(1)

    override = None
    if args.color:
        parts = [int(x) for x in args.color.split(",")]
        override = tuple(parts)

    generate_icon(args.source, args.slug, args.rarity, override_color=override, output_dir=out_dir)
    print("Done.")


if __name__ == "__main__":
    main()
