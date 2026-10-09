// Spiro Lab: rings & wheels, auto-draw and hand-rolling with momentum and tooth clicks, acrylic pieces, layers, PNG + SVG export.
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const STORE = 'spiro-lab-v1';
const PENS = ['#1b1b1f', '#e63946', '#f77f00', '#fcbf49', '#2a9d8f', '#3a86ff', '#7b2cbf', '#ff4d8d', '#06d6a0', '#8d5a2b', '#ffffff', '#9aa5b1'];
const PAPERS = [['#ffffff', 'White'], ['#f6f1e7', 'Cream'], ['#e8d8b9', 'Kraft'], ['#111114', 'Black card'], ['#14213d', 'Navy'], ['#2b2d42', 'Slate']];

// ---------- state ----------
const S = { ring: 1, mode: 'inside', wheel: 52, hole: 4, shift: 0, pitch: 16, cx: 500, cy: 500, color: '#3a86ff', width: 1.6, opacity: 1, autoShift: 0, pen: 'ballpoint', rainbow: false };
const P = { bg: '#ffffff', stencil: true, autoHide: true, ghost: true, speed: .6, transparent: false, sound: .35, momentum: true, oneWay: false, tint: 'classic', paper: { ...DEFAULT_PAPER }, svgMode: 'effects', exportFmt: 'png', jpgQ: .9, folds: { pieces: true, pen: false, paper: false, layers: false } };
const PW = () => paperWorld(P.paper)[0], PH = () => paperWorld(P.paper)[1];
let layers = [], cur = null, playing = false, uid = 1;
let past = [], future = [];

