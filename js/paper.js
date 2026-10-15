// Paper: sizes, orientation, print resolution and surface textures.
// World units stay fixed to the kit (4 units per millimetre), so a wheel is the same physical size on
// any sheet — on A3 your patterns look smaller, exactly as on real paper. Screen sizes (px) are scaled so
// their short side is 1000 units.

const MM = 4;
const PAPER_PRESETS = {
  square: { label: 'Square (25 cm)', unit: 'mm', w: 250, h: 250 },
  a5: { label: 'A5', unit: 'mm', w: 148, h: 210 },
  a4: { label: 'A4', unit: 'mm', w: 210, h: 297 },
  a3: { label: 'A3', unit: 'mm', w: 297, h: 420 },
  letter: { label: 'US Letter', unit: 'in', w: 8.5, h: 11 },
  phone: { label: 'Phone wallpaper', unit: 'px', w: 1179, h: 2556 },
  desktop: { label: 'Desktop wallpaper (4K)', unit: 'px', w: 3840, h: 2160 },
  insta: { label: 'Instagram square', unit: 'px', w: 1080, h: 1080 },
  instaP: { label: 'Instagram portrait', unit: 'px', w: 1080, h: 1350 },
  custom: { label: 'Custom size…' }
};
const DEFAULT_PAPER = { preset: 'square', unit: 'mm', w: 250, h: 250, dpi: 300, scale: 1, texture: 'none' };

// paper size in world units
function paperWorld(p) {
  if (p.unit === 'mm') return [p.w * MM, p.h * MM];
  if (p.unit === 'cm') return [p.w * 10 * MM, p.h * 10 * MM];
  if (p.unit === 'in') return [p.w * 25.4 * MM, p.h * 25.4 * MM];
  const k = 1000 / Math.min(p.w, p.h); return [p.w * k, p.h * k];
}
// exported pixel size
function paperPixels(p) {
  if (p.unit === 'px') return [Math.round(p.w * p.scale), Math.round(p.h * p.scale)];
  const inch = p.unit === 'mm' ? 25.4 : p.unit === 'cm' ? 2.54 : 1;
  return [Math.round(p.w / inch * p.dpi), Math.round(p.h / inch * p.dpi)];
}
const fmtNum = v => +(+v).toFixed(2);
function paperLabel(p) {
  const [pw, ph] = paperPixels(p);
  return p.unit === 'px' ? `${pw} × ${ph} px` : `${fmtNum(p.w)} × ${fmtNum(p.h)} ${p.unit} · ${pw} × ${ph} px at ${p.dpi} dpi`;
}

// ---------- textures ----------
// Mid-grey noise tiles (128 = neutral) laid over the page with soft-light, so they read on light and dark paper.
const TEXTURES = { none: 'Smooth', grain: 'Paper grain', cold: 'Watercolour', kraft: 'Kraft fibres' };
const TILE = 512, TILE_WORLD = 128;   // one tile covers 32 mm
const tileCache = {};
function textureTile(kind) {
  if (kind === 'none') return null;
  if (tileCache[kind]) return tileCache[kind];
  let seed = { grain: 11, cold: 23, kraft: 37 }[kind];
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const c = document.createElement('canvas'); c.width = c.height = TILE; const x = c.getContext('2d');
  const img = x.createImageData(TILE, TILE), d = img.data;
  const fine = kind === 'grain' ? 34 : kind === 'cold' ? 14 : 22;
  for (let i = 0; i < d.length; i += 4) { const v = 128 + (rnd() - .5) * fine * 2; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  if (kind === 'grain') { x.globalAlpha = .5; x.filter = 'blur(.6px)'; x.drawImage(c, 0, 0); x.filter = 'none'; x.globalAlpha = 1; }
  if (kind === 'cold') {
    // soft bumps of a cold-press sheet: smooth low-frequency blotches, tiled seamlessly
    const s = document.createElement('canvas'); s.width = s.height = 24; const sx = s.getContext('2d'), si = sx.createImageData(24, 24);
    for (let i = 0; i < si.data.length; i += 4) { const v = 128 + (rnd() - .5) * 110; si.data[i] = si.data[i + 1] = si.data[i + 2] = v; si.data[i + 3] = 255; }
    sx.putImageData(si, 0, 0);
    x.globalAlpha = .75; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) x.drawImage(s, ox, oy, TILE, TILE);
    x.globalAlpha = 1;
  }
  if (kind === 'kraft') {
    for (let i = 0; i < 420; i++) {
      const fx = rnd() * TILE, fy = rnd() * TILE, a = rnd() * Math.PI, len = 6 + rnd() * 22, v = rnd() < .5 ? 70 : 200;
      x.strokeStyle = `rgba(${v},${v},${v},${.25 + rnd() * .35})`; x.lineWidth = .6 + rnd() * .9;
      for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
        x.beginPath(); x.moveTo(fx + ox, fy + oy); x.quadraticCurveTo(fx + ox + Math.cos(a) * len / 2 + (rnd() - .5) * 4, fy + oy + Math.sin(a) * len / 2, fx + ox + Math.cos(a) * len, fy + oy + Math.sin(a) * len); x.stroke();
      }
    }
  }
  return (tileCache[kind] = c);
}
const TEXTURE_STRENGTH = { grain: .55, cold: .75, kraft: .7 };
// draw the texture over a paper of size w×h (world units) on a context already in world space
function drawTexture(c, kind, w, h, x = 0, y = 0) {
  const t = textureTile(kind); if (!t) return;
  const pat = c.createPattern(t, 'repeat');
  pat.setTransform(new DOMMatrix().scale(TILE_WORLD / TILE));
  c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = TEXTURE_STRENGTH[kind];
  c.fillStyle = pat; c.fillRect(x, y, w, h); c.restore();
}
function textureSVG(kind, w, h) {
  const t = textureTile(kind); if (!t) return '';
  return `<defs><pattern id="tex" patternUnits="userSpaceOnUse" width="${TILE_WORLD}" height="${TILE_WORLD}"><image href="${t.toDataURL('image/png')}" width="${TILE_WORLD}" height="${TILE_WORLD}"/></pattern></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#tex)" opacity="${TEXTURE_STRENGTH[kind]}" style="mix-blend-mode:soft-light"/>`;
}
