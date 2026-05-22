#!/usr/bin/env python3
"""
Crops individual cosmetic icons from the Gemini composite image.
Usage:
    python scripts/crop_cosmetics.py <path/to/composite.png>
Output: public/cosmetics/<slug>.png
"""

import sys
import os
from collections import deque
from PIL import Image
import numpy as np

# Detected grid boundaries
# Row 0 (y=37–714): 4 icons
# Row 1 (y=792–1410): 5 icons
CELLS = [
    # (x0, y0, x1, y1, slug)
    (16,   37,  654, 714, "video-nebula"),
    (706,  37, 1378, 714, "overlay-blackhole"),
    (1437, 37, 2223, 714, "overlay-nevoa-rasteira"),
    (2235, 37, 2816, 714, "overlay-shimmer-dourado"),

    (28,  792,  560, 1410, "overlay-bandeiras"),
    (587, 792, 1117, 1410, "overlay-chuva-neon"),
    (1143,792, 1672, 1410, "overlay-radiancia-real"),
    (1698,792, 2230, 1410, "overlay-chama-violeta"),
    (2257,792, 2816, 1410, "overlay-scanner"),
]


def remove_background(img: Image.Image, threshold: int = 30) -> Image.Image:
    rgba = img.convert("RGBA")
    data = np.array(rgba)
    h, w = data.shape[:2]
    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
    is_near_white = (r > 255-threshold) & (g > 255-threshold) & (b > 255-threshold)
    visited = np.zeros((h, w), dtype=bool)
    queue: deque = deque()
    for y in range(h):
        for x in [0, w-1]:
            if is_near_white[y,x] and not visited[y,x]:
                visited[y,x] = True; queue.append((y,x))
    for x in range(w):
        for y in [0, h-1]:
            if is_near_white[y,x] and not visited[y,x]:
                visited[y,x] = True; queue.append((y,x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
            ny, nx = y+dy, x+dx
            if 0<=ny<h and 0<=nx<w and not visited[ny,nx] and is_near_white[ny,nx]:
                visited[ny,nx] = True; queue.append((ny,nx))
    data[visited, 3] = 0
    return Image.fromarray(data, "RGBA")


def keep_largest_component(img: Image.Image) -> Image.Image:
    arr = np.array(img)
    alpha = arr[:,:,3]
    h, w = alpha.shape
    visited = np.zeros((h, w), dtype=bool)
    components = []
    for sy in range(h):
        for sx in range(w):
            if alpha[sy,sx] > 0 and not visited[sy,sx]:
                comp = []
                queue: deque = deque([(sy, sx)])
                visited[sy,sx] = True
                while queue:
                    y, x = queue.popleft()
                    comp.append((y, x))
                    for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
                        ny, nx = y+dy, x+dx
                        if 0<=ny<h and 0<=nx<w and not visited[ny,nx] and alpha[ny,nx]>0:
                            visited[ny,nx] = True; queue.append((ny,nx))
                components.append(comp)
    if not components:
        return img
    largest = max(components, key=len)
    if len(components) > 1:
        result = arr.copy()
        largest_set = set(largest)
        for comp in components:
            if comp is not largest:
                for y, x in comp:
                    result[y,x,3] = 0
        return Image.fromarray(result, "RGBA")
    return img


def autocrop(img: Image.Image, padding: int = 12) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    w, h = img.size
    return img.crop((max(0,l-padding), max(0,t-padding),
                     min(w,r+padding), min(h,b+padding)))


def main():
    if len(sys.argv) < 2:
        print("Usage: python crop_cosmetics.py <composite.png>")
        sys.exit(1)

    src_path = sys.argv[1]
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "cosmetics")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Loading {src_path} ...")
    composite = Image.open(src_path).convert("RGBA")
    print(f"Size: {composite.size}")

    for x0, y0, x1, y1, slug in CELLS:
        cell = composite.crop((x0, y0, x1, y1))
        icon = remove_background(cell)
        icon = keep_largest_component(icon)
        icon = autocrop(icon, padding=12)

        # Fit in 320×320 canvas with guaranteed margins
        icon.thumbnail((288, 288), Image.LANCZOS)
        canvas = Image.new("RGBA", (320, 320), (0, 0, 0, 0))
        ox = (320 - icon.width) // 2
        oy = (320 - icon.height) // 2
        canvas.paste(icon, (ox, oy), icon)

        out_path = os.path.join(out_dir, f"{slug}.png")
        canvas.save(out_path, "PNG")
        bbox = canvas.getbbox()
        print(f"  {slug}.png  {icon.width}×{icon.height}  margins: t={bbox[1]} b={320-bbox[3]} l={bbox[0]} r={320-bbox[2]}")

    print(f"\nDone. Output: {os.path.abspath(out_dir)}")


if __name__ == "__main__":
    main()
