// Spiro Lab — phase 1: rings & wheels, auto-draw and hand-rolling, layers, background, PNG + SVG export.
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const STORE = 'spiro-lab-v1';
const PENS = ['#1b1b1f', '#e63946', '#f77f00', '#fcbf49', '#2a9d8f', '#3a86ff', '#7b2cbf', '#ff4d8d', '#06d6a0', '#8d5a2b', '#ffffff', '#9aa5b1'];
const PAPERS = [['#ffffff', 'White'], ['#f6f1e7', 'Cream'], ['#e8d8b9', 'Kraft'], ['#111114', 'Black card'], ['#14213d', 'Navy'], ['#2b2d42', 'Slate']];

// ---------- state ----------
const S = { ring: 1, mode: 'inside', wheel: 52, hole: 4, shift: 0, pitch: 16, cx: 500, cy: 500, color: '#3a86ff', width: 1.6, opacity: 1, autoShift: 0 };
const P = { bg: '#ffffff', stencil: true, speed: .6, pngSize: 4096, transparent: false };
let layers = [], cur = null, playing = false, uid = 1;
let past = [], future = [];

const newLayer = () => ({ id: uid++, ...S, a: 0, b: 0, pos: 0, visible: true });
const inked = L => L && L.b - L.a > 1e-6;
const strip = L => { const { _tr, _key, ...rest } = L; return rest; };
const snapshot = () => JSON.stringify({ layers: layers.map(strip), cur: strip(cur) });
function restore(json) { const o = JSON.parse(json); layers = o.layers; cur = o.cur; uid = Math.max(uid, ...layers.map(l => l.id + 1), cur.id + 1); Object.assign(S, pickS(cur)); syncControls(); dirty(); }
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
    Object.assign(S, o.S); Object.assign(P, o.P); layers = o.layers || []; cur = o.cur || newLayer();
    uid = Math.max(1, ...layers.map(l => l.id + 1), cur.id + 1); return true;
  } catch { return false; }
}

// ---------- traces (cached per layer) ----------
function tr(L) {
  const key = [L.ring, L.mode, L.wheel, L.hole, L.shift, L.pitch, L.cx, L.cy].join();
  if (L._key !== key) { L._tr = trace(L); L._key = key; }
  return L._tr;
}
function pathOf(L, ctx) {
  const t = tr(L), p = t.pts; let first = true;
  for (const i of rangeIdx(t, L.a, L.b)) { if (first) { ctx.moveTo(p[i * 2], p[i * 2 + 1]); first = false; } else ctx.lineTo(p[i * 2], p[i * 2 + 1]); }
}
function strokeLayer(ctx, L) {
  if (!inked(L)) return;
  ctx.save(); ctx.globalAlpha = L.opacity; ctx.strokeStyle = L.color; ctx.lineWidth = L.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pathOf(L, ctx); ctx.stroke(); ctx.restore();
}

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
  const s = Math.min(r.width, r.height) * .92 / PAPER;
  Object.assign(view, { s: s * dpr, ox: (cv.width - PAPER * s * dpr) / 2, oy: (cv.height - PAPER * s * dpr) / 2, dpr });
  inkDirty = true;
}
new ResizeObserver(fit).observe(cv.parentElement);
const toWorld = (cx_, cy_) => { const r = cv.getBoundingClientRect(); return [((cx_ - r.left) * view.dpr - view.ox) / view.s, ((cy_ - r.top) * view.dpr - view.oy) / view.s]; };
const worldT = c => c.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);

function rebuildInk() {
  ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, ink.width, ink.height);
  worldT(ictx); ictx.beginPath(); ictx.rect(0, 0, PAPER, PAPER); ictx.clip();
  for (const L of layers) if (L.visible) strokeLayer(ictx, L);
  inkDirty = false;
}

