#!/usr/bin/env python3
"""Per-page visual and ink metrics using Pillow.

Input is a JSON list of image paths on stdin. Output is a JSON list of metrics.
This is deliberately heuristic: it measures geometry, ink, contrast, whitespace,
and colour, not subjective aesthetics.
"""
import json
import sys
from statistics import mean

from PIL import Image, ImageChops, ImageFilter, ImageStat


def dominant_background(image):
    """The modal colour is the page surface, even on split covers."""
    small = image.resize((160, max(1, int(160 * image.height / image.width))), Image.Resampling.BOX)
    quantized = small.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    colors = quantized.convert('RGB').getcolors(160 * small.height) or [(1, (255, 255, 255))]
    return max(colors, key=lambda item: item[0])[1]


def analyze(path):
    image = Image.open(path).convert("RGB")
    original_size = image.size
    # Limit work to 700px wide; metrics are scale invariant.
    if image.width > 700:
        ratio = 700 / image.width
        image = image.resize((700, max(1, int(image.height * ratio))), Image.Resampling.LANCZOS)
    width, height = image.size
    bg = dominant_background(image)
    bg_image = Image.new("RGB", image.size, bg)
    diff = ImageChops.difference(image, bg_image).convert("L")
    # Ink threshold 26/255 is low enough for hairlines but ignores JPEG noise.
    mask = diff.point(lambda value: 255 if value > 26 else 0)
    histogram = mask.histogram()
    total = width * height
    ink_pixels = histogram[255]
    ink_ratio = ink_pixels / total if total else 0
    bbox = mask.getbbox()

    gray = image.convert("L")
    stats = ImageStat.Stat(gray)
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_hist = edges.histogram()
    edge_ratio = sum(edge_hist[40:]) / total if total else 0

    quantized = image.quantize(colors=7, method=Image.Quantize.MEDIANCUT)
    colors = quantized.convert("RGB").getcolors(width * height) or []
    colors = sorted(colors, reverse=True)[:7]
    dominant = [
        {"hex": "#%02X%02X%02X" % color, "fraction": round(count / total, 5)}
        for count, color in colors
    ]

    # Ink centre of mass from a coarse 7x9 grid.
    cols, rows = 7, 9
    grid = []
    mask_small = mask.resize((cols, rows), Image.Resampling.BOX)
    data = list(mask_small.getdata())
    for row in range(rows):
        grid.append([data[row * cols + col] / 255 for col in range(cols)])
    weighted_x = 0.0
    weighted_y = 0.0
    weight = 0.0
    for row in range(rows):
        for col in range(cols):
            value = grid[row][col]
            weighted_x += (col + 0.5) / cols * value
            weighted_y += (row + 0.5) / rows * value
            weight += value
    center_x = weighted_x / weight if weight else 0.5
    center_y = weighted_y / weight if weight else 0.5

    colorfulness = 0.0
    channel_spread = []
    for pixel in image.resize((120, max(1, int(120 * height / width))), Image.Resampling.BOX).getdata():
        channel_spread.append(max(pixel) - min(pixel))
    if channel_spread:
        colorfulness = mean(channel_spread) / 255

    margins = None
    if bbox:
        left, top, right, bottom = bbox
        margins = {
            "left_px": left,
            "top_px": top,
            "right_px": width - right,
            "bottom_px": height - bottom,
            "left_pct": round(left / width, 4),
            "top_pct": round(top / height, 4),
            "right_pct": round((width - right) / width, 4),
            "bottom_pct": round((height - bottom) / height, 4),
        }

    is_dark = sum(bg) / 3 < 96
    return {
        "path": path,
        "width_px": original_size[0],
        "height_px": original_size[1],
        "analysis_width": width,
        "analysis_height": height,
        "background": "#%02X%02X%02X" % bg,
        "is_dark": is_dark,
        "ink_ratio": round(ink_ratio, 5),
        "whitespace_ratio": round(1 - ink_ratio, 5),
        "edge_ratio": round(edge_ratio, 5),
        "luma_mean": round(stats.mean[0], 2),
        "luma_stddev": round(stats.stddev[0], 2),
        "colorfulness": round(colorfulness, 4),
        "ink_center_x": round(center_x, 4),
        "ink_center_y": round(center_y, 4),
        "dominant_colors": dominant,
        "content_bbox": margins,
        "blank_candidate": ink_ratio < 0.004 and edge_ratio < 0.002,
        "overcrowded_candidate": ink_ratio > 0.52,
    }


def main():
    paths = json.load(sys.stdin)
    results = []
    for path in paths:
        try:
            results.append(analyze(path))
        except Exception as error:  # keep the batch deterministic
            results.append({"path": path, "error": str(error)})
    json.dump(results, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
