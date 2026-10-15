// The shape maker: draw an outline freehand and Speira smooths it into a piece you can roll a wheel round.
// The teeth are worked out from the outline's length. Outlines a real wheel couldn't follow (a point too sharp for
// teeth, a dent tighter than the smallest wheel, a line that crosses itself) are refused, with the trouble spots marked.
// A toothed inner edge is optional, when the corners are round enough for a wheel to get round them inside.
// Saved shapes live in My shapes in the Sketchbook.
(() => {
const $ = s => document.querySelector(s);
const L = window.SpiroLab, root = $('#shapeMaker'), cv = $('#smCv'), ctx = cv.getContext('2d');
const PITCH = 16, M = 256, WORLD = 1000, MIN_T = 60, MAX_T = 240;
const SMALLEST = radiusOf(WHEELS[0], PITCH);   // the 24-tooth wheel
let raw = [], drawing = false, st = null, lastFocus = null;
const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- from a wobbly line to a smooth outline ----------
// points spaced evenly along a closed line
function resample(pts, n) {
  const seg = [], P = [...pts, pts[0]];
  let total = 0;
  for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); total += d; }
  const out = []; let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const want = k / n * total;
    while (i < seg.length - 1 && acc + seg[i] < want) { acc += seg[i]; i++; }
    const f = seg[i] ? (want - acc) / seg[i] : 0;
    out.push([P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]);
  }
  return { pts: out, total };
}
// keep only the gentle waves of the outline (its first `k` Fourier harmonics): the hand's wobble disappears
function smooth(pts, k) {
  const n = pts.length, re = [], im = [];
  for (let h = -k; h <= k; h++) {
    let a = 0, b = 0;
    for (let j = 0; j < n; j++) { const t = -2 * Math.PI * h * j / n, c = Math.cos(t), s = Math.sin(t); a += pts[j][0] * c - pts[j][1] * s; b += pts[j][0] * s + pts[j][1] * c; }
    re.push(a / n); im.push(b / n);
  }
  const out = [];
  for (let j = 0; j < n; j++) {
    let x = 0, y = 0;
    for (let h = -k; h <= k; h++) { const t = 2 * Math.PI * h * j / n, c = Math.cos(t), s = Math.sin(t), A = re[h + k], B = im[h + k]; x += A * c - B * s; y += A * s + B * c; }
    out.push([x, y]);
  }
  return out;
}
function crosses(pts) {
  const n = pts.length, hit = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (hit(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return pts[i];
  }
  return null;
}
const area = pts => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

// the drawn line → a shape object, or the reason it can't be one
function build() {
  if (raw.length < 12) return { error: 'Draw an outline: go all the way round and come back to where you started.' };
  const { pts: even, total } = resample(raw, M);
  const gap = Math.hypot(raw[0][0] - raw[raw.length - 1][0], raw[0][1] - raw[raw.length - 1][1]);
  if (gap > total * .2) return { error: 'Bring the line back to where it started, so the outline closes.' };
  let pts = resample(smooth(even, st.smooth), M).pts;
  const x = crosses(pts); if (x) return { error: 'The outline crosses itself. Draw it as one loop that doesn\'t cross.', spots: [x] };
  if (area(pts) < 0) pts.reverse();   // go round the same way as the built-in shapes
  const a = area(pts); let cx = 0, cy = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % M], w = p[0] * q[1] - q[0] * p[1]; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w; });
  cx /= 6 * a; cy /= 6 * a;
  const per = resample(pts, M).total;
  if (st.teeth == null) st.teeth = Math.max(MIN_T, Math.min(MAX_T, Math.round(per / PITCH)));
  const k = st.teeth / per, flat = [];
  for (const p of pts) flat.push(+((p[0] - cx) * k).toFixed(4), +((p[1] - cy) * k).toFixed(4));
  const shape = { id: st.id, name: st.name, teeth: st.teeth, inner: false, pts: flat };
  // can a real wheel follow it? (checked at the usual kit size; bigger shapes have gentler bends)
  const K = customTrack(shape, PITCH, 0, 0), spots = bends(K, r => r < PITCH * .9 && r > 0, r => r < SMALLEST / .98);
  if (K.minR < PITCH * .9) return { error: 'One point is too sharp for teeth to go round. Round it off, turn Smoothness up, or make the shape bigger.', spots: spots.sharp, shape };
  if (K.minConcave < SMALLEST / .98) return { error: `A dent is tighter than the smallest wheel (${WHEELS[0]} teeth) can get into. Make the dent wider or shallower, turn Smoothness up, or make the shape bigger.`, spots: spots.dent, shape };
  // an inner edge, a little way in, needs every corner round enough for the smallest wheel to get round inside it
  const inset = shapeInset(PITCH), innerOk = K.minR > inset * 1.05 && customTrack(shape, PITCH, -inset, 0).minR > SMALLEST / .98;
  shape.inner = innerOk && st.inner;
  return { shape, innerOk, K };
}
// where the outline bends too tightly, in paper units round (0, 0)
function bends(K, sharp, dent) {
  const out = { sharp: [], dent: [] }, n = K.n;
  for (let i = 0; i < n; i += 2) {
    const a = (i - 2 + n) % n, b = (i + 2) % n, ds = (K.S[b] - K.S[a] + K.Lp) % K.Lp || 1;
    let dp = K.PS[b] - K.PS[a]; while (dp > Math.PI) dp -= 2 * Math.PI; while (dp < -Math.PI) dp += 2 * Math.PI;
    const c = dp / ds;
    if (c > 0 && sharp(1 / c)) out.sharp.push([K.X[i], K.Y[i]]);
    if (c < 0 && dent(-1 / c)) out.dent.push([K.X[i], K.Y[i]]);
  }
  return out;
}