// ---------- stencil drawing (translucent acrylic pieces) ----------
function gearPath(c, x, y, teeth, R, h, phase, tipOut) {
  const s = TAU / teeth, root = R - (tipOut ? h / 2 : -h / 2), tip = R + (tipOut ? h / 2 : -h / 2);
  for (let i = 0; i < teeth; i++) {
    const m = phase + i * s;
    [[root, -.32], [tip, -.17], [tip, .17], [root, .32]].forEach(([r, f], k) => {
      const ax = x + r * Math.cos(m + f * s), ay = y + r * Math.sin(m + f * s);
      i === 0 && k === 0 ? c.moveTo(ax, ay) : c.lineTo(ax, ay);
    });
  }
  c.closePath();
}
function drawStencil(c, L) {
  const G = geom(L), w = wheelAt(G, L, L.pos), h = G.p * .55, px = 1 / view.s * view.dpr;
  const ring = G.ring, Ri = radiusOf(ring.inner, G.p), Ro = radiusOf(ring.outer, G.p);
  c.save();
  c.beginPath(); gearPath(c, L.cx, L.cy, ring.outer, Ro, h, 0, true); gearPath(c, L.cx, L.cy, ring.inner, Ri, h, 0, false);
  c.fillStyle = 'rgba(120,190,255,.16)'; c.fill('evenodd');
  c.strokeStyle = 'rgba(70,140,220,.55)'; c.lineWidth = 1.2 * px; c.stroke();
  c.beginPath(); c.arc(L.cx, L.cy, 3 * px * 2, 0, TAU); c.fillStyle = 'rgba(70,140,220,.6)'; c.fill();
  const phase = w.spin + (G.inside ? 0 : Math.PI) + Math.PI / G.t;
  c.beginPath(); gearPath(c, w.wx, w.wy, G.t, G.rr, h, phase, true);
  c.fillStyle = 'rgba(255,120,170,.2)'; c.fill(); c.strokeStyle = 'rgba(220,70,130,.6)'; c.lineWidth = 1.2 * px; c.stroke();
  G.holes.forEach((ho, i) => {
    const hx = w.wx + ho.d * Math.cos(w.spin + ho.a), hy = w.wy + ho.d * Math.sin(w.spin + ho.a);
    c.beginPath(); c.arc(hx, hy, G.p * .17, 0, TAU);
    c.fillStyle = i === G.hole ? L.color : 'rgba(255,255,255,.55)'; c.fill();
    c.strokeStyle = 'rgba(160,40,90,.55)'; c.lineWidth = .9 * px; c.stroke();
  });
  c.beginPath(); c.arc(w.wx, w.wy, G.p * .22, 0, TAU); c.strokeStyle = 'rgba(220,70,130,.6)'; c.stroke();
  c.beginPath(); c.arc(w.px, w.py, Math.max(G.p * .28, 4 * px), 0, TAU); c.fillStyle = L.color; c.fill();
  c.lineWidth = 2 * px; c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
  c.restore();
}

// ---------- frame ----------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  if (!cv.width || !cv.height) { fit(); if (!cv.width || !cv.height) return; }
  if (playing) advance(P.speed * TAU * dt);
  if (inkDirty) rebuildInk();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  worldT(ctx);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30 * view.dpr; ctx.shadowOffsetY = 8 * view.dpr;
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, PAPER, PAPER); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ink, 0, 0);
  worldT(ctx); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PAPER, PAPER); ctx.clip();
  strokeLayer(ctx, cur); ctx.restore();
  if (P.stencil) drawStencil(ctx, cur);
}

// ---------- drawing actions ----------
function advance(d) {
  const G = tr(cur).G;
  cur.pos += d; cur.a = Math.min(cur.a, cur.pos); cur.b = Math.max(cur.b, cur.pos);
  if (cur.b - cur.a >= G.total) { cur.b = cur.a + G.total; if (playing) { stop(); toast('Pattern complete — it closed after ' + G.laps + (G.laps === 1 ? ' lap' : ' laps')); } }
  readout(); save();
}
function play() {
  if (cur.b - cur.a >= tr(cur).G.total) newLayerFromCurrent();
  remember();
  playing = true; syncPlay();
}
function stop() { playing = false; syncPlay(); }
function finish() { stop(); remember(); const G = tr(cur).G; cur.b = cur.a + G.total; cur.pos = cur.b; readout(); save(); }
function commit() {
  if (!inked(cur)) return false;
  remember(); layers.push(cur); cur = null; return true;
}
function newLayerFromCurrent() {
  stop();
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
  remember();
  drag = { kind: 'roll', last: Math.atan2(y - cur.cy, x - cur.cx) };
  cv.classList.add('rolling');
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const [x, y] = toWorld(e.clientX, e.clientY);
  if (drag.kind === 'move') { change(s => { s.cx = Math.round(clampN(x, 0, PAPER)); s.cy = Math.round(clampN(y, 0, PAPER)); }); return; }
  const ang = Math.atan2(y - cur.cy, x - cur.cx);
  let d = ang - drag.last; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
  drag.last = ang;
  if (Math.abs(d) > 1e-4) advance(d);
});
const endDrag = () => { drag = null; cv.classList.remove('rolling'); syncPlay(); };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
let moveMode = false;

