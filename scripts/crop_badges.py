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

# ── Grid layout ───────────────────────────────────────────────────────────────
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

# Row boundaries extended upward to capture shield glows that start above the
# detected whitespace boundary.
#   Row 0: badge starts at y≈10  (was 19, fine)
#   Row 1: shield glow starts at y≈347 (was 369 → cut 22px off the top!)
#   Row 2: shield glow starts at y≈762 (was 765 → only 3px off, extended anyway)
ROWS = [
    (10, 255),
    (340, 615),
    (755, 1000),
]

# Slug mapping [row][col] — None = duplicate/skip
SLUGS = [
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
    [
        None,                              # duplicate of robin-hood
        "o-tesouro-de-ganon",
        None,                              # duplicate of o-tesouro
        "patrocinador-da-jogatina-alheia",
        "sem-amigos-mas-com-coop",
        "elo-de-guilda",
        "a-familia-que-joga-unida",
        "mestre-da-cooperacao",
    ],
    [
        "sem-casa-no-mapa",
        "membro-honroso-do-cla",
        "aquele-que-nao-sai-da-guilda",
        "fundador-de-linhagem",
        "pix-as-2-da-manha",
        None,                              # duplicate of pix-as-2
        "sem-volta-agora",
        "confiavel-como-save",
    ],
]

# ── Background removal via BFS flood fill from corners ───────────────────────
def remove_background(img: Image.Image, threshold: int = 30) -> Image.Image:
    rgba = img.convert("RGBA")
    data = np.array(rgba)
    h, w = data.shape[:2]

    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    is_near_white = (r > 255 - threshold) & (g > 255 - threshold) & (b > 255 - threshold)

    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

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

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_near_white[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    data[visited, 3] = 0
    return Image.fromarray(data, "RGBA")


def keep_largest_component(img: Image.Image) -> Image.Image:
    """
    Keeps only the largest connected group of non-transparent pixels.
    Removes stray header-text fragments left after background removal.
    """
    arr = np.array(img)
    alpha = arr[:, :, 3]
    h, w = alpha.shape

    visited = np.zeros((h, w), dtype=bool)
    components: list[list[tuple[int, int]]] = []

    for sy in range(h):
        for sx in range(w):
            if alpha[sy, sx] > 0 and not visited[sy, sx]:
                component: list[tuple[int, int]] = []
                queue: deque[tuple[int, int]] = deque([(sy, sx)])
                visited[sy, sx] = True
                while queue:
                    y, x = queue.popleft()
                    component.append((y, x))
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and alpha[ny, nx] > 0:
                            visited[ny, nx] = True
                            queue.append((ny, nx))
                components.append(component)

    if not components:
        return img

    largest = max(components, key=len)
    # Zero out every non-transparent pixel that isn't in the largest component
    if len(components) > 1:
        largest_set = set(largest)
        result = arr.copy()
        for comp in components:
            if comp is not largest:
                for y, x in comp:
                    result[y, x, 3] = 0
        return Image.fromarray(result, "RGBA")

    return img


def autocrop(img: Image.Image, padding: int = 14) -> Image.Image:
    """Trims transparent borders, adds padding so glow/stars aren't clipped."""
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
            badge = keep_largest_component(badge)

            # 1. Tight-crop to ALL non-transparent pixels (glow included, no extra air).
            bbox = badge.getbbox()
            if not bbox:
                skipped += 1
                continue
            badge = badge.crop(bbox)

            # 2. Resize content to CONTENT_H=252 preserving aspect ratio.
            #    Every badge ends up the same visual height — no variable transparent padding.
            CONTENT_H = 252
            CONTENT_W = 252
            CANVAS    = 320
            MARGIN    = (CANVAS - CONTENT_H) // 2   # 34px fixed top & bottom

            scale = CONTENT_H / badge.height
            new_w = int(badge.width * scale)
            new_h = CONTENT_H
            if new_w > CONTENT_W:
                scale = CONTENT_W / badge.width
                new_w = CONTENT_W
                new_h = int(badge.height * scale)
            badge = badge.resize((new_w, new_h), Image.LANCZOS)

            # 3. Center on canvas with fixed margins.
            canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
            offset_x = (CANVAS - new_w) // 2
            offset_y = MARGIN                        # always 34px from top
            canvas.paste(badge, (offset_x, offset_y), badge)

            out_path = os.path.join(out_dir, f"{slug}.png")
            canvas.save(out_path, "PNG")
            bx = canvas.getbbox()
            print(f"  [{row_i},{col_i}] {slug}.png  {new_w}×{new_h}  t={bx[1]} b={CANVAS-bx[3]} l={bx[0]} r={CANVAS-bx[2]}")
            saved += 1

    print(f"\nDone: {saved} saved, {skipped} skipped.")
    print(f"Output: {os.path.abspath(out_dir)}")


if __name__ == "__main__":
    main()
