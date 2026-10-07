// Spiro Lab: rings & wheels, auto-draw and hand-rolling with momentum and tooth clicks, acrylic pieces, layers, PNG + SVG export.
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const STORE = 'spiro-lab-v1';
const PENS = ['#1b1b1f', '#e63946', '#f77f00', '#fcbf49', '#2a9d8f', '#3a86ff', '#7b2cbf', '#ff4d8d', '#06d6a0', '#8d5a2b', '#ffffff', '#9aa5b1'];
const PAPERS = [['#ffffff', 'White'], ['#f6f1e7', 'Cream'], ['#e8d8b9', 'Kraft'], ['#111114', 'Black card'], ['#14213d', 'Navy'], ['#2b2d42', 'Slate']];

// ---------- state ----------
const S = { ring: 1, mode: 'inside', wheel: 52, hole: 4, shift: 0, pitch: 16, cx: 500, cy: 500, color: '#3a86ff', width: 1.6, opacity: 1, autoShift: 0, pen: 'ballpoint', rainbow: false };
const P = { bg: '#ffffff', stencil: true, autoHide: true, speed: .6, transparent: false, sound: .35, momentum: true, oneWay: false, tint: 'classic', paper: { ...DEFAULT_PAPER } };
const PW = () => paperWorld(P.paper)[0], PH = () => paperWorld(P.paper)[1];
let layers = [], cur = null, playing = false, uid = 1;
let past = [], future = [];

const newLayer = () => ({ id: uid++, ...S, a: 0, b: 0, pos: 0, visible: true });
const inked = L => L && L.b - L.a > 1e-6;
const strip = L => { const { _tr, _key, _plan, _pk, ...rest } = L; return rest; };
const snapshot = () => JSON.stringify({ layers: layers.map(strip), cur: strip(cur), paper: P.paper });
function restore(json) { const o = JSON.parse(json); layers = o.layers; cur = o.cur; if (o.paper) { P.paper = o.paper; fit(); ringKey = ''; } uid = Math.max(uid, ...layers.map(l => l.id + 1), cur.id + 1); Object.assign(S, pickS(cur)); syncControls(); dirty(); }
const pickS = L => Object.fromEntries(Object.keys(S).map(k => [k, L[k]]));
function remember() { past.push(snapshot()); if (past.length > 200) past.shift(); future = []; }
function undo() { if (!past.length) return; future.push(snapshot()); restore(past.pop()); stop(); }
function redo() { if (!future.length) return; past.push(snapshot()); restore(future.pop()); stop(); }

function save() {
  clearTimeout(save.t);
  save.t = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify({ S, P, layers: layers.map(strip), cur: strip(cur) })); } catch {} }, 300);
}
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(STORE) || 'null'); if (!o) return false;
    Object.assign(S, o.S); Object.assign(P, o.P); P.paper = { ...DEFAULT_PAPER, ...(o.P && o.P.paper) }; layers = o.layers || []; cur = o.cur || newLayer();
    uid = Math.max(1, ...layers.map(l => l.id + 1), cur.id + 1); return true;
  } catch { return false; }
}

// ---------- traces (cached per layer) ----------
function tr(L) {
  const key = [L.ring, L.mode, L.wheel, L.hole, L.shift, L.pitch, L.cx, L.cy].join();
  if (L._key !== key) { L._tr = trace(L); L._key = key; }
  return L._tr;
}
// the drawn part of a layer, turned into pen-style drawing ops (cached until anything changes)
function planOf(L) {
  tr(L);
  const light = luminance(P.bg) > .5, key = [L._key, L.a, L.b, L.pen, L.rainbow, L.color, L.width, light].join();
  if (L._pk !== key) {
    const t = L._tr, p = t.pts, xy = [];
    for (const i of rangeIdx(t, L.a, L.b)) xy.push(p[i * 2], p[i * 2 + 1]);
    L._plan = buildPlan(L, xy, light); L._pk = key;
  }
  return L._plan;
}
function strokeLayer(ctx, L) { if (inked(L)) drawPlan(ctx, planOf(L), L.opacity); }

// ---------- canvas & view ----------
const cv = $('#paper'), ctx = cv.getContext('2d');
const ink = document.createElement('canvas'), ictx = ink.getContext('2d');
const view = { s: 1, ox: 0, oy: 0, dpr: 1 };
let inkDirty = true;
const dirty = () => { inkDirty = true; save(); renderLayers(); readout(); };
function fit() {
  const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  ink.width = cv.width; ink.height = cv.height;
  const W = PW(), H = PH(), s = Math.min(r.width / W, r.height / H) * .9;
  Object.assign(view, { s: s * dpr, ox: (cv.width - W * s * dpr) / 2, oy: (cv.height - H * s * dpr) / 2, dpr });
  inkDirty = true;
}
new ResizeObserver(fit).observe(cv.parentElement);
const toWorld = (cx_, cy_) => { const r = cv.getBoundingClientRect(); return [((cx_ - r.left) * view.dpr - view.ox) / view.s, ((cy_ - r.top) * view.dpr - view.oy) / view.s]; };
const worldT = c => c.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);

