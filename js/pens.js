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
// A plan is a short list of ops. Each op is ONE look (colour, width, opacity, blend) and holds every stretch
// of the line drawn with that look. Effects that vary along the line (metallic sheen, rainbow, pencil pressure)
// are rounded to a small set of steps, so a whole pattern needs a few dozen ops instead of thousands.
// Inks that darken where they cross (felt-tip, highlighter) are split per quarter-lap: almost every
// crossing in a spirograph is between different laps, so each overlap still pools.
// xy: interleaved points of the drawn part. lapPts: points per lap of the pattern.
const SHEEN_STEPS = 12, HUE_STEP = 15;
function buildPlan(L, xy, lightPaper, lapPts = 400) {
  const n = xy.length / 2, ops = [], index = new Map(), W = L.width, base = L.color, seed = L.id * 7919;
  const pen = PEN_STYLES[L.pen] ? L.pen : 'ballpoint';
  if (n < 2) return { xy, ops };
  const add = (props, s, e) => {
    const key = JSON.stringify(props);
    let op = index.get(key);
    if (!op) { op = { k: 'path', runs: [], ...props }; index.set(key, op); ops.push(op); }
    const last = op.runs[op.runs.length - 1];
    if (last && last[1] === s) last[1] = e; else op.runs.push([s, e]);
  };
  const chunks = (size, fn) => { for (let s = 0; s < n - 1; s += size) fn(s, Math.min(n - 1, s + size)); };
  // rainbow: hue follows distance along the line (one full rainbow every 700 units), in 15° steps
  let colourAt = () => base;
  if (L.rainbow) {
    const [h0, s0, l0] = rgbHsl(...hexRgb(base)), cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(xy[i * 2] - xy[i * 2 - 2], xy[i * 2 + 1] - xy[i * 2 - 1]);
    const s = Math.max(.65, s0), l = Math.min(.62, Math.max(.45, l0));
    colourAt = i => hslHex(Math.round((h0 + 360 * cum[i] / 700) / HUE_STEP) * HUE_STEP, s, l);
  }
  const solid = (w, a = 1, extra = {}) => L.rainbow ? chunks(8, (s, e) => add({ c: colourAt(s), w, a, ...extra }, s, e)) : add({ c: base, w, a, ...extra }, 0, n - 1);
  const multiply = lightPaper ? 'multiply' : null, glow = lightPaper ? 'multiply' : 'screen';
  const win = Math.max(24, Math.round(lapPts / 4)), lap = s => Math.floor(s / win);

  switch (pen) {
    case 'gel':
      solid(W);
      add({ c: '#ffffff', w: W * .3, a: .42, dx: -W * .12, dy: -W * .12 }, 0, n - 1);
      break;
    case 'fineliner':
      solid(W);
      break;
    case 'felt':
      // soft halo then translucent core; crossings between quarter-laps pool darker
      chunks(16, (s, e) => add({ c: colourAt(s), w: W * 1.4, a: .14, blend: multiply, cap: 'butt', pass: 'halo', lap: lap(s) }, s, e));
      chunks(16, (s, e) => add({ c: colourAt(s), w: W, a: .5, blend: multiply, cap: 'butt', pass: 'core', lap: lap(s) }, s, e));
      break;
    case 'highlighter':
      chunks(18, (s, e) => add({ c: colourAt(s), w: W, a: .3, blend: glow, cap: 'butt', lap: lap(s) }, s, e));
      break;
    case 'metallic': {
      // sheen follows the line's direction against a fixed light, in 12 tones from deep to bright
      chunks(6, (s, e) => {
        const ang = Math.atan2(xy[e * 2 + 1] - xy[s * 2 + 1], xy[e * 2] - xy[s * 2]);
        const f = Math.round(Math.abs(Math.cos(2 * (ang - .8))) ** 1.6 * (SHEEN_STEPS - 1)) / (SHEEN_STEPS - 1);
        const [hh, ss, ll] = rgbHsl(...hexRgb(colourAt(s)));
        const lo = Math.max(.12, ll * .55), hi = Math.min(.93, ll + .38);
        add({ c: hslHex(hh, Math.min(1, ss * .9), lo + f * (hi - lo)), w: W, a: 1 }, s, e);
      });
      add({ c: '#ffffff', w: W * .26, a: .35, dx: -W * .14, dy: -W * .14 }, 0, n - 1);
      break;
    }
    case 'glitter': {
      solid(W, .82);
      const light = L.rainbow ? null : mixHex(base, '#ffffff', .65), dots = new Map();
      for (let i = 0; i < n; i++) {
        if (hash01(i, seed) > .06) continue;
        const r2 = hash01(i, seed + 1), r3 = hash01(i, seed + 2), j = (r3 - .5) * W * .8;
        const c = r2 < .4 ? '#ffffff' : (light || mixHex(colourAt(i), '#ffffff', .6)), a = Math.round((.55 + r3 * .45) * 4) / 4;
        const key = c + a;
        if (!dots.has(key)) { const op = { k: 'dots', c, a, list: [], stars: [] }; dots.set(key, op); ops.push(op); }
        const r = W * (.14 + r2 * .32), x = xy[i * 2] + j, y = xy[i * 2 + 1] - j;
        dots.get(key).list.push(x, y, r);
        if (r2 > .9) dots.get(key).stars.push(x, y, r);
      }
      break;
    }
    case 'pencil':
      // graphite pressure in 6 levels, plus a faint second pass in 2 levels
      chunks(5, (s, e) => add({ c: colourAt(s), w: +(W * (.85 + Math.round(hash01(s, seed) * 2) * .15)).toFixed(3), a: +(.35 + Math.round(hash01(s, seed + 3) * 5) / 5 * .45).toFixed(3), blend: multiply, cap: 'butt' }, s, e));
      chunks(9, (s, e) => add({ c: colourAt(s), w: W * .5, a: hash01(s, seed + 5) < .5 ? .14 : .24, blend: multiply, cap: 'butt', dx: W * .2, dy: -W * .15 }, s, e));
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
      const dx = o.dx || 0, dy = o.dy || 0;
      c.strokeStyle = o.c; c.lineWidth = o.w; c.lineCap = o.cap || 'round';
      c.beginPath();
      for (const [s, e] of o.runs) { c.moveTo(xy[s * 2] + dx, xy[s * 2 + 1] + dy); for (let i = s + 1; i <= e; i++) c.lineTo(xy[i * 2] + dx, xy[i * 2 + 1] + dy); }
      c.stroke();
    } else {
      c.fillStyle = o.c; c.beginPath();
      for (let i = 0; i < o.list.length; i += 3) { const [x, y, r] = [o.list[i], o.list[i + 1], o.list[i + 2]]; c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
      c.fill();
      if (o.stars.length) {
        c.strokeStyle = o.c; c.lineCap = 'round'; c.lineWidth = o.stars[2] * .35; c.beginPath();
        for (let i = 0; i < o.stars.length; i += 3) { const [x, y, r] = [o.stars[i], o.stars[i + 1], o.stars[i + 2]]; c.moveTo(x - r * 2.6, y); c.lineTo(x + r * 2.6, y); c.moveTo(x, y - r * 2.6); c.lineTo(x, y + r * 2.6); }
        c.stroke();
      }
    }
  }
  c.restore();
}

