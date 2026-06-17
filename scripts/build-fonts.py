#!/usr/bin/env python3
"""Build the served Inter web font from the source variable TTF.

Produces a Latin-subset, woff2-compressed variable font (both opsz + wght
axes preserved, so rendering is identical to the full font) from the upstream
Inter variable TTF kept in fonts-src/.

The subset covers every non-ASCII codepoint actually rendered on the site
(em/en dash, curly quote, ellipsis, ×÷·, arrows, a handful of math operators,
check mark) plus full Basic Latin, Latin-1, Latin Extended-A and General
Punctuation for headroom. Box-drawing glyphs are intentionally excluded —
Inter does not contain them; they live only in code fences (JetBrains Mono).

Requires: pip install "fonttools[woff]"
Run from the repo root:  python3 scripts/build-fonts.py
"""
import os
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "fonts-src", "Inter-VariableFont_opsz_wght.ttf")
DST = os.path.join(ROOT, "public", "brand", "fonts", "Inter-VariableFont_opsz_wght.woff2")

# Unicode ranges kept in the subset.
RANGES = [
    (0x0000, 0x00FF),  # Basic Latin + Latin-1 Supplement (incl. × ÷ ·)
    (0x0100, 0x017F),  # Latin Extended-A (accented names headroom)
    (0x2000, 0x206F),  # General Punctuation (– — ’ … and friends)
    (0x2190, 0x21FF),  # Arrows (← →)
    (0x2200, 0x22FF),  # Mathematical Operators (≈ ≠ ≥)
    (0x2700, 0x27BF),  # Dingbats (✓)
]


def main() -> int:
    if not os.path.exists(SRC):
        sys.exit(f"source font not found: {SRC}")

    unicodes = [cp for a, b in RANGES for cp in range(a, b + 1)]

    font = TTFont(SRC, lazy=False)

    # This Inter build ships a sparse gvar (glyphs with no deltas are omitted).
    # fontTools' subsetter assumes a dense gvar, so backfill empty entries to
    # avoid a KeyError during subsetting. Keeps both axes intact.
    gvar = font["gvar"]
    gvar.ensureDecompiled()
    for glyph in font.getGlyphOrder():
        gvar.variations.setdefault(glyph, [])

    subsetter = Subsetter(options=Options())
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)

    font.flavor = "woff2"
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    font.save(DST)

    print(f"source  {os.path.getsize(SRC):>8} bytes  {SRC}")
    print(f"woff2   {os.path.getsize(DST):>8} bytes  {DST}")
    print(f"glyphs  {font['maxp'].numGlyphs}")
    print(f"axes    {[a.axisTag for a in font['fvar'].axes]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