const newLayer = () => ({ id: uid++, ...S, a: 0, b: 0, pos: 0, visible: true });
const inked = L => L && L.b - L.a > 1e-6;
const strip = L => { const { _tr, _key, _plan, _pk, _xy, ...rest } = L; return rest; };
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
    L._plan = buildPlan(L, xy, light, t.N / t.G.laps); L._pk = key; L._xy = xy;
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
// camera on top of the fit: cam.z = zoom relative to "paper fits the window", cam.x/y = pan in device px
const cam = { z: 1, x: 0, y: 0 };
let fitS = 1;
function fit() {
  const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  ink.width = cv.width; ink.height = cv.height;
  fitS = Math.min(r.width / PW(), r.height / PH()) * .9 * dpr; view.dpr = dpr;
  applyView();
}
function applyView() {
  const W = PW(), H = PH(), s = fitS * cam.z, keep = 80 * view.dpr;
  // pan is limited so at least ~80px of paper always stays on screen
  const lx = Math.max(0, (cv.width + W * s) / 2 - keep), ly = Math.max(0, (cv.height + H * s) / 2 - keep);
  cam.x = clampN(cam.x, -lx, lx); cam.y = clampN(cam.y, -ly, ly);
  Object.assign(view, { s, ox: (cv.width - W * s) / 2 + cam.x, oy: (cv.height - H * s) / 2 + cam.y });
  inkDirty = true;
  const fitted = Math.abs(cam.z - 1) < .005 && Math.abs(cam.x) < 1 && Math.abs(cam.y) < 1;
  $('#zoomPct').textContent = fitted ? 'Fit' : Math.round(cam.z * 100) + '%';
}
// zoom so the point under (clientX, clientY) stays put; no point = the middle of the stage
function zoomTo(z, clientX, clientY) {
  const r = cv.getBoundingClientRect();
  const sx = ((clientX ?? r.left + r.width / 2) - r.left) * view.dpr, sy = ((clientY ?? r.top + r.height / 2) - r.top) * view.dpr;
  const wx = (sx - view.ox) / view.s, wy = (sy - view.oy) / view.s;
  cam.z = clampN(z, .2, 32);
  const s = fitS * cam.z;
  cam.x = sx - wx * s - (cv.width - PW() * s) / 2; cam.y = sy - wy * s - (cv.height - PH() * s) / 2;
  applyView();
}
const zoomBy = (f, x, y) => zoomTo(cam.z * f, x, y);
const panBy = (dx, dy) => { cam.x += dx * view.dpr; cam.y += dy * view.dpr; applyView(); };
function resetView() { cam.z = 1; cam.x = cam.y = 0; applyView(); }
// actual size: real millimetres on screen (CSS 96 dpi), or one image pixel per screen point for pixel papers
function actualSize() {
  const cssPerUnit = P.paper.unit === 'px' ? P.paper.w / PW() : 96 / 25.4 / MM;
  zoomTo(cssPerUnit * view.dpr / fitS); toast('Actual size');
}
new ResizeObserver(fit).observe(cv.parentElement);
const toWorld = (cx_, cy_) => { const r = cv.getBoundingClientRect(); return [((cx_ - r.left) * view.dpr - view.ox) / view.s, ((cy_ - r.top) * view.dpr - view.oy) / view.s]; };
const worldT = c => c.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
// The part of the paper that is on screen (plus a small margin), in world units. Zoomed in, the whole
// paper is many times the screen; Safari can leave seams when filling shapes that big, so the paper,
// its texture and shadow clips only ever cover what is visible.
function onScreen(pad = 4) {
  const m = pad * view.dpr / view.s;
  const x0 = Math.max(0, -view.ox / view.s - m), y0 = Math.max(0, -view.oy / view.s - m);
  const x1 = Math.min(PW(), (cv.width - view.ox) / view.s + m), y1 = Math.min(PH(), (cv.height - view.oy) / view.s + m);
  return [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
}
function screenWorld(pad = 40) {
  const m = pad * view.dpr / view.s;
  return [-view.ox / view.s - m, -view.oy / view.s - m, cv.width / view.s + 2 * m, cv.height / view.s + 2 * m];
}

// the ink layer carries the paper colour too, so multiply-blended inks (felt, highlighter, pencil) mix with the paper
let inkBg = '';
function rebuildInk() {
  ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height);
  worldT(ictx); ictx.fillStyle = P.bg; ictx.fillRect(...onScreen()); inkBg = P.bg;
  // save/restore so the clip doesn't pile up: a stale clip cut the ink at the old paper edge after zooming
  ictx.save(); ictx.beginPath(); ictx.rect(...onScreen()); ictx.clip();
  for (const L of layers) if (L.visible) {
    if (editId != null && L.id !== editId) { ictx.save(); ictx.globalAlpha = .25; strokeLayer(ictx, L); ictx.restore(); }
    else strokeLayer(ictx, L);
  }
  ictx.restore();
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
  c.beginPath(); c.rect(...screenWorld()); shape(); c.clip('evenodd');
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

// ---------- ghost preview: the full pattern for the current settings, faint, screen only ----------
const ghostCv = document.createElement('canvas'), gctx = ghostCv.getContext('2d');
let ghostKey = '';
function paintGhost() {
  const t = tr(cur), key = [cur._key, cur.color, view.s, view.ox, view.oy, cv.width, cv.height, PW(), PH()].join();
  if (key === ghostKey) return;
  ghostKey = key; ghostCv.width = cv.width; ghostCv.height = cv.height;
  const c = gctx, p = t.pts;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ghostCv.width, ghostCv.height);
  worldT(c); c.beginPath(); c.rect(...onScreen()); c.clip();
  c.strokeStyle = cur.color; c.lineWidth = Math.max(.9 * view.dpr / view.s, cur.width * .45); c.lineJoin = 'round';
  c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 1; i <= t.N; i++) c.lineTo(p[(i % t.N) * 2], p[(i % t.N) * 2 + 1]); c.stroke();
}
const ghostVisible = () => P.ghost && cur.b - cur.a < tr(cur).G.total - 1e-6;

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
  ctx.fillStyle = P.bg; ctx.fillRect(...onScreen()); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ink, 0, 0);
  const vis = onScreen();
  worldT(ctx); ctx.save(); ctx.beginPath(); ctx.rect(...vis); ctx.clip();
  if (ghostVisible()) {
    paintGhost();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = luminance(P.bg) > .5 ? .2 : .28; ctx.drawImage(ghostCv, 0, 0); ctx.restore();
  }
  strokeLayer(ctx, cur); drawTexture(ctx, P.paper.texture, vis[2], vis[3], vis[0], vis[1]); ctx.restore();
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
// any change to pieces or pen: if ink is on the paper, that pass is finished and a new one starts.
// A pen-only change (keepPos) is like swapping pens with the wheel still in place: the new pass
// carries on from where the wheel stopped instead of going back to the start tooth.
function change(fn, keepPos = false) {
  stop();
  const had = inked(cur), at = keepPos ? cur.pos : 0;
  fn(S);
  if (had) { commit(); cur = newLayer(); Object.assign(cur, { a: at, b: at, pos: at }); }
  else { const keep = { id: cur.id, a: at, b: at, pos: at, visible: true }; cur = { ...cur, ...S, ...keep }; }
  syncControls(); dirty();
}

