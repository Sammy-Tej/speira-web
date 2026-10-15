// The new canvas sheet, Procreate style: name the drawing, pick its size (a preset, or any size in mm, cm, inches
// or pixels with a print resolution), its paper colour or a see-through background, its colour profile and its
// video settings. It remembers what you chose last time.
(() => {
const $ = s => document.querySelector(s);
const L = window.SpiroLab, sheet = $('#newSheet');
const KEY = 'speira-newsheet-v1';
const UNITS = { mm: [20, 2000], cm: [2, 200], in: [1, 80], px: [100, 16384] };
const DPIS = [72, 150, 300, 600];
let st, folder = 'mine', done = null;

const fresh = () => {
  let last = {}; try { last = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
  return { preset: 'square', unit: 'mm', w: 250, h: 250, dpi: 300, bg: '#ffffff', transparent: false, profile: 'srgb', video: { size: 1080, quality: 'good', hevc: false }, ...last };
};
const conv = (v, from, to, dpi) => {
  const inch = { in: 1, mm: 25.4, cm: 2.54, px: dpi }, i = v / inch[from];
  return to === 'px' ? Math.round(i * dpi) : to === 'mm' ? Math.round(i * 25.4) : +(i * inch[to]).toFixed(2);
};
const pixels = () => st.unit === 'px' ? [Math.round(st.w), Math.round(st.h)] : [conv(st.w, st.unit, 'px', st.dpi), conv(st.h, st.unit, 'px', st.dpi)];
// the unit Speira stores: centimetres are kept as they are, so rulers and the Paper card show cm too
const paperOf = () => ({ ...DEFAULT_PAPER, preset: st.preset, unit: st.unit, w: st.w, h: st.h, dpi: st.dpi, scale: 1, profile: st.profile, video: { ...st.video } });

function render() {
  const [pw, ph] = pixels(), big = pw * ph > 16384 * 16384 / 4;
  const presets = Object.entries(PAPER_PRESETS).filter(([k]) => k !== 'custom').map(([k, p]) =>
    `<button type="button" class="chip" data-preset="${k}" aria-pressed="${st.preset === k}">${p.label}<small>${p.unit === 'px' ? `${p.w} × ${p.h} px` : `${p.w} × ${p.h} ${p.unit}`}</small></button>`).join('');
  const papers = L.papers.map(([c, n]) => `<button type="button" class="sw" style="--c:${c}" data-bg="${c}" aria-label="${n}" title="${n}" aria-pressed="${!st.transparent && st.bg.toLowerCase() === c.toLowerCase()}"></button>`).join('');
  const seg = (name, opts, cur, off = {}) => `<div class="seg ns-seg" role="radiogroup" aria-label="${name}" style="grid-template-columns: repeat(${opts.length}, 1fr)">` +
    opts.map(([v, t]) => `<button type="button" role="radio" data-${name}="${v}" aria-checked="${String(v) === String(cur)}" ${off[v] ? `disabled title="${off[v]}"` : ''}>${t}</button>`).join('') + '</div>';
  const p3 = L.canP3(), hevc = L.canHevc();
  sheet.querySelector('.ns-body').innerHTML = `
    <label class="field"><span class="lbl">Name</span><input type="text" id="nsName" value="${st.name.replace(/"/g, '&quot;')}" maxlength="80" autocomplete="off"></label>
    <div class="field"><span class="lbl">Size</span><div class="chips ns-presets">${presets}</div>
      <div class="ns-size">
        <input type="number" id="nsW" aria-label="Width" value="${st.w}" step="any" min="${UNITS[st.unit][0]}" max="${UNITS[st.unit][1]}"><span>×</span>
        <input type="number" id="nsH" aria-label="Height" value="${st.h}" step="any" min="${UNITS[st.unit][0]}" max="${UNITS[st.unit][1]}">
        <select id="nsUnit" aria-label="Unit">${Object.keys(UNITS).map(u => `<option value="${u}" ${u === st.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
        <button type="button" class="btn sm" id="nsTurn" title="Swap width and height" ${st.w === st.h ? 'disabled' : ''}>Turn</button>
      </div>
      <div class="ns-size" ${st.unit === 'px' ? 'hidden' : ''}><span class="lbl">Print resolution</span>
<input type="number" id="nsDpi" list="nsDpis" aria-label="Print resolution in dots per inch" value="${st.dpi}" min="36" max="2400" step="1"><span>dpi</span><datalist id="nsDpis">${DPIS.map(d => `<option value="${d}"></option>`).join('')}</datalist></div>
      <small class="ns-px ${big ? 'bad' : ''}">${pw} × ${ph} pixels${big ? ' · very large: some browsers may not manage to export it' : ''}</small></div>
    <div class="field"><span class="lbl">Background</span><div class="swatches">${papers}</div>
      <div class="ns-size"><label class="row ns-colour"><span>Any colour</span><input type="color" id="nsBg" value="${st.bg}"></label>
      <label class="check"><input type="checkbox" id="nsClear" ${st.transparent ? 'checked' : ''}> Hide background <small>see-through PNG and SVG</small></label></div></div>
    <div class="field"><span class="lbl">Colour profile</span>${seg('profile', [['srgb', 'sRGB'], ['p3', 'Display P3']], st.profile, p3 ? {} : { p3: 'This browser can\'t make Display P3 pictures' })}
      <small class="ns-note">${st.profile === 'p3' ? 'Richer reds, greens and oranges on Apple screens and in Photos.' : 'Safest for the web, other apps and most printers.'}</small></div>
    <div class="field"><span class="lbl">Video</span>${seg('vsize', [[1080, '1080p'], [1440, '2K'], [2160, '4K']], st.video.size)}
      ${seg('vq', [['low', 'Low'], ['good', 'Good'], ['studio', 'Studio'], ['lossless', 'Lossless']], st.video.quality)}
      <label class="check" ${hevc ? '' : 'title="This browser can\'t record HEVC (Safari can)"'}><input type="checkbox" id="nsHevc" ${st.video.hevc && hevc ? 'checked' : ''} ${hevc ? '' : 'disabled'}> HEVC <small>smaller files at the same quality${hevc ? '' : ' · not in this browser'}</small></label></div>`;
  wire();
}
function setSize(w, h) {
  const [lo, hi] = UNITS[st.unit];
  st.w = Math.min(hi, Math.max(lo, +w || lo)); st.h = Math.min(hi, Math.max(lo, +h || lo)); st.preset = 'custom'; render();
}
function wire() {
  const b = sheet.querySelector('.ns-body');
  $('#nsName').addEventListener('input', e => { st.name = e.target.value; });
  b.querySelectorAll('[data-preset]').forEach(x => x.addEventListener('click', () => {
    const p = PAPER_PRESETS[x.dataset.preset]; Object.assign(st, { preset: x.dataset.preset, unit: p.unit, w: p.w, h: p.h }); render();
  }));
  $('#nsW').addEventListener('change', e => setSize(e.target.value, st.h));
  $('#nsH').addEventListener('change', e => setSize(st.w, e.target.value));
  $('#nsUnit').addEventListener('change', e => { const u = e.target.value; st.w = conv(st.w, st.unit, u, st.dpi); st.h = conv(st.h, st.unit, u, st.dpi); st.unit = u; st.preset = 'custom'; render(); });
  $('#nsTurn').addEventListener('click', () => { [st.w, st.h] = [st.h, st.w]; render(); });
  $('#nsDpi').addEventListener('change', e => { st.dpi = Math.min(2400, Math.max(36, Math.round(+e.target.value || 300))); render(); });
  b.querySelectorAll('[data-bg]').forEach(x => x.addEventListener('click', () => { st.bg = x.dataset.bg; st.transparent = false; render(); }));
  $('#nsBg').addEventListener('input', e => { st.bg = e.target.value; st.transparent = false; b.querySelectorAll('[data-bg]').forEach(x => x.setAttribute('aria-pressed', 'false')); $('#nsClear').checked = false; });
  $('#nsClear').addEventListener('change', e => { st.transparent = e.target.checked; render(); });
  b.querySelectorAll('[data-profile]').forEach(x => x.addEventListener('click', () => { st.profile = x.dataset.profile; render(); }));
  b.querySelectorAll('[data-vsize]').forEach(x => x.addEventListener('click', () => { st.video.size = +x.dataset.vsize; render(); }));
  b.querySelectorAll('[data-vq]').forEach(x => x.addEventListener('click', () => { st.video.quality = x.dataset.vq; render(); }));
  $('#nsHevc').addEventListener('change', e => { st.video.hevc = e.target.checked; });
}
function open(f = 'mine') {
  folder = f; st = { ...fresh(), name: L.canvasName() }; st.video = { ...st.video };
  render(); sheet.hidden = false; $('#nsName').select();
  return new Promise(r => { done = r; });
}
function close(created) { sheet.hidden = true; if (done) { done(created); done = null; } }
function create() {
  const name = (st.name || '').trim() || L.canvasName();
  const { name: _, ...keep } = st; try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch {}
  L.newDoc(folder, { name, paper: paperOf(), bg: st.bg, transparent: st.transparent });
  close(true);
  L.toast(`“${name}” is ready. Press Save (⌘S) to keep it in your Sketchbook.`);
}
$('#nsCreate').addEventListener('click', create);
$('#nsCancel').addEventListener('click', () => close(false));
sheet.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape') close(false);
  if (e.key === 'Enter' && e.target.id === 'nsName') create();
});
window.SpeiraNewSheet = { open, get state() { return st; } };
})();