// the ink layer carries the paper colour too, so multiply-blended inks (felt, highlighter, pencil) mix with the paper
let inkBg = '';
function rebuildInk() {
  ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height);
  worldT(ictx); ictx.fillStyle = P.bg; ictx.fillRect(0, 0, PW(), PH()); inkBg = P.bg;
  ictx.beginPath(); ictx.rect(0, 0, PW(), PH()); ictx.clip();
  for (const L of layers) if (L.visible) strokeLayer(ictx, L);
  inkDirty = false;
}

// ---------- stencil drawing: translucent acrylic pieces ----------
// Piece colour sets: [ring, wheel] as RGB.
const TINTS = {
  classic: [[96, 170, 255], [255, 110, 165]],
  mint: [[60, 205, 160], [255, 180, 60]],
  violet: [[150, 120, 255], [80, 200, 230]],
  smoke: [[120, 130, 150], [120, 130, 150]],
  clear: [[215, 225, 240], [215, 225, 240]]
};
function gearPath(c, x, y, teeth, R, h, phase, tipOut) {
  const s = TAU / teeth, root = R - (tipOut ? h / 2 : -h / 2), tip = R + (tipOut ? h / 2 : -h / 2), mid = (root + tip) / 2;
  for (let i = 0; i < teeth; i++) {
    const m = phase + i * s;
    // a rounded involute-ish tooth: root, flank, softened tip, flank, root
    [[root, -.36], [mid, -.25], [tip, -.15], [tip, -.05], [tip, .05], [tip, .15], [mid, .25], [root, .36]].forEach(([r, f], k) => {
      const ax = x + r * Math.cos(m + f * s), ay = y + r * Math.sin(m + f * s);
      i === 0 && k === 0 ? c.moveTo(ax, ay) : c.lineTo(ax, ay);
    });
  }
  c.closePath();
}
// Paint one acrylic piece: soft shadow on the paper (outside the piece only), tinted body, sheen, bevelled edge.
function acrylic(c, shape, rgb, cx, cy, R, glow) {
  const [r, g, b] = rgb, px = view.dpr / view.s;
  c.save();
  c.beginPath(); c.rect(-1e4, -1e4, 3e4, 3e4); shape(); c.clip('evenodd');
  c.beginPath(); shape();
  c.shadowColor = 'rgba(15,20,35,.30)'; c.shadowBlur = 9 * view.dpr; c.shadowOffsetX = 2.5 * view.dpr; c.shadowOffsetY = 5 * view.dpr;
  c.fillStyle = '#000'; c.fill('evenodd');
  c.restore();
  c.save();
  c.beginPath(); shape(); c.clip('evenodd');
  c.beginPath(); shape();
  c.fillStyle = `rgba(${r},${g},${b},${glow ? .3 : .22})`; c.fill('evenodd');
  const sheen = c.createLinearGradient(cx - R, cy - R, cx + R * .4, cy + R * .4);
  sheen.addColorStop(0, 'rgba(255,255,255,.38)'); sheen.addColorStop(.45, 'rgba(255,255,255,.06)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sheen; c.fill('evenodd');
  c.lineWidth = 5 * px; c.strokeStyle = `rgba(${r},${g},${b},.35)`; c.stroke();
  c.restore();
  c.save(); c.beginPath(); shape();
  c.lineWidth = (glow ? 1.8 : 1.2) * px; c.strokeStyle = `rgba(${r * .55 | 0},${g * .55 | 0},${b * .55 | 0},${glow ? .95 : .75})`; c.stroke();
  c.translate(-.7 * px, -.7 * px); c.lineWidth = .8 * px; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  c.restore();
}
function printed(c, text, x, y, size, rot, rgb, alpha = .75) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.font = `700 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = `rgba(${rgb[0] * .4 | 0},${rgb[1] * .4 | 0},${rgb[2] * .4 | 0},${alpha})`; c.fillText(text, 0, 0);
  c.restore();
}
// The ring never moves while drawing, so it is painted once into its own layer and reused.
const ringCv = document.createElement('canvas'), rctx = ringCv.getContext('2d');
let ringKey = '';
function paintRing(L, G) {
  const key = [L.ring, L.pitch, L.cx, L.cy, P.tint, view.s, view.ox, view.oy, cv.width, cv.height].join();
  if (key === ringKey) return;
  ringKey = key; ringCv.width = cv.width; ringCv.height = cv.height;
  const c = rctx, ring = G.ring, h = G.p * .55, Ri = radiusOf(ring.inner, G.p), Ro = radiusOf(ring.outer, G.p), rgb = TINTS[P.tint][0];
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ringCv.width, ringCv.height); worldT(c);
  acrylic(c, () => { gearPath(c, L.cx, L.cy, ring.outer, Ro, h, 0, true); gearPath(c, L.cx, L.cy, ring.inner, Ri, h, 0, false); }, rgb, L.cx, L.cy, Ro, false);
  const band = (Ro - h / 2) - (Ri + h / 2), mid = (Ri + h / 2 + Ro - h / 2) / 2, fs = clampN(band * .2, 8, 30);
  printed(c, String(ring.inner), L.cx, L.cy - (Ri + h / 2 + fs * .9), fs, 0, rgb);
  printed(c, String(ring.outer), L.cx, L.cy - (Ro - h / 2 - fs * .9), fs * .8, 0, rgb, .6);
  for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + Math.PI / 4 + i * Math.PI / 2; c.beginPath(); c.arc(L.cx + mid * Math.cos(a), L.cy + mid * Math.sin(a), G.p * .12, 0, TAU); c.fillStyle = `rgba(${rgb.join()},.45)`; c.fill(); }
}
function drawStencil(c, L) {
  const G = geom(L), w = wheelAt(G, L, L.pos), h = G.p * .55, px = view.dpr / view.s, rgb = TINTS[P.tint][1];
  paintRing(L, G);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(ringCv, 0, 0); c.restore();
  const phase = w.spin + (G.inside ? 0 : Math.PI) + Math.PI / G.t;
  acrylic(c, () => gearPath(c, w.wx, w.wy, G.t, G.rr, h, phase, true), rgb, w.wx, w.wy, G.rr, hoverWheel || (drag && drag.kind === 'roll'));
  const holeR = G.p * .17, holeScreen = holeR / px, spacingScreen = G.p * .42 / px;
  G.holes.forEach((ho, i) => {
    const hx = w.wx + ho.d * Math.cos(w.spin + ho.a), hy = w.wy + ho.d * Math.sin(w.spin + ho.a), on = i === G.hole;
    c.beginPath(); c.arc(hx, hy, holeR, 0, TAU);
    c.fillStyle = on ? L.color : 'rgba(255,255,255,.7)'; c.fill();
    c.lineWidth = .9 * px; c.strokeStyle = `rgba(${rgb[0] * .45 | 0},${rgb[1] * .45 | 0},${rgb[2] * .45 | 0},.7)`; c.stroke();
    if (spacingScreen > 12 && (on || holeScreen > 4)) {
      const nx = hx + (holeR * 2.1) * Math.cos(w.spin + ho.a + Math.PI / 2), ny = hy + (holeR * 2.1) * Math.sin(w.spin + ho.a + Math.PI / 2);
      printed(c, String(i + 1), nx, ny, Math.max(G.p * .26, 7 * px), 0, rgb, on ? .95 : .55);
    }
  });
  printed(c, String(G.t), w.wx, w.wy, clampN(G.rr * .22, 9 * px, 40), w.spin + Math.PI / 2, rgb, .7);
  c.beginPath(); c.arc(w.px, w.py, Math.max(G.p * .28, 4 * px), 0, TAU); c.fillStyle = L.color; c.fill();
  c.lineWidth = 2 * px; c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
  if (spacingScreen <= 12) printed(c, 'hole ' + (G.hole + 1), w.px, w.py - Math.max(G.p * .7, 14 * px), 11 * px, 0, rgb, .9);
}

// ---------- feel: tooth clicks, momentum, one-way ----------
let actx = null, clickT = 0, coast = null, hoverWheel = false;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } else if (actx.state === 'suspended') actx.resume(); }
addEventListener('pointerdown', audio); addEventListener('keydown', audio);
// one short, slightly varied plastic tick: a noise burst through a bandpass
function tick(strength = 1) {
  if (!actx || P.sound <= 0) return;
  const now = actx.currentTime; if (now - clickT < .018) return; clickT = now;
  const n = Math.floor(actx.sampleRate * .02), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * .12));
  const src = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random() * 900; bp.Q.value = 4;
  g.gain.value = P.sound * .55 * strength;
  src.connect(bp).connect(g).connect(actx.destination); src.start(now);
}

// ---------- frame ----------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  if (!cv.width || !cv.height) { fit(); if (!cv.width || !cv.height) return; }
  if (playing) advance(P.speed * TAU * dt);
  else if (coast) {
    advance(coast.v * dt);
    coast.v *= Math.exp(-2.6 * dt);
    if (Math.abs(coast.v) < .06 || !coast) coast = null;
  }
  if (inkDirty || inkBg !== P.bg) rebuildInk();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  worldT(ctx);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30 * view.dpr; ctx.shadowOffsetY = 8 * view.dpr;
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, PW(), PH()); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ink, 0, 0);
  worldT(ctx); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PW(), PH()); ctx.clip();
  strokeLayer(ctx, cur); drawTexture(ctx, P.paper.texture, PW(), PH()); ctx.restore();
  if (P.stencil) drawStencil(ctx, cur);
}

// ---------- drawing actions ----------
function advance(d) {
  const G = tr(cur).G;
  if (P.oneWay && d < 0) return;
  const before = Math.floor(cur.pos * G.T / TAU);
  cur.pos += d; cur.a = Math.min(cur.a, cur.pos); cur.b = Math.max(cur.b, cur.pos);
  if (Math.floor(cur.pos * G.T / TAU) !== before) tick(playing ? .55 : 1);
  if (cur.b - cur.a >= G.total) {
    cur.b = cur.a + G.total;
    if (playing || coast) { stop(); coast = null; toast('Pattern complete — it closed after ' + G.laps + (G.laps === 1 ? ' lap' : ' laps')); if (P.autoHide && P.stencil) showPieces(false, true); }
  }
  readout(); save();
}
function play() {
  if (autoHidden) showPieces(true);
  if (cur.b - cur.a >= tr(cur).G.total) newLayerFromCurrent();
  remember();
  playing = true; syncPlay();
}
function stop() { playing = false; coast = null; syncPlay(); }
function finish() { stop(); remember(); const G = tr(cur).G; cur.b = cur.a + G.total; cur.pos = cur.b; readout(); save(); if (P.autoHide && P.stencil) showPieces(false, true); }
function commit() {
  if (!inked(cur)) return false;
  remember(); layers.push(cur); cur = null; return true;
}
function newLayerFromCurrent() {
  stop();
  if (autoHidden) showPieces(true);
  if (commit()) { S.shift = (S.shift + S.autoShift) % 1000; }
  cur = newLayer(); syncControls(); dirty();
}
// any change to pieces or pen: if ink is on the paper, that pass is finished and a new one starts
function change(fn) {
  stop();
  const had = inked(cur);
  fn(S);
  if (had) { commit(); cur = newLayer(); }
  else { const keep = { id: cur.id, a: 0, b: 0, pos: 0, visible: true }; cur = { ...cur, ...S, ...keep }; }
  syncControls(); dirty();
}

// ---------- pointer: hand-rolling, picking holes, moving the ring ----------
let drag = null;
cv.addEventListener('pointerdown', e => {
  const [x, y] = toWorld(e.clientX, e.clientY);
  cv.setPointerCapture(e.pointerId);
  if (moveMode || e.altKey) { drag = { kind: 'move' }; return; }
  if (P.stencil) {
    const G = geom(cur), w = wheelAt(G, cur, cur.pos), tol = Math.max(G.p * .32, 10 * view.dpr / view.s);
    const hit = G.holes.findIndex(h => Math.hypot(w.wx + h.d * Math.cos(w.spin + h.a) - x, w.wy + h.d * Math.sin(w.spin + h.a) - y) < tol);
    if (hit >= 0 && hit !== G.hole) { change(s => s.hole = hit); return; }
  }
  stop();
  if (autoHidden) showPieces(true);
  remember();
  drag = { kind: 'roll', last: Math.atan2(y - cur.cy, x - cur.cx), samples: [] };
  cv.classList.add('rolling');
});
cv.addEventListener('pointermove', e => {
  const [x, y] = toWorld(e.clientX, e.clientY);
  if (!drag) {
    let over = false;
    if (P.stencil) { const G = geom(cur), w = wheelAt(G, cur, cur.pos); over = Math.hypot(x - w.wx, y - w.wy) < G.rr + G.p * .3; }
    if (over !== hoverWheel) { hoverWheel = over; cv.classList.toggle('over-wheel', over); }
    return;
  }
  if (drag.kind === 'move') { change(s => { s.cx = Math.round(clampN(x, 0, PW())); s.cy = Math.round(clampN(y, 0, PH())); }); return; }
  const ang = Math.atan2(y - cur.cy, x - cur.cx);
  let d = ang - drag.last; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
  drag.last = ang;
  const t = performance.now(); drag.samples.push([t, d]); while (drag.samples.length && t - drag.samples[0][0] > 90) drag.samples.shift();
  if (Math.abs(d) > 1e-4) advance(d);
});
const endDrag = () => {
  if (drag && drag.kind === 'roll' && P.momentum && drag.samples.length > 1) {
    const s = drag.samples, span = (s[s.length - 1][0] - s[0][0]) / 1000, sum = s.reduce((a, q) => a + q[1], 0);
    const v = span > .01 ? sum / span : 0;
    if (Math.abs(v) > .6 && (!P.oneWay || v > 0)) coast = { v: clampN(v, -40, 40) };
  }
  drag = null; cv.classList.remove('rolling'); syncPlay();
};
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
let moveMode = false;

// ---------- export ----------
function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const visibleInk = () => [...layers.filter(l => l.visible), cur].filter(inked);
const penName = L => (PEN_STYLES[L.pen] || PEN_STYLES.ballpoint).label;
const describe = L => `${RINGS[L.ring].inner}/${RINGS[L.ring].outer} ring, ${L.wheel}-tooth wheel ${L.mode}, hole ${L.hole + 1}, shift ${L.shift}, ${penName(L).toLowerCase()} pen${L.rainbow ? ', rainbow ink' : ''}`;
// Douglas–Peucker on the dense trace: drops points that deviate less than `tol` paper units (1/25,000 of the page)
function simplify(xs, ys, tol) {
  const n = xs.length; if (n < 3) return [...Array(n).keys()];
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]], t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop(), ax = xs[a], ay = ys[a], dx = xs[b] - ax, dy = ys[b] - ay, len2 = dx * dx + dy * dy;
    let worst = -1, wi = -1;
    for (let i = a + 1; i < b; i++) {
      let ex, ey;
      if (len2 === 0) { ex = xs[i] - ax; ey = ys[i] - ay; }
      else { const u = Math.max(0, Math.min(1, ((xs[i] - ax) * dx + (ys[i] - ay) * dy) / len2)); ex = xs[i] - ax - u * dx; ey = ys[i] - ay - u * dy; }
      const d2 = ex * ex + ey * ey; if (d2 > worst) { worst = d2; wi = i; }
    }
    if (worst > t2) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}
function exportSVG() {
  const W = +PW().toFixed(2), H = +PH().toFixed(2), pp = P.paper, u = pp.unit === 'px' ? '' : pp.unit;
  // real-world size in the width/height attributes, so printers and cutting machines get the true dimensions
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${fmtNum(pp.w)}${u}" height="${fmtNum(pp.h)}${u}" viewBox="0 0 ${W} ${H}">`, '<title>Spiro Lab drawing</title>'];
  out.push(`<defs><clipPath id="paper"><rect width="${W}" height="${H}"/></clipPath></defs>`);
  if (!P.transparent) out.push(`<rect width="${W}" height="${H}" fill="${P.bg}"/>`);
  out.push('<g clip-path="url(#paper)" fill="none" stroke-linecap="round" stroke-linejoin="round">');
  for (const L of visibleInk()) out.push(`<g><desc>${describe(L)}</desc>\n${planToSVG(planOf(L), L.opacity, simplify)}\n</g>`);
  if (!P.transparent) out.push(textureSVG(pp.texture, W, H));
  out.push('</g></svg>');
  download(new Blob([out.join('\n')], { type: 'image/svg+xml' }), `spiro-${stamp()}.svg`);
  toast('SVG saved');
}
function exportPNG() {
  const [pw, ph] = paperPixels(P.paper), c = document.createElement('canvas'); c.width = pw; c.height = ph;
  const x = c.getContext('2d'), tooBig = 'That size is too big for this browser. Pick a lower resolution next to the PNG button.';
  if (!x || c.width !== pw) { toast(tooBig, true); return; }
  x.scale(pw / PW(), ph / PH());
  if (!P.transparent) { x.fillStyle = P.bg; x.fillRect(0, 0, PW(), PH()); }
  for (const L of visibleInk()) strokeLayer(x, L);
  if (!P.transparent) drawTexture(x, P.paper.texture, PW(), PH());
  c.toBlob(b => {
    if (!b) { toast(tooBig, true); return; }
    download(b, `spiro-${stamp()}-${pw}x${ph}.png`); toast(`PNG saved (${pw} × ${ph})`);
  }, 'image/png');
}

