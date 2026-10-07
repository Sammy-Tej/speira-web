// Pen styles. Each style turns a layer's line into a "plan": a list of simple drawing ops
// (stroked runs of points and dots). The same plan draws the screen, the PNG and the SVG,
// so the vector export matches the picture as closely as vectors allow.

const PEN_STYLES = {
  ballpoint: { label: 'Ballpoint', w: 1.6 },
  gel: { label: 'Gel', w: 2.2 },
  fineliner: { label: 'Fineliner', w: .9 },
  felt: { label: 'Felt-tip', w: 3.2 },
  highlighter: { label: 'Highlighter', w: 9 },
  metallic: { label: 'Metallic', w: 2.4 },
  glitter: { label: 'Glitter', w: 2.6 },
  pencil: { label: 'Pencil', w: 1.3 }
};

// ---------- colour helpers ----------
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
function rgbHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return rgbHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const luminance = hex => { const [r, g, b] = hexRgb(hex); return (.299 * r + .587 * g + .114 * b) / 255; };
// stable pseudo-random number for an integer (so glitter and grain never reshuffle as a line grows)
const hash01 = (i, seed) => { let x = Math.imul((i | 0) ^ Math.imul(seed | 0, 0x9E3779B1), 0x85EBCA6B); x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

// ---------- plan builder ----------
// xy: interleaved points for the drawn part of the line. lightPaper: whether multiply blending makes sense.
function buildPlan(L, xy, lightPaper) {
  const n = xy.length / 2, ops = [], W = L.width, base = L.color, pen = PEN_STYLES[L.pen] ? L.pen : 'ballpoint', seed = L.id * 7919;
  if (n < 2) return { xy, ops };
  // colour along the line: fixed, or a hue cycle for rainbow ink (one full rainbow every 700 paper units)
  let colourAt = () => base;
  if (L.rainbow) {
    const [h0, s0, l0] = rgbHsl(...hexRgb(base)), cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(xy[i * 2] - xy[i * 2 - 2], xy[i * 2 + 1] - xy[i * 2 - 1]);
    const s = Math.max(.65, s0), l = Math.min(.62, Math.max(.45, l0));
    colourAt = i => hslHex(h0 + 360 * cum[i] / 700, s, l);
  }
  const run = (s, e, c, w, a, extra = {}) => ops.push({ k: 'path', s, e, c, w, a, ...extra });
  const chunks = (size, fn) => { for (let s = 0; s < n - 1; s += size) fn(s, Math.min(n - 1, s + size)); };
  const solid = (w, a = 1, extra) => L.rainbow ? chunks(14, (s, e) => run(s, e, colourAt(s), w, a, extra)) : run(0, n - 1, base, w, a, extra);
  const multiply = lightPaper ? 'multiply' : null, glow = lightPaper ? 'multiply' : 'screen';

  switch (pen) {
    case 'gel':
      solid(W);
      run(0, n - 1, '#ffffff', W * .3, .42, { dx: -W * .12, dy: -W * .12 });
      break;
    case 'fineliner':
      solid(W, 1, { cap: 'round' });
      break;
    case 'felt':
      // soft halo + translucent core, laid in short strokes so crossings pool darker
      chunks(16, (s, e) => run(s, e, colourAt(s), W * 1.4, .14, { blend: multiply, cap: 'butt' }));
      chunks(16, (s, e) => run(s, e, colourAt(s), W, .5, { blend: multiply, cap: 'butt' }));
      break;
    case 'highlighter':
      chunks(18, (s, e) => run(s, e, colourAt(s), W, .3, { blend: glow, cap: 'butt' }));
      break;
    case 'metallic': {
      // anisotropic sheen: brightness follows the line's direction against a fixed light
      const [h, sat, l] = rgbHsl(...hexRgb(base));
      chunks(6, (s, e) => {
        const ang = Math.atan2(xy[e * 2 + 1] - xy[s * 2 + 1], xy[e * 2] - xy[s * 2]);
        const f = Math.abs(Math.cos(2 * (ang - .8))) ** 1.6, c0 = L.rainbow ? colourAt(s) : base;
        const [hh, ss, ll] = L.rainbow ? rgbHsl(...hexRgb(c0)) : [h, sat, l];
        run(s, e, hslHex(hh, Math.min(1, ss * .9), Math.max(.12, ll * .55) + f * (Math.min(.93, ll + .38) - Math.max(.12, ll * .55))), W, 1);
      });
      run(0, n - 1, '#ffffff', W * .26, .35, { dx: -W * .14, dy: -W * .14 });
      break;
    }
    case 'glitter': {
      solid(W, .82);
      const light = L.rainbow ? null : mixHex(base, '#ffffff', .65);
      for (let i = 0; i < n; i++) {
        const r = hash01(i, seed); if (r > .06) continue;
        const r2 = hash01(i, seed + 1), r3 = hash01(i, seed + 2);
        const j = (r3 - .5) * W * .8;
        const col = r2 < .4 ? '#ffffff' : (light || mixHex(colourAt(i), '#ffffff', .6));
        ops.push({ k: 'dot', x: xy[i * 2] + j, y: xy[i * 2 + 1] - j, r: W * (.14 + r2 * .32), c: col, a: .55 + r3 * .45, star: r2 > .9 });
      }
      break;
    }
    case 'pencil':
      // graphite: short strokes with varying pressure, plus a faint second pass
      chunks(5, (s, e) => run(s, e, colourAt(s), W * (.85 + hash01(s, seed) * .3), .35 + hash01(s, seed + 3) * .45, { blend: multiply, cap: 'butt' }));
      chunks(9, (s, e) => run(s, e, colourAt(s), W * .5, .12 + hash01(s, seed + 5) * .15, { blend: multiply, cap: 'butt', dx: W * .2, dy: -W * .15 }));
      break;
    default:
      solid(W);
  }
  return { xy, ops };
}

// ---------- canvas renderer ----------
function drawPlan(c, plan, opacity) {
  const { xy, ops } = plan;
  c.save(); c.lineJoin = 'round';
  for (const o of ops) {
    c.globalAlpha = o.a * opacity;
    c.globalCompositeOperation = o.blend || 'source-over';
    if (o.k === 'path') {
      c.strokeStyle = o.c; c.lineWidth = o.w; c.lineCap = o.cap || 'round';
      const dx = o.dx || 0, dy = o.dy || 0;
      c.beginPath(); c.moveTo(xy[o.s * 2] + dx, xy[o.s * 2 + 1] + dy);
      for (let i = o.s + 1; i <= o.e; i++) c.lineTo(xy[i * 2] + dx, xy[i * 2 + 1] + dy);
      c.stroke();
    } else {
      c.fillStyle = o.c; c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
      if (o.star) { c.strokeStyle = o.c; c.lineWidth = o.r * .35; c.beginPath(); c.moveTo(o.x - o.r * 2.6, o.y); c.lineTo(o.x + o.r * 2.6, o.y); c.moveTo(o.x, o.y - o.r * 2.6); c.lineTo(o.x, o.y + o.r * 2.6); c.stroke(); }
    }
  }
  c.restore();
}

// ---------- SVG renderer ----------
function planToSVG(plan, opacity, simplify) {
  const { xy, ops } = plan, out = [], f = v => +v.toFixed(2);
  for (const o of ops) {
    const a = +(o.a * opacity).toFixed(3), blend = o.blend ? ` style="mix-blend-mode:${o.blend}"` : '';
    if (o.k === 'path') {
      const xs = [], ys = [], dx = o.dx || 0, dy = o.dy || 0;
      for (let i = o.s; i <= o.e; i++) { xs.push(xy[i * 2] + dx); ys.push(xy[i * 2 + 1] + dy); }
      const keep = o.e - o.s > 8 ? simplify(xs, ys, .04) : xs.map((_, i) => i);
      const d = keep.map((i, k) => (k ? 'L' : 'M') + f(xs[i]) + ' ' + f(ys[i])).join('');
      out.push(`<path d="${d}" stroke="${o.c}" stroke-width="${f(o.w)}"${a < 1 ? ` stroke-opacity="${a}"` : ''}${o.cap === 'butt' ? ' stroke-linecap="butt"' : ''}${blend}/>`);
    } else {
      out.push(`<circle cx="${f(o.x)}" cy="${f(o.y)}" r="${f(o.r)}" fill="${o.c}"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`);
      if (o.star) out.push(`<path d="M${f(o.x - o.r * 2.6)} ${f(o.y)}H${f(o.x + o.r * 2.6)}M${f(o.x)} ${f(o.y - o.r * 2.6)}V${f(o.y + o.r * 2.6)}" stroke="${o.c}" stroke-width="${f(o.r * .35)}"${a < 1 ? ` stroke-opacity="${a}"` : ''}/>`);
    }
  }
  return out.join('\n');
}

if (typeof module !== 'undefined') module.exports = { PEN_STYLES, buildPlan, planToSVG, hslHex, rgbHsl, hexRgb, luminance };