// ---------- drawing the editor ----------
let scale = 1, dpr = 1;
const toWorld = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * WORLD, (e.clientY - r.top) / r.height * WORLD]; };
function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
// a toothed edge of the shape: bumps along the line, tips out (outer edge) or in (inner edge), or a plain line
function edge(c, K, teeth, sign, offset = 0) {
  const h = PITCH * .55, N = teeth ? teeth * 12 : 400, p = K.Lp / (teeth || 1);
  for (let i = 0; i <= N; i++) {
    const s = i / N * K.Lp, [x, y, psi] = trackPoint(K, WORLD / 2, WORLD / 2, s % K.Lp);
    const off = offset + (teeth ? sign * h / 2 * Math.max(-1, Math.min(1, Math.cos(2 * Math.PI * (s / p + .5)) * 1.7)) : 0);
    i ? c.lineTo(x + off * Math.cos(psi), y + off * Math.sin(psi)) : c.moveTo(x + off * Math.cos(psi), y + off * Math.sin(psi));
  }
  c.closePath();
}
function drawPiece(c, shape, tint = '96,170,255') {
  const inset = shapeInset(PITCH), Ko = customTrack(shape, PITCH, 0, 0), Ki = shape.inner ? customTrack(shape, PITCH, -inset, 0) : null;
  c.beginPath(); edge(c, Ko, shape.teeth, 1); Ki ? edge(c, Ki, shape.teeth - SHAPE_GAP, -1) : edge(c, Ko, 0, 1, -Math.min(inset, Ko.minR * .85));
  c.fillStyle = `rgba(${tint},.24)`; c.fill('evenodd'); c.lineWidth = 1.4 / scale; c.strokeStyle = `rgba(${tint.split(',').map(v => v * .55 | 0).join()},.9)`; c.stroke();
}
function paint() {
  const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); scale = cv.width / WORLD;
  const c = ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(scale, 0, 0, scale, 0, 0);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, WORLD, WORLD);
  // a faint grid in centimetres, and the 105-tooth ring's size for scale
  c.strokeStyle = 'rgba(23,32,43,.06)'; c.lineWidth = 1 / scale * dpr;
  for (let v = 0; v <= WORLD; v += 40) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, WORLD); c.moveTo(0, v); c.lineTo(WORLD, v); c.stroke(); }
  c.setLineDash([6, 6]); c.strokeStyle = 'rgba(23,32,43,.18)'; c.beginPath(); c.arc(WORLD / 2, WORLD / 2, radiusOf(105, PITCH), 0, 2 * Math.PI); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(23,32,43,.35)'; c.font = `${13 / scale * dpr}px system-ui, sans-serif`; c.textAlign = 'center';
  c.fillText('for size: the 105-tooth ring', WORLD / 2, WORLD / 2 - radiusOf(105, PITCH) - 10);
  if (drawing || !st.result) {
    if (raw.length > 1) { c.beginPath(); raw.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = '#2a44b5'; c.lineWidth = 2.5; c.lineJoin = c.lineCap = 'round'; c.stroke(); }
    else { c.fillStyle = 'rgba(23,32,43,.45)'; c.font = `${16 / scale * dpr}px system-ui, sans-serif`; c.fillText('Draw an outline here, all the way round', WORLD / 2, WORLD / 2); }
    return;
  }
  const R = st.result;
  if (R.shape && !R.error) {
    drawPiece(c, R.shape);
    // a test pattern: a wheel that fits rolled round the outside, faintly, so you can see what it makes
    const w = [40, 36, 30, 24].find(t => geom({ ring: CUSTOM, custom: R.shape, mode: 'outside', wheel: t, hole: 3, pitch: PITCH, cx: WORLD / 2, cy: WORLD / 2, angle: 0, base: 60, shift: 0 }).fits);
    if (w) {
      const T = trace({ ring: CUSTOM, custom: R.shape, mode: 'outside', wheel: w, hole: 3, pitch: PITCH, cx: WORLD / 2, cy: WORLD / 2, angle: 0, base: 60, shift: 0 });
      c.beginPath(); for (let i = 0; i <= T.N; i++) { const j = (i % T.N) * 2; i ? c.lineTo(T.pts[j], T.pts[j + 1]) : c.moveTo(T.pts[j], T.pts[j + 1]); }
      c.strokeStyle = 'rgba(123,44,191,.45)'; c.lineWidth = 1.2; c.stroke();
    }
  } else if (R.shape) drawPiece(c, R.shape, '200,60,60');
  else if (raw.length > 1) { c.beginPath(); raw.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = 'rgba(200,51,60,.7)'; c.lineWidth = 2.5; c.stroke(); }
  for (const [x, y] of R.spots || []) {
    const sx = R.shape ? x + WORLD / 2 : x, sy = R.shape ? y + WORLD / 2 : y;
    c.beginPath(); c.arc(sx, sy, 14, 0, 2 * Math.PI); c.strokeStyle = '#c8333c'; c.lineWidth = 3; c.stroke();
  }
}
function sync() {
  const R = st.result, ok = R && !R.error;
  $('#smSmoothOut').textContent = st.smooth <= 5 ? 'Very smooth' : st.smooth <= 9 ? 'Smooth' : st.smooth <= 12 ? 'Some detail' : 'Detailed';
  $('#smSize').value = st.teeth ?? 120; $('#smSize').disabled = !R || !R.shape;
  $('#smSizeOut').textContent = st.teeth ? `${st.teeth} teeth` : '–';
  const inner = $('#smInner'); inner.disabled = !ok || !R.innerOk; inner.checked = ok && R.innerOk && st.inner;
  $('#smInnerNote').textContent = !ok ? 'Once the outline works, you can add teeth on the inside too.' : R.innerOk
    ? (st.inner ? `The wheel can roll inside too: ${st.teeth - SHAPE_GAP} teeth on the inner edge.` : 'Add a second toothed edge on the inside, like the round rings.')
    : 'The corners are too tight for a wheel to get round them inside. Make the shape bigger or rounder to allow an inner edge.';
  const status = $('#smStatus');
  status.className = 'smstatus' + (R && R.error ? ' bad' : ok ? ' good' : '');
  status.textContent = !R ? 'Draw the outline of your piece with your finger, Apple Pencil or mouse.' : R.error || `Looks good: a ${st.teeth}-tooth piece. The purple line shows a pattern it makes.`;
  $('#smSave').disabled = !ok;
}
function update() { st.result = raw.length ? build() : null; sync(); paint(); }