// ---------- export ----------
function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const visibleInk = () => [...layers.filter(l => l.visible), cur].filter(inked);
const describe = L => `${RINGS[L.ring].inner}/${RINGS[L.ring].outer} ring, ${L.wheel}-tooth wheel ${L.mode}, hole ${L.hole + 1}, shift ${L.shift}`;
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
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${PAPER}" height="${PAPER}" viewBox="0 0 ${PAPER} ${PAPER}">`, '<title>Spiro Lab drawing</title>'];
  out.push('<defs><clipPath id="paper"><rect width="1000" height="1000"/></clipPath></defs>');
  if (!P.transparent) out.push(`<rect width="${PAPER}" height="${PAPER}" fill="${P.bg}"/>`);
  out.push('<g clip-path="url(#paper)" fill="none" stroke-linecap="round" stroke-linejoin="round">');
  for (const L of visibleInk()) {
    const t = tr(L), p = t.pts, xs = [], ys = [];
    for (const i of rangeIdx(t, L.a, L.b)) { xs.push(p[i * 2]); ys.push(p[i * 2 + 1]); }
    const keep = simplify(xs, ys, .04), parts = [];
    keep.forEach((i, k) => parts.push((k ? 'L' : 'M') + +xs[i].toFixed(2) + ' ' + +ys[i].toFixed(2)));
    out.push(`<path d="${parts.join('')}" stroke="${L.color}" stroke-width="${L.width}"${L.opacity < 1 ? ` stroke-opacity="${L.opacity}"` : ''}><desc>${describe(L)}</desc></path>`);
  }
  out.push('</g></svg>');
  download(new Blob([out.join('\n')], { type: 'image/svg+xml' }), `spiro-${stamp()}.svg`);
  toast('SVG saved');
}
function exportPNG() {
  const size = +P.pngSize, c = document.createElement('canvas'); c.width = size; c.height = size;
  const x = c.getContext('2d');
  if (!x) { toast('That size is too big for this browser. Try a smaller PNG.', true); return; }
  x.scale(size / PAPER, size / PAPER);
  if (!P.transparent) { x.fillStyle = P.bg; x.fillRect(0, 0, PAPER, PAPER); }
  for (const L of visibleInk()) strokeLayer(x, L);
  c.toBlob(b => {
    if (!b) { toast('That size is too big for this browser. Try a smaller PNG.', true); return; }
    download(b, `spiro-${stamp()}-${size}px.png`); toast(`PNG saved (${size} × ${size})`);
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
const bind = (sel, ev, fn) => $(sel).addEventListener(ev, fn);
bind('#penColor', 'input', e => change(s => s.color = e.target.value));
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
bind('#stencil', 'change', e => { P.stencil = e.target.checked; save(); });
bind('#moveRing', 'click', () => { moveMode = !moveMode; $('#moveRing').setAttribute('aria-pressed', moveMode); cv.classList.toggle('moving', moveMode); });
bind('#centre', 'click', () => change(s => { s.cx = 500; s.cy = 500; }));
bind('#svg', 'click', exportSVG); bind('#png', 'click', exportPNG);
bind('#pngSize', 'change', e => { P.pngSize = +e.target.value; save(); });
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
  ['#rings', '#modes', '#wheels', '#pens', '#papers'].forEach(s => $(s)._sync());
  const G = geom(S);
  $('#hole').max = G.holes.length; $('#hole').value = G.hole + 1; $('#holeOut').textContent = `${G.hole + 1} of ${G.holes.length}`;
  $('#penColor').value = S.color; $('#bgColor').value = P.bg;
  $('#width').value = S.width; $('#widthOut').textContent = S.width.toFixed(1);
  $('#opacity').value = S.opacity; $('#opacityOut').textContent = Math.round(S.opacity * 100) + '%';
  $('#pitch').value = S.pitch; $('#pitchOut').textContent = S.pitch;
  $('#shiftOut').textContent = S.shift + (S.shift === 1 ? ' tooth' : ' teeth');
  $('#autoShift').value = S.autoShift;
  $('#speed').value = sliderFromSpeed(P.speed); $('#speedOut').textContent = P.speed.toFixed(2) + ' laps/s';
  $('#stencil').checked = P.stencil; $('#pngSize').value = P.pngSize; $('#transparent').checked = P.transparent;
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
    li.innerHTML = `<i class="dot" style="--c:${L.color}"></i><div><b>${RINGS[L.ring].inner}/${RINGS[L.ring].outer} · ${L.wheel} wheel</b><small>${L.mode} · hole ${L.hole + 1} · shift ${L.shift}</small></div>
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
  else if (e.key === 'h') { P.stencil = !P.stencil; syncControls(); save(); }
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