// ---------- SVG renderers ----------
const svgNum = v => +v.toFixed(2);
function runPath(xy, runs, dx, dy, simplify) {
  let d = '';
  for (const [s, e] of runs) {
    const xs = [], ys = [];
    for (let i = s; i <= e; i++) { xs.push(xy[i * 2] + dx); ys.push(xy[i * 2 + 1] + dy); }
    const keep = xs.length > 8 ? simplify(xs, ys, .04) : xs.map((_, i) => i);
    d += keep.map((i, k) => (k ? 'L' : 'M') + svgNum(xs[i]) + ' ' + svgNum(ys[i])).join('');
  }
  return d;
}
// "With pen effects": one element per op
function planToSVG(plan, opacity, simplify) {
  const { xy, ops } = plan, out = [];
  for (const o of ops) {
    const a = +(o.a * opacity).toFixed(3), blend = o.blend ? ` style="mix-blend-mode:${o.blend}"` : '';
    if (o.k === 'path') {
      out.push(`<path d="${runPath(xy, o.runs, o.dx || 0, o.dy || 0, simplify)}" stroke="${o.c}" stroke-width="${svgNum(o.w)}"${a < 1 ? ` stroke-opacity="${a}"` : ''}${o.cap === 'butt' ? ' stroke-linecap="butt"' : ''}${blend}/>`);
    } else {
      let d = '';
      for (let i = 0; i < o.list.length; i += 3) { const [x, y, r] = [o.list[i], o.list[i + 1], o.list[i + 2]].map(svgNum); d += `M${svgNum(x - r)} ${y}a${r} ${r} 0 1 0 ${svgNum(2 * r)} 0a${r} ${r} 0 1 0 ${svgNum(-2 * r)} 0`; }
      out.push(`<path d="${d}" fill="${o.c}" stroke="none"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`);
      if (o.stars.length) {
        let s = '';
        for (let i = 0; i < o.stars.length; i += 3) { const [x, y, r] = [o.stars[i], o.stars[i + 1], o.stars[i + 2]]; s += `M${svgNum(x - r * 2.6)} ${svgNum(y)}H${svgNum(x + r * 2.6)}M${svgNum(x)} ${svgNum(y - r * 2.6)}V${svgNum(y + r * 2.6)}`; }
        out.push(`<path d="${s}" stroke="${o.c}" stroke-width="${svgNum(o.stars[2] * .35)}"${a < 1 ? ` stroke-opacity="${a}"` : ''}/>`);
      }
    }
  }
  return out.join('\n');
}
// "Plain lines": exactly one path per layer, in the pen colour, no effects
function plainSVG(L, xy, simplify) {
  const n = xy.length / 2; if (n < 2) return '';
  return `<path d="${runPath(xy, [[0, n - 1]], 0, 0, simplify)}" stroke="${L.color}" stroke-width="${svgNum(L.width)}"${L.opacity < 1 ? ` stroke-opacity="${L.opacity}"` : ''}/>`;
}

if (typeof module !== 'undefined') module.exports = { PEN_STYLES, buildPlan, planToSVG, plainSVG, hslHex, rgbHsl, hexRgb, luminance };