// ---------- drawing with a finger, Pencil or mouse ----------
cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} drawing = true; raw = [toWorld(e)]; st.teeth = null; st.result = null; paint(); });
cv.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = toWorld(e), q = raw[raw.length - 1];
  if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 3) { raw.push(p); paint(); }
});
const end = () => { if (!drawing) return; drawing = false; update(); };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

$('#smSmooth').addEventListener('input', e => { st.smooth = 19 - +e.target.value; if (raw.length) update(); else sync(); });
$('#smSize').addEventListener('input', e => { st.teeth = +e.target.value; update(); });
$('#smInner').addEventListener('change', e => { st.inner = e.target.checked; update(); });
$('#smName').addEventListener('input', e => { st.name = e.target.value; });
$('#smClear').addEventListener('click', () => { raw = []; st.teeth = null; update(); });
$('#smCancel').addEventListener('click', () => close());
$('#smSave').addEventListener('click', async () => {
  const R = st.result; if (!R || R.error) return;
  const shape = { ...R.shape, name: (st.name || '').trim() || st.name0 };
  const rec = await SpeiraBook.saveShape(shape, thumb(shape));
  close(); L.useShape(rec.shape);
});
root.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
addEventListener('resize', () => { if (!root.hidden) paint(); });

// a small picture of the piece for the Sketchbook
function thumb(shape) {
  const c = document.createElement('canvas'); c.width = c.height = 360; const x = c.getContext('2d');
  const reach = Math.max(...customTrack(shape, PITCH, 0, 0).X.map(Math.abs), ...customTrack(shape, PITCH, 0, 0).Y.map(Math.abs)) + PITCH;
  const s = 360 / (reach * 2.3), old = scale; scale = s;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 360, 360); x.setTransform(s, 0, 0, s, 180 - WORLD / 2 * s, 180 - WORLD / 2 * s);
  drawPiece(x, shape); scale = old;
  return c.toDataURL('image/png');
}

function open() {
  lastFocus = document.activeElement;
  const n = (window.SpeiraBook ? SpeiraBook.shapes().length : 0) + 1;
  st = { id: uid(), name: `Shape ${n}`, name0: `Shape ${n}`, smooth: 8, teeth: null, inner: false, result: null };
  raw = []; root.hidden = false;
  $('#smName').value = st.name; $('#smSmooth').value = 19 - st.smooth;
  requestAnimationFrame(() => { paint(); sync(); cv.focus(); });
}
function close() { root.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
window.SpeiraShapes = { open, close,
  // for testing: draw an outline from points (paper units, 0–1000) as if by hand
  drawPoints(pts) { raw = pts.map(p => [...p]); update(); return st.result; }, get state() { return st; } };
})();
