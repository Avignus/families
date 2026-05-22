#!/usr/bin/env python3
"""
Auto-detect and crop shield badges from any sheet image, removing the white background.

Usage:
    python scripts/crop_badges_auto.py <sheet.png> [output_dir]

Output:
    <output_dir>/badge_01.png … badge_N.png  (RGBA, transparent background)

Dependencies:
    pip install opencv-python pillow numpy
"""

import sys
import os
from collections import deque
import numpy as np
from PIL import Image
import cv2


# ── Background removal (BFS flood-fill from all four corners) ─────────────────

def remove_background(img: Image.Image, threshold: int = 28) -> Image.Image:
    rgba = np.array(img.convert("RGBA"))
    r, g, b = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2]
    near_white = (r > 255 - threshold) & (g > 255 - threshold) & (b > 255 - threshold)

    h, w = rgba.shape[:2]
    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if not visited[y, x] and near_white[y, x]:
            visited[y, x] = True
            queue.append((y, x))

    for y in range(h):
        seed(y, 0); seed(y, w - 1)
    for x in range(w):
        seed(0, x); seed(h - 1, x)

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and near_white[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    rgba[visited, 3] = 0
    return Image.fromarray(rgba, "RGBA")


# ── Keep only the largest opaque connected component (drop stray text pixels) ─

def keep_largest(img: Image.Image) -> Image.Image:
    arr = np.array(img)
    alpha = arr[:, :, 3]
    h, w = alpha.shape

    labels = np.zeros((h, w), dtype=np.int32)
    comp_sizes: list[int] = []
    label = 0

    for sy in range(h):
        for sx in range(w):
            if alpha[sy, sx] > 0 and labels[sy, sx] == 0:
                label += 1
                size = 0
                q: deque[tuple[int, int]] = deque([(sy, sx)])
                labels[sy, sx] = label
                while q:
                    y, x = q.popleft()
                    size += 1
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and labels[ny, nx] == 0 and alpha[ny, nx] > 0:
                            labels[ny, nx] = label
                            q.append((ny, nx))
                comp_sizes.append(size)

    if not comp_sizes:
        return img

    best_label = int(np.argmax(comp_sizes)) + 1
    mask = (labels != best_label) & (alpha > 0)
    result = arr.copy()
    result[mask, 3] = 0
    return Image.fromarray(result, "RGBA")


# ── Auto-detect badge bounding boxes using OpenCV contours ───────────────────

def _merge_boxes(boxes: list[tuple[int, int, int, int]], gap: int) -> list[tuple[int, int, int, int]]:
    changed = True
    while changed:
        changed = False
        out: list[tuple[int, int, int, int]] = []
        used: set[int] = set()
        for i, (ax1, ay1, ax2, ay2) in enumerate(boxes):
            if i in used:
                continue
            for j, (bx1, by1, bx2, by2) in enumerate(boxes):
                if j <= i or j in used:
                    continue
                if ax1 - gap < bx2 and ax2 + gap > bx1 and ay1 - gap < by2 and ay2 + gap > by1:
                    ax1, ay1 = min(ax1, bx1), min(ay1, by1)
                    ax2, ay2 = max(ax2, bx2), max(ay2, by2)
                    used.add(j)
                    changed = True
            out.append((ax1, ay1, ax2, ay2))
            used.add(i)
        boxes = out
    return boxes


def find_badges(image_path: str) -> list[tuple[int, int, int, int]]:
    bgr = cv2.imread(image_path)
    if bgr is None:
        raise FileNotFoundError(f"Cannot open: {image_path}")

    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Threshold to isolate non-white pixels
    _, thresh = cv2.threshold(gray, 238, 255, cv2.THRESH_BINARY_INV)

    # Close small gaps within a single badge body
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    total = h * w
    boxes: list[tuple[int, int, int, int]] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        # Each badge is between 0.25 % and 20 % of the sheet
        if not (total * 0.0025 < area < total * 0.20):
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        ratio = bw / bh
        # Shield shape is roughly square; exclude very wide/short text blocks
        if 0.50 < ratio < 1.70:
            boxes.append((x, y, x + bw, y + bh))

    boxes = _merge_boxes(boxes, gap=20)

    # Sort row-first (row bucket = 180 px), then left-to-right
    boxes.sort(key=lambda b: (b[1] // 180, b[0]))
    return boxes


# ── Canvas normalisation (same size as existing pipeline: 320×320) ───────────

CANVAS   = 320
CONTENT  = 272          # usable area
MARGIN   = (CANVAS - CONTENT) // 2  # 24 px on each side


def normalise(badge: Image.Image) -> Image.Image:
    """Tight-crop → resize to CONTENT × CONTENT → centre on CANVAS × CANVAS."""
    bbox = badge.getbbox()
    if not bbox:
        return badge
    badge = badge.crop(bbox)

    scale = CONTENT / max(badge.width, badge.height)
    new_w = int(badge.width * scale)
    new_h = int(badge.height * scale)
    badge = badge.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - new_w) // 2
    y = MARGIN
    canvas.paste(badge, (x, y), badge)
    return canvas


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src  = sys.argv[1]
    dest = sys.argv[2] if len(sys.argv) > 2 else "badges_output"
    os.makedirs(dest, exist_ok=True)

    sheet = Image.open(src).convert("RGB")
    img_w, img_h = sheet.size
    print(f"Sheet: {src}  ({img_w}×{img_h})")

    boxes = find_badges(src)
    print(f"Detected {len(boxes)} badge(s).\n")

    pad = 10
    for i, (x1, y1, x2, y2) in enumerate(boxes, 1):
        x1c = max(0, x1 - pad)
        y1c = max(0, y1 - pad)
        x2c = min(img_w, x2 + pad)
        y2c = min(img_h, y2 + pad)

        crop   = sheet.crop((x1c, y1c, x2c, y2c))
        badge  = remove_background(crop)
        badge  = keep_largest(badge)
        badge  = normalise(badge)

        out = os.path.join(dest, f"badge_{i:02d}.png")
        badge.save(out, "PNG")
        print(f"  [{i:02d}] {out}")

    print(f"\nDone — {len(boxes)} badge(s) → '{dest}/'")


if __name__ == "__main__":
    main()