// ---------- UI wiring ----------
function chips(box, items, get, set, label = v => v) {
  box.innerHTML = '';
  items.forEach(v => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label(v);
    b.addEventListener('click', () => change(s => set(s, v)));
    b.dataset.v = v; box.appendChild(b);
  });
  box._sync = () => [...box.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v) === String(get())));
}
chips($('#rings'), [0, 1], () => S.ring, (s, v) => s.ring = +v, v => RINGS[v].inner + ' / ' + RINGS[v].outer);
chips($('#modes'), ['inside', 'outside'], () => S.mode, (s, v) => s.mode = v, v => v === 'inside' ? 'Inside ring' : 'Outside ring');
chips($('#wheels'), WHEELS, () => S.wheel, (s, v) => { s.wheel = +v; s.hole = Math.min(s.hole, holesFor(+v, s.pitch).length - 1); });
function swatches(box, list, get, set) {
  box.innerHTML = '';
  list.forEach(v => {
    const [col, name] = Array.isArray(v) ? v : [v, v];
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.setProperty('--c', col); b.title = name; b.setAttribute('aria-label', name);
    b.addEventListener('click', () => set(col)); b.dataset.v = col; box.appendChild(b);
  });
  box._sync = () => [...box.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v.toLowerCase() === get().toLowerCase()));
}
swatches($('#pens'), PENS, () => S.color, c => change(s => s.color = c));
swatches($('#papers'), PAPERS, () => P.bg, c => { P.bg = c; syncControls(); save(); });
(() => {
  const box = $('#tints'), names = { classic: 'Classic', mint: 'Mint', violet: 'Violet', smoke: 'Smoke', clear: 'Clear' };
  Object.keys(TINTS).forEach(k => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tint'; b.dataset.v = k; b.title = names[k]; b.setAttribute('aria-label', names[k] + ' pieces');
    b.style.setProperty('--a', `rgb(${TINTS[k][0]})`); b.style.setProperty('--b', `rgb(${TINTS[k][1]})`);
    b.addEventListener('click', () => { P.tint = k; syncControls(); save(); }); box.appendChild(b);
  });
  box._sync = () => [...box.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v === P.tint));
})();
const bind = (sel, ev, fn) => $(sel).addEventListener(ev, fn);
bind('#penColor', 'input', e => change(s => s.color = e.target.value));
chips($('#penStyles'), Object.keys(PEN_STYLES), () => S.pen, (s, v) => { s.pen = v; s.width = PEN_STYLES[v].w; }, v => PEN_STYLES[v].label);
bind('#rainbow', 'change', e => change(s => s.rainbow = e.target.checked));
bind('#bgColor', 'input', e => { P.bg = e.target.value; syncControls(); save(); });
bind('#hole', 'input', e => change(s => s.hole = +e.target.value - 1));
bind('#width', 'input', e => change(s => s.width = +e.target.value));
bind('#opacity', 'input', e => change(s => s.opacity = +e.target.value));
bind('#pitch', 'input', e => change(s => { s.pitch = +e.target.value; s.hole = Math.min(s.hole, holesFor(s.wheel, s.pitch).length - 1); }));
bind('#shiftDown', 'click', () => change(s => s.shift = (s.shift - 1 + 1000) % 1000));
bind('#shiftUp', 'click', () => change(s => s.shift = (s.shift + 1) % 1000));
bind('#autoShift', 'input', e => { S.autoShift = clampN(Math.round(+e.target.value || 0), 0, 99); save(); });
const speedFromSlider = v => +(0.05 * Math.pow(60, v / 100)).toFixed(3), sliderFromSpeed = s => Math.round(100 * Math.log(s / .05) / Math.log(60));
bind('#speed', 'input', e => { P.speed = speedFromSlider(+e.target.value); $('#speedOut').textContent = P.speed.toFixed(2) + ' laps/s'; save(); });
bind('#play', 'click', () => playing ? stop() : play());
bind('#finish', 'click', finish);
bind('#newLayer', 'click', newLayerFromCurrent);
bind('#undo', 'click', undo); bind('#redo', 'click', redo);
bind('#momentum', 'change', e => { P.momentum = e.target.checked; save(); });
bind('#oneWay', 'change', e => { P.oneWay = e.target.checked; save(); });
bind('#sound', 'input', e => { P.sound = +e.target.value; $('#soundOut').textContent = P.sound ? Math.round(P.sound * 100) + '%' : 'Off'; save(); tick(); });
bind('#mute', 'click', () => { P.sound = P.sound > 0 ? 0 : .35; syncControls(); save(); });
bind('#moveRing', 'click', () => { moveMode = !moveMode; $('#moveRing').setAttribute('aria-pressed', moveMode); cv.classList.toggle('moving', moveMode); });
bind('#centre', 'click', () => change(s => { s.cx = PW() / 2; s.cy = PH() / 2; }));
bind('#svg', 'click', exportSVG); bind('#png', 'click', exportPNG);
// paper size: when the sheet changes, everything stays centred on it
function setPaper(fn) {
  stop();
  const [w0, h0] = paperWorld(P.paper);
  remember();
  fn(P.paper);
  const [w1, h1] = paperWorld(P.paper), dx = (w1 - w0) / 2, dy = (h1 - h0) / 2;
  if (dx || dy) for (const L of [...layers, cur, S]) { L.cx += dx; L.cy += dy; }
  fit(); ringKey = ''; syncControls(); dirty();
}
const presetSel = $('#paperPreset');
Object.entries(PAPER_PRESETS).forEach(([k, v]) => presetSel.add(new Option(v.label, k)));
presetSel.addEventListener('change', () => setPaper(p => {
  p.preset = presetSel.value; const pr = PAPER_PRESETS[p.preset];
  if (pr.unit) { const land = p.w > p.h; p.unit = pr.unit; [p.w, p.h] = land && pr.w !== pr.h ? [pr.h, pr.w] : [pr.w, pr.h]; }
}));
bind('#orient', 'click', () => setPaper(p => { [p.w, p.h] = [p.h, p.w]; }));
const LIMITS = { mm: [20, 2000], in: [1, 80], px: [100, 16384] };
const customSize = () => setPaper(p => {
  const u = $('#punit').value, [lo, hi] = LIMITS[u];
  p.preset = 'custom'; p.unit = u; p.w = clampN(+$('#pw').value || lo, lo, hi); p.h = clampN(+$('#ph').value || lo, lo, hi);
});
bind('#pw', 'change', customSize); bind('#ph', 'change', customSize);
bind('#punit', 'change', () => setPaper(p => {
  // convert the current size into the new unit, using the print resolution for pixels
  const toIn = (v, u) => u === 'in' ? v : u === 'mm' ? v / 25.4 : v / p.dpi, u = $('#punit').value;
  const conv = v => { const i = toIn(v, p.unit); return u === 'in' ? +i.toFixed(2) : u === 'mm' ? Math.round(i * 25.4) : Math.round(i * p.dpi); };
  p.preset = 'custom'; [p.w, p.h] = [conv(p.w), conv(p.h)]; p.unit = u;
}));
bind('#pngSize', 'change', e => { const v = +e.target.value; if (P.paper.unit === 'px') P.paper.scale = v; else P.paper.dpi = v; syncControls(); save(); });
function resOptions() {
  const sel = $('#pngSize'), p = P.paper, opts = p.unit === 'px' ? [.5, 1, 2] : [72, 150, 300, 600];
  sel.innerHTML = '';
  for (const v of opts) {
    const [w, h] = paperPixels({ ...p, dpi: p.unit === 'px' ? p.dpi : v, scale: p.unit === 'px' ? v : p.scale });
    sel.add(new Option(p.unit === 'px' ? `${v}× · ${w}×${h}` : `${v} dpi · ${w}×${h}`, v));
  }
  sel.value = p.unit === 'px' ? p.scale : p.dpi;
}
(() => {
  const box = $('#textures');
  Object.entries(TEXTURES).forEach(([k, v]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = v; b.dataset.v = k;
    b.addEventListener('click', () => { P.paper.texture = k; syncControls(); save(); }); box.appendChild(b);
  });
  box._sync = () => [...box.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.v === P.paper.texture));
})();
// pieces: a toggle on the paper, plus an optional auto-hide when a pattern completes
let autoHidden = false;
function showPieces(on, auto = false) { P.stencil = on; autoHidden = !on && auto; syncControls(); save(); }
bind('#pieceToggle', 'click', () => showPieces(!P.stencil));
bind('#autoHide', 'change', e => { P.autoHide = e.target.checked; save(); });
bind('#transparent', 'change', e => { P.transparent = e.target.checked; save(); });
bind('#surprise', 'click', () => change(s => {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  s.ring = pick([0, 1]); s.mode = Math.random() < .7 ? 'inside' : 'outside'; s.wheel = pick(WHEELS);
  s.hole = Math.floor(Math.random() * holesFor(s.wheel, s.pitch).length); s.color = pick(PENS.filter(c => c.toLowerCase() !== P.bg.toLowerCase()));
}));
const clearBtn = $('#clear');
clearBtn.addEventListener('click', () => {
  if (!clearBtn.classList.contains('confirm')) { clearBtn.classList.add('confirm'); clearBtn.textContent = 'Click again to clear'; setTimeout(() => { clearBtn.classList.remove('confirm'); clearBtn.textContent = 'Clear paper'; }, 2500); return; }
  clearBtn.classList.remove('confirm'); clearBtn.textContent = 'Clear paper';
  remember(); stop(); layers = []; cur = newLayer(); dirty();
});

