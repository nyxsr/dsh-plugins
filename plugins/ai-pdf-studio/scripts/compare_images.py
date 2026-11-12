#!/usr/bin/env python3
"""Compare two rendered pages with Pillow and emit JSON metrics."""
import json
import sys
from PIL import Image, ImageChops, ImageStat


def main():
    before = Image.open(sys.argv[1]).convert("RGB")
    after = Image.open(sys.argv[2]).convert("RGB")
    if before.size != after.size:
        print(json.dumps({"same_size": False, "before": before.size, "after": after.size, "rmse": None, "changed_pixels_ratio": None}))
        return
    diff = ImageChops.difference(before, after)
    stat = ImageStat.Stat(diff)
    rmse = (sum(value ** 2 for value in stat.rms) / 3) ** 0.5
    gray = diff.convert("L")
    histogram = gray.histogram()
    total = before.size[0] * before.size[1]
    changed = sum(histogram[12:])
    print(json.dumps({
        "same_size": True,
        "before": before.size,
        "after": after.size,
        "rmse": round(rmse, 6),
        "changed_pixels_ratio": round(changed / total, 6),
        "identical": changed == 0,
    }))


if __name__ == "__main__":
    main()
