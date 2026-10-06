#!/usr/bin/env python3
"""Inline the Phosphor icons in icons/ into index.html as an SVG sprite.
Run after editing index.src.html or adding icons:  python3 tools/build.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
symbols = []
for f in sorted((root / 'icons').glob('*.svg')):
    svg = f.read_text()
    inner = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    inner = re.sub(r'<rect width="256" height="256" fill="none"/>', '', inner)
    symbols.append(f'<symbol id="i-{f.stem}" viewBox="0 0 256 256">{inner}</symbol>')
sprite = '<svg class="sprite" aria-hidden="true">' + ''.join(symbols) + '</svg>'
src = (root / 'index.src.html').read_text()
(root / 'index.html').write_text(src.replace('%%ICONS%%', sprite))
print(f'index.html built with {len(symbols)} icons')
