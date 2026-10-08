#!/usr/bin/env python3
"""Build every icon and brand asset from one 1024x1024 master PNG.

    python3 tools/make-icons.py [path/to/master.png]      (default: Speira-2.png)

Writes brand/ (clean masters, macOS .icns, social preview) and brand/web/ (favicons,
touch + PWA icons, manifest, HTML snippet). Safe to re-run whenever the artwork changes.

Every output is 8-bit sRGB with metadata stripped; fully transparent pixels carry no
hidden colour; downscaling is done on premultiplied alpha so edges never fringe.
"""
import json, subprocess, sys, shutil, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'Speira-2.png'
OUT, WEB = ROOT / 'brand', ROOT / 'brand' / 'web'
NAME, BG, GOLD = 'Speira', (0, 0, 0), (233, 196, 106)
OUT.mkdir(exist_ok=True); WEB.mkdir(exist_ok=True)


def clean(im):
    """RGBA, with the colour of fully transparent pixels zeroed (removes hidden bloom streaks)."""
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    hidden = a.point(lambda v: 255 if v else 0, '1')
    black = Image.new('L', im.size, 0)
    return Image.merge('RGBA', [Image.composite(c, black, hidden) for c in (r, g, b)] + [a])


def shrink(im, size, sharpen=False):
    """High-quality downscale on premultiplied alpha; a touch of sharpening for tiny sizes."""
    out = im.convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
    if sharpen:
        out = out.filter(ImageFilter.UnsharpMask(radius=.6, percent=60, threshold=1))
    return clean(out)


def save(im, path):
    im.save(path, 'PNG', optimize=True)          # no iCCP/EXIF/text chunks: untagged = sRGB
    return path


def flat(im):
    """Square, fully opaque: transparent corners filled with the background."""
    base = Image.new('RGBA', im.size, BG + (255,))
    base.alpha_composite(im)
    return base.convert('RGB')


src = Image.open(SRC)
assert src.size == (1024, 1024), f'master must be 1024x1024, got {src.size}'
rounded = clean(src)
square = flat(rounded)
made = []

# ---------- masters ----------
made.append(save(rounded, OUT / 'speira-icon-rounded-1024.png'))
made.append(save(square, OUT / 'speira-icon-square-1024.png'))

# ---------- website ----------
for s in (16, 32):
    made.append(save(shrink(rounded, s, sharpen=True), WEB / f'favicon-{s}.png'))
ico_sizes = [16, 32, 48]
shrink(rounded, 48, sharpen=True).save(WEB / 'favicon.ico', sizes=[(s, s) for s in ico_sizes])
made.append(WEB / 'favicon.ico')
# Apple applies its own rounded mask to touch icons, so they must be square and opaque
made.append(save(shrink(square.convert('RGBA'), 180).convert('RGB'), WEB / 'apple-touch-icon.png'))
for s in (192, 512):
    made.append(save(shrink(rounded, s), WEB / f'icon-{s}.png'))
# maskable: Android crops to a shape inside the central 80% circle; the gold ring sits inside it
made.append(save(shrink(square.convert('RGBA'), 512).convert('RGB'), WEB / 'icon-maskable-512.png'))
manifest = {
    'name': NAME, 'short_name': NAME, 'start_url': '/', 'display': 'standalone',
    'background_color': '#000000', 'theme_color': '#000000',
    'icons': [
        {'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
(WEB / 'site.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n')
made.append(WEB / 'site.webmanifest')

# ---------- macOS .icns on Apple's grid: 824px rounded tile, centred, soft shadow ----------
def mac_tile():
    tile = 824
    art = square.resize((tile, tile), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (tile * 4, tile * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tile * 4 - 1, tile * 4 - 1], radius=185 * 4, fill=255)
    art.putalpha(mask.resize((tile, tile), Image.LANCZOS))
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    shadow = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    sm = Image.new('L', (1024, 1024), 0)
    sm.paste(art.getchannel('A'), (100, 112))
    shadow.putalpha(sm.point(lambda v: int(v * .35)).filter(ImageFilter.GaussianBlur(14)))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(art, (100, 100))
    return clean(canvas)

mac = mac_tile()
made.append(save(mac, OUT / 'speira-macos-1024.png'))
iconset = Path(tempfile.mkdtemp()) / f'{NAME}.iconset'
iconset.mkdir()
for base in (16, 32, 128, 256, 512):
    save(shrink(mac, base, sharpen=base <= 32), iconset / f'icon_{base}x{base}.png')
    save(shrink(mac, base * 2, sharpen=base * 2 <= 32), iconset / f'icon_{base}x{base}@2x.png')
subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(OUT / f'{NAME}.icns')], check=True)
shutil.rmtree(iconset.parent)
made.append(OUT / f'{NAME}.icns')

# ---------- social preview (Open Graph / Twitter), 1200x630 ----------
def font(paths, size, weight=None):
    for p in paths:
        p = Path(p).expanduser()
        if p.exists():
            f = ImageFont.truetype(str(p), size)
            if weight:
                try: f.set_variation_by_axes([weight])
                except Exception: pass
            return f
    return None

og = Image.new('RGB', (1200, 630), (14, 16, 26))   # a shade lighter than the icon, so the icon reads as a tile
icon = shrink(rounded, 440)
og.paste(icon, (90, 95), icon)
cinzel = font(['~/Library/Fonts/Cinzel-VariableFont_wght.ttf', '/Library/Fonts/Cinzel-VariableFont_wght.ttf'], 112, weight=600)
if cinzel:
    d = ImageDraw.Draw(og)
    d.text((585, 315), NAME.upper(), font=cinzel, fill=GOLD, anchor='lm')
    small = font(['~/Library/Fonts/Cinzel-VariableFont_wght.ttf'], 30, weight=500)
    d.text((590, 400), 'SPIRAL ART STUDIO', font=small, fill=(150, 160, 185), anchor='lm')
made.append(save(og, OUT / 'speira-social-1200x630.png'))

# ---------- HTML snippet ----------
(WEB / 'head-snippet.html').write_text('''<!-- Speira icons: copy brand/web/* to your site root, then paste into <head> -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#000000">
<meta property="og:image" content="/speira-social-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
''')
made.append(WEB / 'head-snippet.html')

for p in made:
    print(f'{p.relative_to(ROOT)!s:44} {p.stat().st_size / 1024:8.1f} KB')