function syncControls() {
  ['#rings', '#modes', '#wheels', '#pens', '#papers', '#tints', '#penStyles'].forEach(s => $(s)._sync());
  $('#rainbow').checked = !!S.rainbow;
  const G = geom(S);
  $('#hole').max = G.holes.length; $('#hole').value = G.hole + 1; $('#holeOut').textContent = `${G.hole + 1} of ${G.holes.length}`;
  $('#penColor').value = S.color; $('#bgColor').value = P.bg;
  $('#width').value = S.width; $('#widthOut').textContent = S.width.toFixed(1);
  $('#opacity').value = S.opacity; $('#opacityOut').textContent = Math.round(S.opacity * 100) + '%';
  $('#pitch').value = S.pitch; $('#pitchOut').textContent = S.pitch;
  $('#shiftOut').textContent = S.shift + (S.shift === 1 ? ' tooth' : ' teeth');
  $('#autoShift').value = S.autoShift;
  $('#speed').value = sliderFromSpeed(P.speed); $('#speedOut').textContent = P.speed.toFixed(2) + ' laps/s';
  $('#autoHide').checked = P.autoHide;
  const pt = $('#pieceToggle'); pt.setAttribute('aria-pressed', P.stencil); pt.querySelector('use').setAttribute('href', P.stencil ? '#i-eye' : '#i-eye-slash'); pt.querySelector('span').textContent = P.stencil ? 'Pieces shown' : 'Pieces hidden';
  const pp = P.paper; presetSel.value = pp.preset; $('#customPaper').hidden = pp.preset !== 'custom';
  $('#pw').value = fmtNum(pp.w); $('#ph').value = fmtNum(pp.h); $('#punit').value = pp.unit; $('#paperDims').textContent = paperLabel(pp);
  $('#orient').disabled = pp.w === pp.h; resOptions(); $('#textures')._sync(); $('#momentum').checked = P.momentum; $('#oneWay').checked = P.oneWay;
  $('#sound').value = P.sound; $('#soundOut').textContent = P.sound ? Math.round(P.sound * 100) + '%' : 'Off';
  $('#mute').setAttribute('aria-pressed', P.sound === 0); $('#mute').title = P.sound ? 'Mute clicks' : 'Unmute clicks'; $('#transparent').checked = P.transparent;
  document.documentElement.style.setProperty('--pen', S.color);
  readout(); syncPlay();
}
function syncPlay() {
  const b = $('#play'); b.setAttribute('aria-pressed', playing);
  b.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
  b.querySelector('span').textContent = playing ? 'Pause' : inked(cur) ? 'Continue' : 'Draw';
  $('#undo').disabled = !past.length; $('#redo').disabled = !future.length;
}
function readout() {
  if (!cur) return;
  const G = tr(cur).G, prog = clampN((cur.b - cur.a) / G.total, 0, 1);
  $('#petals').textContent = G.petals; $('#laps').textContent = G.laps;
  $('#progress').style.width = (prog * 100).toFixed(1) + '%'; $('#progOut').textContent = Math.round(prog * 100) + '%';
}
function renderLayers() {
  const list = $('#layers'); list.innerHTML = '';
  const all = [...layers].reverse();
  $('#layerCount').textContent = layers.length ? `${layers.length} finished` : 'None yet';
  if (!all.length) { list.innerHTML = '<li class="empty">Finished passes appear here. Press <b>New layer</b> to keep a pass and start the next one.</li>'; return; }
  all.forEach(L => {
    const li = document.createElement('li'); li.className = 'layer' + (L.visible ? '' : ' hidden');
    li.innerHTML = `<i class="dot${L.rainbow ? ' rainbow' : ''}" style="--c:${L.color}"></i><div><b>${RINGS[L.ring].inner}/${RINGS[L.ring].outer} · ${L.wheel} wheel</b><small>${penName(L)}${L.rainbow ? ' rainbow' : ''} · ${L.mode} · hole ${L.hole + 1} · shift ${L.shift}</small></div>
      <button type="button" class="ico" aria-label="${L.visible ? 'Hide' : 'Show'} layer"><svg><use href="#i-${L.visible ? 'eye' : 'eye-slash'}"/></svg></button>
      <button type="button" class="ico" aria-label="Delete layer"><svg><use href="#i-trash"/></svg></button>`;
    const [eye, del] = li.querySelectorAll('button');
    eye.addEventListener('click', () => { remember(); L.visible = !L.visible; dirty(); });
    del.addEventListener('click', () => { remember(); layers = layers.filter(x => x !== L); dirty(); });
    list.appendChild(li);
  });
}
let toastT;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

// keyboard
addEventListener('keydown', e => {
  if (e.target.matches('input[type=number], input[type=text]')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); e.shiftKey ? exportPNG() : exportSVG(); return; }
  if (mod) return;
  if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); playing ? stop() : play(); }
  else if (e.key === 'Enter' && !e.target.matches('button')) { e.preventDefault(); newLayerFromCurrent(); }
  else if (e.key === 'f') finish();
  else if (e.key === 'h') showPieces(!P.stencil);
  else if (e.key === '[') change(s => s.hole = Math.max(0, s.hole - 1));
  else if (e.key === ']') change(s => s.hole = Math.min(holesFor(s.wheel, s.pitch).length - 1, s.hole + 1));
  else if (e.key === ',') change(s => s.shift = (s.shift - 1 + 1000) % 1000);
  else if (e.key === '.') change(s => s.shift = (s.shift + 1) % 1000);
});

// ---------- start ----------
if (!load()) cur = newLayer();
syncControls(); fit(); dirty();
requestAnimationFrame(frame);
window.SpiroLab = { get layers() { return layers; }, get cur() { return cur; }, S, P, exportSVG, exportPNG, finish, newLayerFromCurrent, change };
})();
