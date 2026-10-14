// The View menu: zoom, turning the view, rulers, guides (with saved sets), snapping and smart guides,
// overlays (grid, centre lines, thirds, print margins), the info bar, hiding the panels, drawing info.
// Conventions follow Photoshop / Pixelmator Pro: rulers in the document's units, guides dragged out of the
// rulers (and back onto them to remove), cyan guides, magenta smart guides, hold Control to stop snapping.
// Guides and these settings belong to the app, not to a drawing; saved guide sets are kept for reuse.
// On the iPad and Mac apps all of this moves to the real menu bar.
(() => {
const $ = s => document.querySelector(s);
const A = window.SpiroLab, V = A.v, P = A.P;
const DEF = { rulers: false, guides: true, lockGuides: false, snap: true, smart: true, overlays: true,
  grid: false, gridStep: { mm: 10, in: .5, px: 100 }, centre: false, thirds: false, margins: false, marginSize: { mm: 10, in: .5, px: 50 },
  info: false, hidePanel: false, hideUI: false };
P.view = { ...DEF, ...(P.view || {}) }; if (P.autoCentre === undefined) P.autoCentre = true;
P.guides = P.guides || []; P.guideSets = P.guideSets || [];
const VS = P.view, RS = 20, GUIDE = '#00b4ff', SMART = '#ff2bd6';
const persist = () => V.persist();

// ---------- units: the paper's own (mm, inches or pixels) ----------
const unit = () => P.paper.unit;
const perUnit = () => unit() === 'mm' ? V.MM : unit() === 'in' ? 25.4 * V.MM : V.PW() / P.paper.w;   // paper units per world unit
const toU = w => w / perUnit(), fromU = u => u * perUnit();
const fmtU = w => { const v = toU(w); return unit() === 'px' ? `${Math.round(v)} px` : unit() === 'in' ? `${v.toFixed(2)} in` : `${(Math.round(v * 10) / 10)} mm`; };
const GRID_OPTS = { mm: [5, 10, 20, 25, 50], in: [.25, .5, 1], px: [50, 100, 200, 500] };
const MARGIN_OPTS = { mm: [5, 10, 15, 20], in: [.25, .5, .75, 1], px: [25, 50, 100] };
const gridStep = () => fromU(VS.gridStep[unit()]), marginSize = () => fromU(VS.marginSize[unit()]);
const straight = () => Math.abs(V.view.r) < 1e-6;

// ---------- snapping ----------
// Candidates along one axis: paper edges and centre, guides, and (when shown) thirds, margins and the grid.
let pointer = null, smartLines = [], moveLabel = null, guideDrag = null;
function snapTargets(axis) {
  const size = axis === 'x' ? V.PW() : V.PH(), out = [[0, 'edge'], [size, 'edge'], [size / 2, 'centre']];
  if (VS.guides) for (const g of P.guides) if (g.axis === axis) out.push([g.at, 'guide']);
  if (VS.overlays && VS.thirds) out.push([size / 3, 'third'], [2 * size / 3, 'third']);
  if (VS.overlays && VS.margins) out.push([marginSize(), 'margin'], [size - marginSize(), 'margin']);
  return out;
}
function snap1(val, axis, extra = []) {
  const tol = 8 * V.view.dpr / V.view.s; let best = null;
  const consider = (at, kind) => { const d = Math.abs(at - val); if (d < tol && (!best || d < best.d)) best = { at, kind, d }; };
  for (const [at, kind] of [...snapTargets(axis), ...extra]) consider(at, kind);
  if (VS.overlays && VS.grid) { const st = gridStep(); consider(Math.round(val / st) * st, 'grid'); }
  return best;
}
// moving a ring: its centre snaps; other pieces' centres count too when smart guides are on. Hold Control to place freely.
function snapMove(x, y, e) {
  smartLines = [];
  if (VS.snap && !e.ctrlKey) {
    const others = VS.smart ? V.stencilCentres() : [];
    const sx = snap1(x, 'x', others.map(c => [c[0], 'smart'])), sy = snap1(y, 'y', others.map(c => [c[1], 'smart']));
    if (sx) { x = sx.at; smartLines.push({ axis: 'x', at: x, kind: sx.kind }); }
    if (sy) { y = sy.at; smartLines.push({ axis: 'y', at: y, kind: sy.kind }); }
  }
  moveLabel = { x, y };
  return [x, y];
}
function endMove() { smartLines = []; moveLabel = null; }

// ---------- drawing the overlays onto the paper ----------
let rulerKey = '';
function drawOverlay(c) {
  const v = V.view, px = v.dpr / v.s, W = V.PW(), H = V.PH(), dark = A.P.bg && (parseInt(A.P.bg.slice(1, 3), 16) + parseInt(A.P.bg.slice(3, 5), 16) + parseInt(A.P.bg.slice(5, 7), 16)) / 765 < .5;
  const ink = dark ? '255,255,255' : '23,32,43';
  c.save(); c.setTransform(v.s * v.ca, v.s * v.sa, -v.s * v.sa, v.s * v.ca, v.ox, v.oy);
  const line = (x0, y0, x1, y1) => { c.moveTo(x0, y0); c.lineTo(x1, y1); };
  if (VS.overlays) {
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip(); c.lineWidth = px;
    if (VS.grid) {
      const st = gridStep(); c.beginPath(); c.strokeStyle = `rgba(${ink},.13)`;
      for (let x = st; x < W; x += st) line(x, 0, x, H);
      for (let y = st; y < H; y += st) line(0, y, W, y);
      c.stroke();
    }
    c.setLineDash([6 * px, 5 * px]);
    if (VS.thirds) { c.beginPath(); c.strokeStyle = `rgba(${ink},.35)`; line(W / 3, 0, W / 3, H); line(2 * W / 3, 0, 2 * W / 3, H); line(0, H / 3, W, H / 3); line(0, 2 * H / 3, W, 2 * H / 3); c.stroke(); }
    if (VS.centre) { c.beginPath(); c.strokeStyle = 'rgba(255,43,214,.6)'; line(W / 2, 0, W / 2, H); line(0, H / 2, W, H / 2); c.stroke(); }
    if (VS.margins) { const m = marginSize(); c.beginPath(); c.strokeStyle = 'rgba(229,72,77,.7)'; c.rect(m, m, W - 2 * m, H - 2 * m); c.stroke(); }
    c.restore();
  }
  // guides run right across the screen, like in Photoshop
  if (VS.guides || guideDrag) {
    const big = (W + H) * 20; c.lineWidth = px;
    P.guides.forEach((g, i) => {
      if (guideDrag && guideDrag.idx === i) return;
      c.beginPath(); c.strokeStyle = GUIDE; g.axis === 'x' ? line(g.at, -big, g.at, big) : line(-big, g.at, big, g.at); c.stroke();
    });
    if (guideDrag && guideDrag.at != null) { c.beginPath(); c.strokeStyle = GUIDE; c.lineWidth = 2 * px; guideDrag.axis === 'x' ? line(guideDrag.at, -big, guideDrag.at, big) : line(-big, guideDrag.at, big, guideDrag.at); c.stroke(); }
  }
  // smart guides while a ring is being moved
  if (smartLines.length) {
    const big = (W + H) * 20; c.lineWidth = px;
    for (const s of smartLines) { c.beginPath(); c.strokeStyle = s.kind === 'guide' ? GUIDE : SMART; s.axis === 'x' ? line(s.at, -big, s.at, big) : line(-big, s.at, big, s.at); c.stroke(); }
  }
  c.restore();
  // little labels, drawn flat on the screen
  const label = (wx, wy, text) => {
    const [dx, dy] = V.worldToDev(wx, wy); c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.font = `600 ${12 * v.dpr}px system-ui, sans-serif`; const tw = c.measureText(text).width, pad = 6 * v.dpr, x = dx + 14 * v.dpr, y = dy + 14 * v.dpr;
    c.fillStyle = 'rgba(23,32,43,.86)'; c.beginPath(); c.roundRect(x, y, tw + 2 * pad, 22 * v.dpr, 6 * v.dpr); c.fill();
    c.fillStyle = '#ffffff'; c.textBaseline = 'middle'; c.fillText(text, x + pad, y + 11 * v.dpr); c.restore();
  };
  if (moveLabel) label(moveLabel.x, moveLabel.y, `X ${fmtU(moveLabel.x)}   Y ${fmtU(moveLabel.y)}`);
  if (guideDrag && guideDrag.at != null && pointer) { const [wx, wy] = V.toWorld(pointer.x, pointer.y); label(wx, wy, `${guideDrag.axis === 'x' ? 'X' : 'Y'} ${fmtU(guideDrag.at)}`); }
  drawRulers();
}

// ---------- rulers ----------
function drawRulers() {
  const v = V.view, cv = V.cv, top = $('#rulerTop'), left = $('#rulerLeft');
  document.body.classList.toggle('rulers', !!VS.rulers && !VS.hideUI);
  if (!VS.rulers) return;
  const key = [v.s, v.ox, v.oy, v.r, cv.width, cv.height, unit(), P.paper.w, pointer && pointer.x, pointer && pointer.y, document.documentElement.dataset.theme].join();
  if (key === rulerKey) return; rulerKey = key;
  const dpr = v.dpr, rs = RS * dpr, cs = getComputedStyle(document.documentElement);
  const bg = cs.getPropertyValue('--desk-2').trim(), fg = cs.getPropertyValue('--dim').trim(), lineC = cs.getPropertyValue('--line').trim();
  top.width = cv.width; top.height = rs; left.width = rs; left.height = cv.height;
  for (const [cnv, horiz] of [[top, true], [left, false]]) {
    const c = cnv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, cnv.width, cnv.height);
    c.fillStyle = lineC; horiz ? c.fillRect(0, rs - dpr, cnv.width, dpr) : c.fillRect(rs - dpr, 0, dpr, cnv.height);
    if (!straight()) { c.fillStyle = fg; c.font = `${10 * dpr}px system-ui, sans-serif`; c.textBaseline = 'middle'; if (horiz) c.fillText('Rulers line up again when the view is straight', 30 * dpr, rs / 2); continue; }
    const pu = perUnit(), pxPerUnit = v.s * pu / dpr;
    const steps = unit() === 'in' ? [.125, .25, .5, 1, 2, 5, 10, 20, 50] : [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    const major = steps.find(st => st * pxPerUnit >= 64) || steps[steps.length - 1];
    const sub = [10, 5, 4, 2, 1].find(n => major / n * pxPerUnit >= 7 && (unit() === 'in' ? [8, 4, 2, 1].includes(n) || n === 4 : n !== 4)) || 1;
    const minor = major / sub, len = horiz ? cv.width : cv.height;
    const w0 = (horiz ? (0 - v.ox) : (0 - v.oy)) / v.s / pu, w1 = (len - (horiz ? v.ox : v.oy)) / v.s / pu;
    c.strokeStyle = fg; c.fillStyle = fg; c.lineWidth = dpr; c.font = `${9.5 * dpr}px ui-monospace, Menlo, monospace`; c.textBaseline = 'top';
    c.beginPath();
    for (let k = Math.floor(w0 / minor); k <= Math.ceil(w1 / minor); k++) {
      const u = k * minor, p = (horiz ? v.ox : v.oy) + u * pu * v.s, isMajor = Math.abs(u / major - Math.round(u / major)) < 1e-6;
      const h = isMajor ? rs * .7 : (sub % 2 === 0 && k % (sub / 2) === 0 ? rs * .42 : rs * .25);
      if (horiz) { c.moveTo(p + .5, rs); c.lineTo(p + .5, rs - h); } else { c.moveTo(rs, p + .5); c.lineTo(rs - h, p + .5); }
      if (isMajor) {
        const t = String(+u.toFixed(3));
        if (horiz) c.fillText(t, p + 3 * dpr, 2 * dpr);
        else { c.save(); c.translate(2 * dpr, p - 3 * dpr); c.rotate(-Math.PI / 2); c.fillText(t, 0, 0); c.restore(); }
      }
    }
    c.stroke();
    if (pointer) {   // where the pointer is
      const r = cv.getBoundingClientRect(), p = horiz ? (pointer.x - r.left) * dpr : (pointer.y - r.top) * dpr;
      c.fillStyle = GUIDE; horiz ? c.fillRect(p, 0, dpr, rs) : c.fillRect(0, p, rs, dpr);
    }
  }
}

// ---------- guides: drag out of a ruler, drag to move, drag back onto a ruler to remove ----------
function overRuler(e) {
  const t = $('#rulerTop').getBoundingClientRect(), l = $('#rulerLeft').getBoundingClientRect();
  return VS.rulers && ((e.clientY >= t.top && e.clientY <= t.bottom && e.clientX >= t.left && e.clientX <= t.right) || (e.clientX >= l.left && e.clientX <= l.right && e.clientY >= l.top && e.clientY <= l.bottom));
}
function startGuide(e, axis, idx) {
  e.preventDefault(); e.stopPropagation();
  guideDrag = { axis, idx, at: idx != null ? P.guides[idx].at : null };
  const move = ev => {
    pointer = { x: ev.clientX, y: ev.clientY };
    const [wx, wy] = V.toWorld(ev.clientX, ev.clientY); let at = axis === 'x' ? wx : wy;
    if (VS.snap && !ev.ctrlKey) { const s = snap1(at, axis, P.guides.filter((g, i) => g.axis === axis && i !== idx).map(g => [g.at, 'guide'])); if (s) at = s.at; }
    guideDrag.at = overRuler(ev) ? null : at; V.redraw();
  };
  const up = ev => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    const g = guideDrag; guideDrag = null;
    if (g.at == null) { if (idx != null) { P.guides.splice(idx, 1); A.toast('Guide removed'); } }
    else if (idx != null) P.guides[idx].at = g.at;
    else { P.guides.push({ axis, at: g.at }); VS.guides = true; }
    persist(); V.redraw(); renderMenu();
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
$('#rulerTop').addEventListener('pointerdown', e => straight() && startGuide(e, 'y', null));
$('#rulerLeft').addEventListener('pointerdown', e => straight() && startGuide(e, 'x', null));
function guideAt(e) {
  if (!VS.guides || VS.lockGuides) return -1;
  const [wx, wy] = V.toWorld(e.clientX, e.clientY), tol = 5 * V.view.dpr / V.view.s;
  return P.guides.findIndex(g => Math.abs((g.axis === 'x' ? wx : wy) - g.at) < tol);
}
// called by the drawing canvas before it starts rolling: a guide under the pointer wins
function pointerDown(e) { const i = guideAt(e); if (i < 0) return false; startGuide(e, P.guides[i].axis, i); return true; }
function hover(e) {
  pointer = { x: e.clientX, y: e.clientY };
  const i = guideAt(e); V.cv.classList.toggle('guide-x', i >= 0 && P.guides[i].axis === 'x'); V.cv.classList.toggle('guide-y', i >= 0 && P.guides[i].axis === 'y');
  if (VS.info) updateInfo();
}
const addCentreGuides = () => { P.guides.push({ axis: 'x', at: V.PW() / 2 }, { axis: 'y', at: V.PH() / 2 }); VS.guides = true; persist(); V.redraw(); };
const clearGuides = () => { P.guides = []; persist(); V.redraw(); A.toast('Guides cleared'); };

// ---------- info bar ----------
function updateInfo() {
  const el = $('#infoBar'); if (!VS.info) return;
  const cur = V.cur, z = Math.round(V.cam.z * 100), pos = pointer ? V.toWorld(pointer.x, pointer.y) : null;
  const inside = pos && pos[0] >= 0 && pos[1] >= 0 && pos[0] <= V.PW() && pos[1] <= V.PH();
  el.textContent = [`${z}%`, inside ? `X ${fmtU(pos[0])}  Y ${fmtU(pos[1])}` : 'X –  Y –', paperLabel(P.paper), `${V.pieceWords(cur)}, ${cur.wheel}-tooth wheel`, `${V.layerCount} layer${V.layerCount === 1 ? '' : 's'}`, straight() ? '' : `turned ${Math.round(V.view.r * 180 / Math.PI)}°`].filter(Boolean).join('   ·   ');
}

// ---------- hiding things ----------
function applyHiding() {
  document.body.classList.toggle('nopanel', !!VS.hidePanel);
  document.body.classList.toggle('noui', !!VS.hideUI);
  document.body.classList.toggle('infobar', !!VS.info && !VS.hideUI);
  $('#infoBar').hidden = !VS.info || VS.hideUI;
  rulerKey = ''; updateInfo();
}
function setHideUI(on) { VS.hideUI = on; applyHiding(); persist(); if (on) A.toast('Just the paper. Press ⌃H or Esc to bring everything back.'); }

// ---------- drawing info ----------
function showInfo() {
  const box = $('#docInfo'), d = A.doc, rec = d.id && window.SpeiraBook ? SpeiraBook.info(d.id) : null, [pw, ph] = paperPixels(P.paper);
  const two = n => String(n).padStart(2, '0'), stamp = t => { const x = new Date(t); return `${two(x.getDate())}/${two(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)} ${two(x.getHours())}:${two(x.getMinutes())}`; };
  const rows = [['Name', d.name], ['Saved', rec ? `${stamp(rec.modified)} (made ${stamp(rec.created)})` : 'Not in your Sketchbook yet'],
    ['Paper', paperLabel(P.paper)], ['Picture size', `${pw} × ${ph} pixels`], ['Paper colour', P.bg.toUpperCase()],
    ['Layers', String(V.layerCount)], ['Pieces now', `${V.pieceWords(V.cur)}, ${V.cur.wheel}-tooth wheel`]];
  box.querySelector('dl').innerHTML = rows.map(([k, val]) => `<dt>${k}</dt><dd>${String(val).replace(/</g, '&lt;')}</dd>`).join('');
  box.hidden = false; box.querySelector('button').focus();
}
$('#docInfo button').addEventListener('click', () => $('#docInfo').hidden = true);
$('#docInfo').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') $('#docInfo').hidden = true; });

// ---------- the menu ----------
const menu = $('#viewMenu'), btn = $('#viewBtn');
const toggle = (k, after) => () => { VS[k] = !VS[k]; persist(); V.redraw(); rulerKey = ''; after && after(); renderMenu(); };
function items() {
  const fitted = Math.abs(V.cam.z - 1) < .005 && Math.abs(V.cam.x) < 1 && Math.abs(V.cam.y) < 1;
  const u = unit(), deg = Math.round(V.view.r * 180 / Math.PI);
  return [
    { label: 'Zoom in', key: '⌘+', run: () => V.zoomBy(1.25) },
    { label: 'Zoom out', key: '⌘−', run: () => V.zoomBy(.8) },
    { label: 'Zoom to fit', key: '⌘0', check: fitted, run: () => V.resetView() },
    { label: 'Actual size', key: '⌘1', run: () => V.actualSize() },
    { label: 'Auto-centre', check: P.autoCentre !== false, run: () => { P.autoCentre = P.autoCentre === false; persist(); } },
    '-',
    { html: `<div class="vrow"><span>Turn view</span><button type="button" data-rot="-15" aria-label="Turn left 15°">⟲ 15°</button><button type="button" data-rot="0" ${deg ? '' : 'disabled'}>${deg ? `Straighten (${deg}°)` : 'Straight'}</button><button type="button" data-rot="15" aria-label="Turn right 15°">15° ⟳</button></div>` },
    '-',
    { label: 'Rulers', key: '⌃⌘R', check: VS.rulers, run: toggle('rulers') },
    { label: 'Guides', key: '⌘;', check: VS.guides, run: toggle('guides') },
    { label: 'Lock guides', key: '⌥⌘;', check: VS.lockGuides, run: toggle('lockGuides') },
    { label: 'Snap', key: '⇧⌘;', check: VS.snap, run: toggle('snap') },
    { label: 'Smart guides', check: VS.smart, run: toggle('smart') },
    { label: 'Add centre guides', run: addCentreGuides },
    { html: `<div class="vrow"><span>New guide</span><select id="ngAxis" aria-label="Direction"><option value="y">Across</option><option value="x">Down</option></select><input type="number" id="ngAt" step="any" aria-label="Position in ${u}" placeholder="${u}"><button type="button" data-act="newGuide">Add</button></div>` },
    { label: `Clear guides${P.guides.length ? ` (${P.guides.length})` : ''}`, disabled: !P.guides.length, run: clearGuides },
    { html: `<div class="vsets"><span class="vhead">Saved guides</span>${P.guideSets.map((g, i) => `<div class="vrow"><span>${g.name.replace(/</g, '&lt;')} <small>${g.guides.length}</small></span><button type="button" data-use="${i}">Use</button><button type="button" data-del="${i}" aria-label="Delete ${g.name.replace(/"/g, '')}">×</button></div>`).join('') || '<span class="vnote">None yet. Place some guides, then save them here to use again.</span>'}
      <div class="vrow"><input type="text" id="gsName" placeholder="Name these guides" aria-label="Name for the guide set" ${P.guides.length ? '' : 'disabled'}><button type="button" data-act="saveSet" ${P.guides.length ? '' : 'disabled'}>Save</button></div></div>` },
    '-',
    { label: 'Overlays', check: VS.overlays, run: toggle('overlays') },
    { label: 'Grid', key: "⌘'", check: VS.grid, run: toggle('grid'), extra: `<select data-opt="grid" aria-label="Grid spacing">${GRID_OPTS[u].map(o => `<option value="${o}" ${o === VS.gridStep[u] ? 'selected' : ''}>${o} ${u}</option>`).join('')}</select>` },
    { label: 'Centre lines', check: VS.centre, run: toggle('centre') },
    { label: 'Thirds', check: VS.thirds, run: toggle('thirds') },
    { label: 'Print margins', check: VS.margins, run: toggle('margins'), extra: `<select data-opt="margin" aria-label="Margin size">${MARGIN_OPTS[u].map(o => `<option value="${o}" ${o === VS.marginSize[u] ? 'selected' : ''}>${o} ${u}</option>`).join('')}</select>` },
    '-',
    { label: 'Info bar', key: '⌃⌘I', check: VS.info, run: toggle('info', applyHiding) },
    { label: 'Hide panel', key: '⌃⌘P', check: VS.hidePanel, run: toggle('hidePanel', applyHiding) },
    { label: 'Hide everything but the paper', key: '⌃H', run: () => { closeMenu(); setHideUI(true); } },
    { label: 'Drawing info…', run: () => { closeMenu(); showInfo(); } },
    '-',
    { label: V.isFull() ? 'Leave full screen' : 'Full screen', key: '⌃⌘F', run: () => { closeMenu(); V.toggleFullscreen(); } }
  ];
}
function renderMenu() {
  if (menu.hidden) return;
  menu.innerHTML = '';
  for (const it of items()) {
    if (it === '-') { menu.insertAdjacentHTML('beforeend', '<hr>'); continue; }
    if (it.html) { menu.insertAdjacentHTML('beforeend', it.html); continue; }
    const row = document.createElement('div'); row.className = 'vitem';
    const b = document.createElement('button'); b.type = 'button'; b.disabled = !!it.disabled;
    if ('check' in it) { b.setAttribute('role', 'menuitemcheckbox'); b.setAttribute('aria-checked', String(!!it.check)); }
    b.innerHTML = `<span class="vcheck">${it.check ? '✓' : ''}</span><span class="vlabel">${it.label}</span><kbd>${it.key || ''}</kbd>`;
    b.addEventListener('click', () => { it.run(); renderMenu(); });
    row.appendChild(b); if (it.extra) row.insertAdjacentHTML('beforeend', it.extra); menu.appendChild(row);
  }
  menu.querySelectorAll('[data-rot]').forEach(b => b.addEventListener('click', () => { const d = +b.dataset.rot; V.rotateTo(d ? V.cam.r + d * Math.PI / 180 : 0); rulerKey = ''; renderMenu(); }));
  menu.querySelector('[data-act="newGuide"]').addEventListener('click', () => {
    const axis = $('#ngAxis').value, v = parseFloat($('#ngAt').value); if (!isFinite(v)) return;
    P.guides.push({ axis, at: fromU(v) }); VS.guides = true; persist(); V.redraw(); renderMenu();
  });
  menu.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => { P.guides = P.guideSets[+b.dataset.use].guides.map(g => ({ ...g })); VS.guides = true; persist(); V.redraw(); renderMenu(); A.toast(`Using the guides “${P.guideSets[+b.dataset.use].name}”`); }));
  menu.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { P.guideSets.splice(+b.dataset.del, 1); persist(); renderMenu(); }));
  const ss = menu.querySelector('[data-act="saveSet"]');
  ss.addEventListener('click', () => {
    const name = ($('#gsName').value || '').trim() || `Guides ${P.guideSets.length + 1}`;
    P.guideSets.push({ name, guides: P.guides.map(g => ({ ...g })) }); persist(); renderMenu(); A.toast(`Saved the guides as “${name}”`);
  });
  menu.querySelectorAll('[data-opt]').forEach(sel => sel.addEventListener('change', () => {
    const u = unit(); if (sel.dataset.opt === 'grid') { VS.gridStep[u] = +sel.value; VS.grid = true; } else { VS.marginSize[u] = +sel.value; VS.margins = true; VS.overlays = true; }
    if (sel.dataset.opt === 'grid') VS.overlays = true; persist(); V.redraw(); renderMenu();
  }));
}
function openMenu() { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); renderMenu(); menu.querySelector('button').focus(); }
function closeMenu() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
btn.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); }, true);
menu.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { closeMenu(); btn.focus(); } });

// ---------- shortcuts (Photoshop / Pixelmator style; ⌘R and ⌘/ belong to the browser, so the web uses ⌃⌘) ----------
addEventListener('keydown', e => {
  if (!(e.target instanceof Element) || e.target.matches('input, select, textarea')) return;
  const cmd = e.metaKey, ctrl = e.ctrlKey;
  const go = fn => { e.preventDefault(); fn(); V.redraw(); rulerKey = ''; renderMenu(); };
  if (e.code === 'Semicolon' && cmd && !ctrl) { if (e.altKey) go(() => { VS.lockGuides = !VS.lockGuides; persist(); }); else if (e.shiftKey) go(() => { VS.snap = !VS.snap; persist(); A.toast(VS.snap ? 'Snapping on' : 'Snapping off'); }); else go(() => { VS.guides = !VS.guides; persist(); }); }
  else if (e.code === 'Quote' && cmd && !ctrl) go(() => { VS.grid = !VS.grid; if (VS.grid) VS.overlays = true; persist(); });
  else if (e.code === 'KeyR' && cmd && ctrl) go(() => { VS.rulers = !VS.rulers; persist(); });
  else if (e.code === 'KeyI' && cmd && ctrl) go(() => { VS.info = !VS.info; persist(); applyHiding(); });
  else if (e.code === 'KeyP' && cmd && ctrl) go(() => { VS.hidePanel = !VS.hidePanel; persist(); applyHiding(); });
  else if (e.code === 'KeyH' && ctrl && !cmd) go(() => setHideUI(!VS.hideUI));
  else if (e.key === 'Escape' && VS.hideUI) go(() => setHideUI(false));
});

applyHiding();
window.SpeiraView = { drawOverlay, pointerDown, hover, snapMove, endMove, open: openMenu };
})();