// ---------- pointer: hand-rolling, picking holes, moving the ring ----------
let drag = null;
// two fingers on a touch screen always mean zoom/pan, never rolling: a second finger cancels the roll
// the first finger started (and takes back any ink it laid), and nothing rolls again until every finger lifts
const touches = new Map();
let pinch = null, pinchHold = false;
const twoFinger = () => { const [a, b] = [...touches.values()]; return { mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 }; };
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size >= 2) {
      if (drag && drag.kind === 'roll') { Object.assign(cur, drag.from); coast = null; inkDirty = true; }
      drag = null; cv.classList.remove('rolling');
      pinch = twoFinger(); pinchHold = true; return;
    }
  }
  if (pinchHold) return;
  const [x, y] = toWorld(e.clientX, e.clientY);
  try { cv.setPointerCapture(e.pointerId); } catch {}
  if (e.button === 1) { e.preventDefault(); drag = { kind: 'pan', x: e.clientX, y: e.clientY }; cv.classList.add('panning'); return; }
  if (moveMode || e.altKey) { drag = { kind: 'move' }; return; }
  if (P.stencil) {
    const G = geom(cur), w = wheelAt(G, cur, cur.pos), tol = Math.max(G.p * .32, 10 * view.dpr / view.s);
    const hit = G.holes.findIndex(h => Math.hypot(w.wx + h.d * Math.cos(w.spin + h.a) - x, w.wy + h.d * Math.sin(w.spin + h.a) - y) < tol);
    if (hit >= 0 && hit !== G.hole) { change(s => s.hole = hit); return; }
  }
  stop();
  if (autoHidden) showPieces(true);
  remember();
  drag = { kind: 'roll', last: Math.atan2(y - cur.cy, x - cur.cx), samples: [], from: { pos: cur.pos, a: cur.a, b: cur.b } };
  cv.classList.add('rolling');
});
cv.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch) {
    if (touches.size < 2) return;
    const n = twoFinger();
    zoomBy(n.d / pinch.d, n.mx, n.my); panBy(n.mx - pinch.mx, n.my - pinch.my);
    pinch = n; return;
  }
  if (drag && drag.kind === 'pan') { panBy(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; return; }
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
  drag = null; cv.classList.remove('rolling', 'panning'); syncPlay();
};
const pointerEnd = e => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (!touches.size) pinchHold = false;
  endDrag();
};
cv.addEventListener('pointerup', pointerEnd); cv.addEventListener('pointercancel', pointerEnd);
// trackpad: pinch arrives as ctrl+wheel (Chrome, Firefox) or gesture events (Safari); two-finger scroll pans
let gesture = null;
cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (gesture) return;
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  if (e.ctrlKey || e.metaKey) zoomBy(Math.exp(-clampN(e.deltaY * k, -60, 60) * .01), e.clientX, e.clientY);
  else panBy(-e.deltaX * k, -e.deltaY * k);
}, { passive: false });
cv.addEventListener('gesturestart', e => { e.preventDefault(); if (!touches.size) gesture = { z: cam.z }; });
cv.addEventListener('gesturechange', e => { e.preventDefault(); if (gesture) zoomTo(gesture.z * e.scale, e.clientX, e.clientY); });
cv.addEventListener('gestureend', e => { e.preventDefault(); gesture = null; });
// keep Safari from zooming the whole page when a pinch starts off the canvas
document.addEventListener('gesturestart', e => e.preventDefault());
$('#zoomIn').addEventListener('click', () => zoomBy(1.25));
$('#zoomOut').addEventListener('click', () => zoomBy(.8));
$('#zoomPct').addEventListener('click', resetView);
// full screen shows just the stage: paper, zoom bar and toggles; Esc leaves
const stageEl = cv.parentElement;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function toggleFullscreen() {
  if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (stageEl.requestFullscreen || stageEl.webkitRequestFullscreen).call(stageEl);
}
function syncFullscreen() {
  const on = !!fsEl(), b = $('#zoomFull');
  b.querySelector('use').setAttribute('href', on ? '#i-corners-in' : '#i-corners-out');
  b.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
  b.title = on ? 'Leave full screen (Esc)' : 'Full screen (⌃⌘F)';
}
$('#zoomFull').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', syncFullscreen); document.addEventListener('webkitfullscreenchange', syncFullscreen);
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
function exportSVG(mode = P.svgMode) {
  P.svgMode = mode; save();
  const W = +PW().toFixed(2), H = +PH().toFixed(2), pp = P.paper, u = pp.unit === 'px' ? '' : pp.unit;
  // real-world size in the width/height attributes, so printers and cutting machines get the true dimensions
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${fmtNum(pp.w)}${u}" height="${fmtNum(pp.h)}${u}" viewBox="0 0 ${W} ${H}">`, '<title>Spiro Lab drawing</title>'];
  out.push(`<defs><clipPath id="paper"><rect width="${W}" height="${H}"/></clipPath></defs>`);
  if (!P.transparent) out.push(`<rect width="${W}" height="${H}" fill="${P.bg}"/>`);
  out.push('<g clip-path="url(#paper)" fill="none" stroke-linecap="round" stroke-linejoin="round">');
  // one named group per Spiro Lab layer, so design apps show readable layer names
  visibleInk().forEach((L, i) => {
    const plan = planOf(L), label = `Layer ${i + 1} · ${penName(L)}${L.rainbow ? ' rainbow' : ''} · ${RINGS[L.ring].inner}/${RINGS[L.ring].outer} · wheel ${L.wheel} ${L.mode}`;
    const id = `layer-${String(i + 1).padStart(2, '0')}-${penName(L).toLowerCase().replace(/[^a-z]+/g, '-')}-wheel-${L.wheel}-${L.mode}`;
    out.push(`<g id="${id}" data-name="${label}"><title>${label}</title><desc>${describe(L)}</desc>`);
    out.push(mode === 'plain' ? plainSVG(L, L._xy, simplify) : planToSVG(plan, L.opacity, simplify));
    out.push('</g>');
  });
  if (!P.transparent) out.push(textureSVG(pp.texture, W, H));
  out.push('</g></svg>');
  download(new Blob([out.join('\n')], { type: 'image/svg+xml' }), `spiro-${stamp()}${mode === 'plain' ? '-plain' : ''}.svg`);
  toast(mode === 'plain' ? 'SVG saved (plain lines)' : 'SVG saved (with pen effects)');
}
function exportPNG() { exportRaster('png'); }
function exportRaster(fmt) {
  const [pw, ph] = paperPixels(P.paper), c = document.createElement('canvas'); c.width = pw; c.height = ph;
  const x = c.getContext('2d'), tooBig = 'That size is too big for this browser. Pick a lower resolution next to the PNG button.';
  if (!x || c.width !== pw) { toast(tooBig, true); return; }
  x.scale(pw / PW(), ph / PH());
  const opaque = fmt === 'jpg' || !P.transparent;   // JPG has no transparency
  if (opaque) { x.fillStyle = P.bg; x.fillRect(0, 0, PW(), PH()); }
  for (const L of visibleInk()) strokeLayer(x, L);
  if (opaque) drawTexture(x, P.paper.texture, PW(), PH());
  c.toBlob(b => {
    if (!b) { toast(tooBig, true); return; }
    download(b, `spiro-${stamp()}-${pw}x${ph}.${fmt}`); toast(`${fmt.toUpperCase()} saved (${pw} × ${ph})`);
  }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', P.jpgQ);
}

// ---------- UI wiring ----------
function chips(box, items, get, set, label = v => v, keepPos = false) {
  box.innerHTML = '';
  items.forEach(v => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label(v);
    b.addEventListener('click', () => change(s => set(s, v), keepPos));
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
swatches($('#pens'), PENS, () => S.color, c => change(s => s.color = c, true));
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
bind('#penColor', 'input', e => change(s => s.color = e.target.value, true));
chips($('#penStyles'), Object.keys(PEN_STYLES), () => S.pen, (s, v) => { s.pen = v; s.width = PEN_STYLES[v].w; }, v => PEN_STYLES[v].label, true);
bind('#rainbow', 'change', e => change(s => s.rainbow = e.target.checked, true));
bind('#bgColor', 'input', e => { P.bg = e.target.value; syncControls(); save(); });
bind('#hole', 'input', e => change(s => s.hole = +e.target.value - 1));
bind('#width', 'input', e => change(s => s.width = +e.target.value, true));
bind('#opacity', 'input', e => change(s => s.opacity = +e.target.value, true));
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
// ---------- folding sections: remember which ones are open ----------
document.querySelectorAll('.fold').forEach(d => {
  const k = d.dataset.fold; d.open = !!(P.folds || {})[k];
  d.addEventListener('toggle', () => { P.folds = { ...P.folds, [k]: d.open }; save(); });
});

// ---------- export panel: one button, pick PNG / JPG / SVG, then that format's options ----------
const exportBtn = $('#exportBtn'), panel = $('#exportPanel');
const FMT_NOTES = {
  png: 'Sharp, lossless image. Best for sharing online and printing.',
  jpg: 'Smaller image with light compression. Good for messages and photo apps. JPG has no transparency, so the paper colour is always included.',
  svg: 'Vector file: stays sharp at any size and can be edited line by line.'
};
function syncExport() {
  const f = P.exportFmt;
  panel.querySelectorAll('[data-fmt]').forEach(b => b.setAttribute('aria-checked', b.dataset.fmt === f));
  panel.querySelectorAll('.opt').forEach(o => o.hidden = !o.dataset.for.split(' ').includes(f));
  panel.querySelectorAll('[data-svg]').forEach(b => b.setAttribute('aria-checked', b.dataset.svg === P.svgMode));
  $('#fmtNote').textContent = FMT_NOTES[f];
  $('#jpgQ').value = P.jpgQ; $('#jpgQOut').textContent = Math.round(P.jpgQ * 100) + '%';
  $('#doExport span').textContent = 'Save ' + f.toUpperCase();
}
function exportNow() { if (P.exportFmt === 'svg') exportSVG(P.svgMode); else exportRaster(P.exportFmt); }
function openExport(open) {
  panel.hidden = !open; exportBtn.setAttribute('aria-expanded', String(open));
  if (open) { syncExport(); panel.querySelector(`[data-fmt="${P.exportFmt}"]`).focus(); }
}
exportBtn.addEventListener('click', () => openExport(panel.hidden));
panel.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', () => { P.exportFmt = b.dataset.fmt; syncExport(); save(); }));
panel.querySelectorAll('[data-svg]').forEach(b => b.addEventListener('click', () => { P.svgMode = b.dataset.svg; syncExport(); save(); }));
bind('#jpgQ', 'input', e => { P.jpgQ = +e.target.value; syncExport(); save(); });
bind('#doExport', 'click', () => { exportNow(); openExport(false); });
// close when clicking anywhere else (capture phase, so the drawing canvas can't swallow it) or pressing Esc
document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && !exportBtn.contains(e.target)) openExport(false); }, true);
panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); openExport(false); exportBtn.focus(); } });
// paper size: when the sheet changes, everything stays centred on it
function setPaper(fn) {
  stop();
  const [w0, h0] = paperWorld(P.paper);
  remember();
  fn(P.paper);
  const [w1, h1] = paperWorld(P.paper), dx = (w1 - w0) / 2, dy = (h1 - h0) / 2;
  if (dx || dy) for (const L of [...layers, cur, S]) { L.cx += dx; L.cy += dy; }
  cam.z = 1; cam.x = cam.y = 0; fit(); ringKey = ''; syncControls(); dirty();
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
const showGhost = on => { P.ghost = on; syncControls(); save(); };
bind('#ghostToggle', 'click', () => showGhost(!P.ghost));
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
  const gt = $('#ghostToggle'); gt.setAttribute('aria-pressed', P.ghost); gt.querySelector('span').textContent = P.ghost ? 'Preview on' : 'Preview off';
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
// ---------- layer list: show/hide, delete, edit a finished pass, drag to reorder ----------
let editId = null, editArmed = false;
const layerTitle = L => `${RINGS[L.ring].inner}/${RINGS[L.ring].outer} · ${L.wheel} wheel`;
const layerSub = L => `${penName(L)}${L.rainbow ? ' rainbow' : ''} · ${L.mode} · hole ${L.hole + 1} · shift ${L.shift}`;
function refreshRow(li, L) {
  li.querySelector('.dot').className = 'dot' + (L.rainbow ? ' rainbow' : ''); li.querySelector('.dot').style.setProperty('--c', L.color);
  li.querySelector('small').textContent = layerSub(L);
}
// apply an edit to a finished layer without rebuilding the list (so a slider being dragged keeps focus)
function editLayer(L, li, fn) {
  if (!editArmed) { remember(); editArmed = true; }
  fn(L); inkDirty = true; save(); refreshRow(li, L);
}
function moveLayer(L, by) {
  const i = layers.indexOf(L), j = clampN(i + by, 0, layers.length - 1);
  if (i === j) return;
  remember(); layers.splice(i, 1); layers.splice(j, 0, L); dirty();
}
function editorFor(L, li) {
  const ed = document.createElement('div'); ed.className = 'layered';
  ed.innerHTML = `<div class="chips pens4 small">${Object.keys(PEN_STYLES).map(k => `<button type="button" class="chip" data-pen="${k}" aria-pressed="${k === (L.pen || 'ballpoint')}">${PEN_STYLES[k].label}</button>`).join('')}</div>
    <div class="swatches mini">${PENS.map(c => `<button type="button" class="sw" data-c="${c}" style="--c:${c}" aria-label="Colour ${c}" aria-pressed="${c.toLowerCase() === L.color.toLowerCase()}"></button>`).join('')}</div>
    <label class="row"><span>Colour</span><input type="color" value="${L.color}" data-k="color"><span></span></label>
    <label class="row"><span>Thickness</span><input type="range" min=".4" max="12" step=".1" value="${L.width}" data-k="width"><output>${(+L.width).toFixed(1)}</output></label>
    <label class="row"><span>Opacity</span><input type="range" min=".1" max="1" step=".05" value="${L.opacity}" data-k="opacity"><output>${Math.round(L.opacity * 100)}%</output></label>
    <label class="check"><input type="checkbox" data-k="rainbow" ${L.rainbow ? 'checked' : ''}> Rainbow ink</label>
    <div class="btnrow"><button type="button" class="btn sm" data-done>Done</button><small class="draghint">Drag ⋮⋮ to change the order</small></div>`;
  ed.addEventListener('change', () => { editArmed = false; });
  ed.querySelectorAll('[data-pen]').forEach(b => b.addEventListener('click', () => {
    editArmed = false; editLayer(L, li, l => { l.pen = b.dataset.pen; l.width = PEN_STYLES[l.pen].w; });
    ed.querySelectorAll('[data-pen]').forEach(x => x.setAttribute('aria-pressed', x === b));
    const w = ed.querySelector('[data-k="width"]'); w.value = L.width; w.nextElementSibling.textContent = (+L.width).toFixed(1); editArmed = false;
  }));
  ed.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
    editArmed = false; editLayer(L, li, l => l.color = b.dataset.c); editArmed = false;
    ed.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', x === b)); ed.querySelector('[data-k="color"]').value = L.color;
  }));
  ed.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.k, v = k === 'rainbow' ? inp.checked : k === 'color' ? inp.value : +inp.value;
    editLayer(L, li, l => l[k] = v);
    if (k === 'width') inp.nextElementSibling.textContent = v.toFixed(1);
    if (k === 'opacity') inp.nextElementSibling.textContent = Math.round(v * 100) + '%';
    if (k === 'rainbow') editArmed = false;
  }));
  ed.querySelector('[data-done]').addEventListener('click', () => { editId = null; inkDirty = true; renderLayers(); });
  return ed;
}
// drag a row by its handle. The pointer is followed at window level: moving the row in the DOM
// would cancel pointer capture on the handle, which is why it used to stop after one step.
function dragRow(e, li, list) {
  e.preventDefault();
  const id = e.pointerId, ids = () => [...list.querySelectorAll('.layer')].map(r => r.dataset.id).join(), before = ids();
  li.classList.add('dragging'); document.body.classList.add('dragging-layer');
  let lastY = e.clientY, scrollTimer = null;
  const place = y => {
    const rows = [...list.querySelectorAll('.layer')].filter(r => r !== li);
    const next = rows.find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
    if (next) { if (next !== li.nextElementSibling) list.insertBefore(li, next); }
    else if (li !== list.lastElementChild) list.appendChild(li);
  };
  // scroll the list when dragging near its top or bottom edge
  const edgeScroll = () => {
    const b = list.getBoundingClientRect(), zone = 36;
    const v = lastY < b.top + zone ? -(b.top + zone - lastY) / 3 : lastY > b.bottom - zone ? (lastY - (b.bottom - zone)) / 3 : 0;
    if (v) { list.scrollTop += v; place(lastY); }
  };
  const move = ev => { if (ev.pointerId !== id) return; lastY = ev.clientY; place(lastY); };
  const end = ev => {
    if (ev.pointerId !== id) return;
    removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
    clearInterval(scrollTimer); li.classList.remove('dragging'); document.body.classList.remove('dragging-layer');
    if (ids() === before) return;
    remember();
    const byId = new Map(layers.map(l => [l.id, l]));
    layers = [...list.querySelectorAll('.layer')].map(r => byId.get(+r.dataset.id)).reverse();   // the list shows newest on top
    dirty();
  };
  scrollTimer = setInterval(edgeScroll, 16);
  addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
}
function renderLayers() {
  const list = $('#layers'); list.innerHTML = '';
  if (editId != null && !layers.some(l => l.id === editId)) editId = null;
  $('#layerCount').textContent = layers.length ? `${layers.length} finished` : 'None yet';
  if (!layers.length) { list.innerHTML = '<li class="empty">Finished passes appear here. Press <b>New layer</b> to keep a pass and start the next one.</li>'; return; }
  [...layers].reverse().forEach(L => {
    const li = document.createElement('li'); li.className = 'layer' + (L.visible ? '' : ' hidden') + (L.id === editId ? ' editing' : ''); li.dataset.id = L.id;
    li.innerHTML = `<button type="button" class="grip" aria-label="Drag to reorder"><svg><use href="#i-dots-six-vertical"/></svg></button>
      <i class="dot${L.rainbow ? ' rainbow' : ''}" style="--c:${L.color}"></i><div><b>${layerTitle(L)}</b><small>${layerSub(L)}</small></div>
      <button type="button" class="ico" aria-label="Edit layer" aria-expanded="${L.id === editId}"><svg><use href="#i-pencil-simple"/></svg></button>
      <button type="button" class="ico" aria-label="${L.visible ? 'Hide' : 'Show'} layer"><svg><use href="#i-${L.visible ? 'eye' : 'eye-slash'}"/></svg></button>
      <button type="button" class="ico" aria-label="Delete layer"><svg><use href="#i-trash"/></svg></button>`;
    const [grip, edit, eye, del] = li.querySelectorAll('button');
    grip.addEventListener('pointerdown', e => dragRow(e, li, list));
    grip.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); moveLayer(L, e.key === 'ArrowUp' ? 1 : -1); $(`.layer[data-id="${L.id}"] .grip`)?.focus(); } });
    edit.addEventListener('click', () => { editId = editId === L.id ? null : L.id; editArmed = false; inkDirty = true; renderLayers(); });
    eye.addEventListener('click', () => { remember(); L.visible = !L.visible; dirty(); });
    del.addEventListener('click', () => { remember(); layers = layers.filter(x => x !== L); dirty(); });
    if (L.id === editId) li.appendChild(editorFor(L, li));
    list.appendChild(li);
  });
}
let toastT;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

// keyboard
addEventListener('keydown', e => {
  if (!(e.target instanceof Element) || e.target.matches('input[type=number], input[type=text]')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); exportNow(); return; }
  if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); openExport(panel.hidden); return; }
  if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomBy(1.25); return; }
  if (mod && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomBy(.8); return; }
  if (mod && e.key === '0') { e.preventDefault(); resetView(); return; }
  if (mod && e.key === '1') { e.preventDefault(); actualSize(); return; }
  if (e.metaKey && e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); return; }
  if (mod) return;
  if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); playing ? stop() : play(); }
  else if (e.key === 'Enter' && !e.target.matches('button')) { e.preventDefault(); newLayerFromCurrent(); }
  else if (e.key === 'f') finish();
  else if (e.key === 'h') showPieces(!P.stencil);
  else if (e.key === 'g') showGhost(!P.ghost);
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
