#!/usr/bin/env python3
"""Generate every SWALHA presentation asset from the canonical logo.

The canonical artwork (``brand/swalha-logo.png``) is checked in byte-for-byte as
downloaded from https://swalha.com/logo.png and is never modified. Everything
this script writes is a deterministic transform of it -- resize (Lanczos),
centre, and composite onto a flat brand background. The gold horse/S artwork is
never redrawn or recoloured.

Run from the repo root:

    python3 scripts/generate-brand-assets.py

Re-running is idempotent: identical input produces byte-identical output.
"""

from __future__ import annotations

import hashlib
import pathlib
import shutil
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
CANONICAL = ROOT / "brand" / "swalha-logo.png"

# Canvas colour for surfaces that cannot carry transparency (Apple touch icons
# flatten alpha onto black, social cards are composited by the platform).
# Matches --background in the dark theme (DESIGN.md).
BACKDROP = (20, 20, 20, 255)

# Public asset directories that serve the mark to browsers.
PUBLIC_DIRS = [ROOT / "client" / "public" / "swalha", ROOT / "docs" / "public" / "swalha"]

# Next.js App Router icon conventions.
APP_DIRS = [ROOT / "client" / "src" / "app", ROOT / "docs" / "src" / "app"]

MARK_SIZES = [512, 256, 192, 128, 64, 32]

# PNG encoder settings pinned so output is reproducible across runs/machines.
PNG_OPTS = {"format": "PNG", "optimize": True, "compress_level": 9}


def save(image: Image.Image, path: pathlib.Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, **PNG_OPTS)
    print(f"  {path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]} {image.mode}")


def resized(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.LANCZOS)


def on_backdrop(source: Image.Image, canvas: tuple[int, int], mark_height: int) -> Image.Image:
    """Centre the mark, scaled to ``mark_height``, on an opaque brand canvas."""
    out = Image.new("RGBA", canvas, BACKDROP)
    mark = resized(source, mark_height)
    out.alpha_composite(mark, ((canvas[0] - mark_height) // 2, (canvas[1] - mark_height) // 2))
    return out


def main() -> int:
    if not CANONICAL.exists():
        print(f"canonical logo missing: {CANONICAL}", file=sys.stderr)
        return 1

    digest = hashlib.sha256(CANONICAL.read_bytes()).hexdigest()
    source = Image.open(CANONICAL).convert("RGBA")
    print(f"canonical: {CANONICAL.relative_to(ROOT)} {source.size[0]}x{source.size[1]} sha256={digest[:16]}…")

    for public in PUBLIC_DIRS:
        print(f"\npublic assets -> {public.relative_to(ROOT)}")
        # Served verbatim: the canonical file's own bytes, not a re-encode.
        (public).mkdir(parents=True, exist_ok=True)
        shutil.copyfile(CANONICAL, public / "logo.png")
        print(f"  {(public / 'logo.png').relative_to(ROOT)}  (canonical bytes)")
        for size in MARK_SIZES:
            save(resized(source, size), public / f"mark-{size}.png")
        # Maskable PWA icon: safe-zone padded (mark at 60% of the canvas) so
        # aggressive platform masks never clip the artwork.
        save(on_backdrop(source, (512, 512), 308), public / "mark-maskable-512.png")

    for app in APP_DIRS:
        print(f"\napp icons -> {app.relative_to(ROOT)}")
        save(resized(source, 512), app / "icon.png")
        # Apple flattens alpha onto black, so ship an opaque, padded tile.
        save(on_backdrop(source, (180, 180), 144), app / "apple-icon.png")
        save(on_backdrop(source, (1200, 630), 380), app / "opengraph-image.png")

    print("\ndone")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
