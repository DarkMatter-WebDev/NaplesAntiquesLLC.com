#!/usr/bin/env python3
"""Regenerate the Material Symbols subset from all icon names used in source."""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SRC_DIRS = [ROOT / "src", ROOT / "carousel"]
FULL_FONT = ROOT / "public/assets/fonts/material-symbols-full-v357.woff2"
OUT_FONT = ROOT / "public/assets/fonts/material-symbols-subset-v358.woff2"
# Backward-compat alias for browsers / HTML still cached on the old filename
# (deleting v357 caused 404s and `font-display: block` fell back to ligature text).
OUT_FONT_LEGACY = ROOT / "public/assets/fonts/material-symbols-subset-v357.woff2"
KEEP_GLYPHS = ROOT / "public/assets/fonts/.subset-keep-glyphs.txt"

# Material Symbols ligatures are built from these component letters. Always keep
# the full set so GSUB rules never lose a component glyph (v358's 157-glyph cut
# was smaller than v357's 180 and was more fragile across browsers).
BASELINE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_ "

ICON_TOKEN = re.compile(r"^[a-z][a-z0-9_]*$")
MSO_BLOCK = re.compile(r"material-symbols-outlined[^>]*>([^<{]+)<", re.DOTALL)
MSO_EXPR = re.compile(r"material-symbols-outlined[^>]*>\{([^}]+)\}", re.DOTALL)
QUOTED_SNAKE = re.compile(r"""['"]([a-z][a-z0-9_]*)['"]""")
ICON_FIELD = re.compile(r"""icon:\s*['"]([a-z][a-z0-9_]*)['"]""")


def collect_candidates(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    out: set[str] = set()

    for block in MSO_BLOCK.findall(text):
        for line in block.splitlines():
            token = line.strip()
            if token and ICON_TOKEN.match(token):
                out.add(token)

    for expr in MSO_EXPR.findall(text):
        for match in QUOTED_SNAKE.findall(expr):
            if ICON_TOKEN.match(match):
                out.add(match)

    for match in ICON_FIELD.findall(text):
        out.add(match)

    for match in QUOTED_SNAKE.findall(text):
        if ICON_TOKEN.match(match):
            out.add(match)

    return out


def collect_all_candidates() -> list[str]:
    names: set[str] = set()
    for src_dir in SRC_DIRS:
        if not src_dir.exists():
            continue
        for path in src_dir.rglob("*"):
            if path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".css", ".html"}:
                continue
            names.update(collect_candidates(path))
    return sorted(names)


def get_subtables(lookup):
    for sub in lookup.SubTable:
        if type(sub).__name__ == "ExtensionSubst":
            yield sub.ExtSubTable
        else:
            yield sub


def build_ligature_map(font: TTFont) -> dict[str, str]:
    cmap = font.getBestCmap()
    glyph_to_char = {glyph: chr(code) for code, glyph in cmap.items()}
    lig_map: dict[str, str] = {}
    gsub = font["GSUB"]
    for lookup in gsub.table.LookupList.Lookup:
        for subtable in get_subtables(lookup):
            if not hasattr(subtable, "ligatures"):
                continue
            for first_glyph, lig_list in subtable.ligatures.items():
                first_char = glyph_to_char.get(first_glyph)
                if not first_char:
                    continue
                for lig in lig_list:
                    chars = [first_char]
                    ok = True
                    comps = getattr(lig, "Component", None) or getattr(lig, "components", [])
                    for comp in comps:
                        ch = glyph_to_char.get(comp)
                        if not ch:
                            ok = False
                            break
                        chars.append(ch)
                    if ok:
                        lig_map["".join(chars)] = lig.LigGlyph
    return lig_map


def resolve_icons(font: TTFont, candidates: list[str]) -> tuple[set[str], list[str], list[str]]:
    lig_map = build_ligature_map(font)
    cmap = font.getBestCmap()

    kept: set[str] = set()
    resolved: list[str] = []
    missing: list[str] = []

    for name in candidates:
        target = lig_map.get(name)
        if not target:
            missing.append(name)
            continue
        resolved.append(name)
        kept.add(target)
        for ch in name:
            glyph = cmap.get(ord(ch))
            if glyph:
                kept.add(glyph)

    return kept, resolved, missing


def main() -> int:
    if not FULL_FONT.exists():
        print(f"Missing full font: {FULL_FONT}", file=sys.stderr)
        return 1

    candidates = collect_all_candidates()
    print(f"Candidate names: {len(candidates)}")

    font = TTFont(str(FULL_FONT))
    kept, resolved, unresolved = resolve_icons(font, candidates)
    cmap = font.getBestCmap()
    for ch in BASELINE_CHARS:
        glyph = cmap.get(ord(ch))
        if glyph:
            kept.add(glyph)
    print(f"Resolved icons: {len(resolved)}")
    if unresolved:
        print(f"Unresolved (not icon ligatures): {len(unresolved)}")

    if "drag_indicator" not in resolved:
        print("ERROR: drag_indicator did not resolve", file=sys.stderr)
        return 1
    print("  includes drag_indicator")

    KEEP_GLYPHS.write_text("\n".join(sorted(kept)) + "\n", encoding="utf-8")
    print(f"Keeping {len(kept)} glyphs")

    if OUT_FONT.exists():
        OUT_FONT.unlink()
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(FULL_FONT),
            f"--glyphs-file={KEEP_GLYPHS}",
            "--layout-features+=liga,dlig,clig,calt,rlig",
            "--no-layout-closure",
            "--flavor=woff2",
            f"--output-file={OUT_FONT}",
        ],
        check=True,
    )

    subset = TTFont(str(OUT_FONT))
    _, resolved2, missing2 = resolve_icons(subset, resolved)
    print(f"Subset size: {OUT_FONT.stat().st_size:,} bytes")
    print(f"MISSING in subset: {len(missing2)}")
    if missing2:
        print(", ".join(missing2), file=sys.stderr)
        return 1
    print("All resolved icons present in subset.")
    shutil.copy2(OUT_FONT, OUT_FONT_LEGACY)
    print(f"Legacy alias written: {OUT_FONT_LEGACY.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
