#!/usr/bin/env python3
"""
Crops individual achievement badges from the NanoBanana composite image.
Removes the white background and saves each badge as a transparent PNG.

Usage:
    python scripts/crop_badges.py <path/to/composite.png>

Output: public/badges/<slug>.png
"""

import sys
import os
from collections import deque
from PIL import Image
import numpy as np

# ── Grid layout (detected from composite image analysis) ─────────────────────
# Column boundaries: [x_start, x_end] for each of the 8 columns
COLS = [
    (23, 230),
    (270, 483),
    (520, 735),
    (768, 990),
    (1026, 1236),
    (1276, 1492),
    (1527, 1743),
    (1774, 1996),
]

# Row boundaries: [y_start, y_end] for each of the 3 badge rows
ROWS = [
    (19, 249),
    (369, 602),
    (765, 992),
]

# Slug mapping [row][col] — None = duplicate/skip
SLUGS = [
    # Row 0 — Terror (0-3) + Generosidade partial (4-7)
    [
        "colecionador-de-traumas",
        "dormiu-com-a-luz-acesa",
        "nao-pode-assistir-mas-pode-comprar",
        "senhor-das-trevas",
        "mecenas-da-dungeon",
        "lancador-de-coin",
        "compra-tudo-nao-pode",
        "robin-hood-dos-pixels",
    ],
    # Row 1 — Generosidade continued (0-3, cols 0 and 2 are duplicates) + Co-op (4-7)
    [
        None,                            # duplicate of robin-hood
        "o-tesouro-de-ganon",
        None,                            # duplicate of o-tesouro
        "patrocinador-da-jogatina-alheia",
        "sem-amigos-mas-com-coop",
        "elo-de-guilda",
        "a-familia-que-joga-unida",
        "mestre-da-cooperacao",
    ],
    # Row 2 — Família (0-3) + Comportamento (4-7, col 5 is duplicate)
    [
        "sem-casa-no-mapa",
        "membro-honroso-do-cla",
        "aquele-que-nao-sai-da-guilda",
        "fundador-de-linhagem",
        "pix-as-2-da-manha",
        None,                            # duplicate of pix-as-2
        "sem-volta-agora",
        "confiavel-como-save",
    ],
]

# ── Background removal via BFS flood fill from corners ───────────────────────
def remove_background(img: Image.Image, threshold: int = 30) -> Image.Image:
    """
    Flood-fills from all 4 corners, making near-white pixels transparent.
    Stops at shield borders (dark/colored pixels).
    """
    rgba = img.convert("RGBA")
    data = np.array(rgba)
    w, h = rgba.size

    # Mark pixels as "background candidate" if they are near white
    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    is_near_white = (r > 255 - threshold) & (g > 255 - threshold) & (b > 255 - threshold)

    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    # Seed from all 4 corners and all edge pixels that are near-white
    for y in range(h):
        for x in [0, w - 1]:
            if is_near_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    for x in range(w):
        for y in [0, h - 1]:
            if is_near_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))

    # BFS
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_near_white[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    # Make background pixels transparent
    data[visited, 3] = 0
    return Image.fromarray(data, "RGBA")


def autocrop(img: Image.Image, padding: int = 4) -> Image.Image:
    """Trims transparent borders, adds small padding."""
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    w, h = img.size
    l = max(0, l - padding)
    t = max(0, t - padding)
    r = min(w, r + padding)
    b = min(h, b + padding)
    return img.crop((l, t, r, b))


def main():
    if len(sys.argv) < 2:
        print("Usage: python crop_badges.py <composite.png>")
        sys.exit(1)

    src_path = sys.argv[1]
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "badges")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Loading {src_path} ...")
    composite = Image.open(src_path).convert("RGBA")
    print(f"Image size: {composite.size}")

    saved = 0
    skipped = 0

    for row_i, (y0, y1) in enumerate(ROWS):
        for col_i, (x0, x1) in enumerate(COLS):
            slug = SLUGS[row_i][col_i]
            if slug is None:
                skipped += 1
                continue

            cell = composite.crop((x0, y0, x1, y1))
            badge = remove_background(cell)
            badge = autocrop(badge)

            # Resize to 256×256 for the web (keeps aspect ratio by padding)
            badge.thumbnail((256, 256), Image.LANCZOS)
            canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
            offset_x = (256 - badge.width) // 2
            offset_y = (256 - badge.height) // 2
            canvas.paste(badge, (offset_x, offset_y), badge)

            out_path = os.path.join(out_dir, f"{slug}.png")
            canvas.save(out_path, "PNG")
            print(f"  [{row_i},{col_i}] {slug}.png → {badge.width}×{badge.height}")
            saved += 1

    print(f"\nDone: {saved} badges saved, {skipped} duplicates skipped.")
    print(f"Output: {os.path.abspath(out_dir)}")


if __name__ == "__main__":
    main()
