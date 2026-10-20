// The Sketchbook: every saved drawing, in folders, kept inside Speira (in this browser), plus .speira files
// for moving drawings between devices or keeping a backup. Saving is a choice you make (Save / ⌘S);
// the native apps will save as you go and sync through iCloud.
(() => {
const $ = s => document.querySelector(s);
const L = window.SpiroLab, DAY = 864e5, KEEP_DELETED = 30;
const SYSTEM = [{ id: 'mine', name: 'My drawings', system: true }, { id: 'shapes', name: 'My shapes', system: true }];
const two = n => String(n).padStart(2, '0');
const stampOf = t => { const d = new Date(t); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${two(d.getHours())}:${two(d.getMinutes())}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- storage: IndexedDB when the browser allows it here, otherwise localStorage ----------
// Everything is also held in memory (`items`, `folders`) so the grid draws instantly.
let db = null, items = new Map(), folders = [];
const LS = 'speira-book-';
function idb() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('speira', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch { res(null); }
  });
}
const tx = (mode, fn) => new Promise((res, rej) => { const t = db.transaction('kv', mode), st = t.objectStore('kv'), out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); });
async function put(key, val) {
  if (db) return tx('readwrite', st => st.put(val, key));
  localStorage.setItem(LS + key, JSON.stringify(val));
}
async function del(key) { if (db) return tx('readwrite', st => st.delete(key)); localStorage.removeItem(LS + key); }
async function loadAll() {
  if (db) {
    const keys = await tx('readonly', st => st.getAllKeys()), vals = await tx('readonly', st => st.getAll());
    keys.forEach((k, i) => k === 'folders' ? (folders = vals[i]) : items.set(k.slice(2), vals[i]));
  } else {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k.startsWith(LS)) continue;
      const v = JSON.parse(localStorage.getItem(k)); k === LS + 'folders' ? (folders = v) : items.set(k.slice(LS.length + 2), v);
    }
  }
}
const saveRec = r => { items.set(r.id, r); return put('d:' + r.id, r).catch(() => L.toast('Could not save: the browser is out of space for Speira', true)); };
const saveFolders = () => put('folders', folders);

// ---------- what's where ----------
let view = 'mine';   // the folder on show: a folder id, or 'trash' for Recently deleted
const allFolders = () => [...SYSTEM, ...folders];
const folderName = id => id === 'trash' ? 'Recently deleted' : (allFolders().find(f => f.id === id) || SYSTEM[0]).name;
const live = () => [...items.values()].filter(r => !r.deletedAt);
const inFolder = id => id === 'trash' ? [...items.values()].filter(r => r.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt)
  : live().filter(r => r.folder === id).sort((a, b) => b.modified - a.modified);
// same name as another drawing? add a number, so "Canvas 14/10/26" is followed by "Canvas 14/10/26 2"
function uniqueName(name, except) {
  const taken = new Set(live().filter(r => r.id !== except).map(r => r.name));
  if (!taken.has(name)) return name;
  let n = 2; while (taken.has(`${name} ${n}`)) n++; return `${name} ${n}`;
}
const daysLeft = r => Math.max(0, KEEP_DELETED - Math.floor((Date.now() - r.deletedAt) / DAY));

// ---------- a small question box (Save / Don't save / Cancel and friends) ----------
function ask(title, text, buttons) {
  return new Promise(res => {
    const box = $('#bookAsk');
    box.querySelector('h3').textContent = title; box.querySelector('p').textContent = text;
    const row = box.querySelector('.bookaskrow'); row.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''); el.textContent = b.label;
      el.addEventListener('click', () => { box.hidden = true; res(b.value); }); row.appendChild(el);
    }
    box.hidden = false; row.querySelector('.primary, .btn').focus();
    box.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') { box.hidden = true; res('cancel'); } };
  });
}
// before replacing the open drawing: offer to save it if it has changes worth keeping
async function okToLeave() {
  if (!L.isDirtyDoc() || (!L.doc.id && !L.layers.length && !(L.cur.b - L.cur.a > 1e-6))) return true;
  const a = await ask(`Save “${L.doc.name}” first?`, 'It has changes that aren\'t in your Sketchbook yet.',
    [{ label: 'Save', value: 'save', primary: true }, { label: 'Don\'t save', value: 'discard' }, { label: 'Cancel', value: 'cancel' }]);
  if (a === 'save') { await save(); return true; }
  return a === 'discard';
}

// ---------- saving and opening ----------
async function save() {
  const d = L.doc, now = Date.now(), old = d.id && items.get(d.id), folder = old && !old.deletedAt ? old.folder : (d.folder === 'trash' || d.folder === 'shapes' ? 'mine' : d.folder);
  const id = old && !old.deletedAt ? d.id : uid();
  const rec = { id, name: uniqueName(d.name, id), folder, created: old ? old.created : now, modified: now, deletedAt: null, thumb: L.thumbnail(), data: L.docData() };
  await saveRec(rec); L.markSaved({ id: rec.id, name: rec.name, folder: rec.folder });
  L.toast(`Saved “${rec.name}” in ${folderName(rec.folder)}`); render();
  return rec.name;
}
// a drawing made elsewhere (Unwind, an opened file): straight into the Sketchbook without opening it
async function saveNew(data, name = L.canvasName(), folder = 'mine') {
  name = uniqueName(name);
  const now = Date.now(), rec = { id: uid(), name, folder, created: now, modified: now, deletedAt: null, thumb: L.thumbnail(data), data };
  await saveRec(rec); render(); return name;
}
// ---------- your own shapes: kept like drawings, in My shapes, as { kind: 'shape', shape } ----------
const shapes = () => live().filter(r => r.kind === 'shape').sort((a, b) => b.modified - a.modified);
async function saveShape(shape, thumb) {
  const now = Date.now(), name = uniqueName(shape.name), rec = { id: uid(), kind: 'shape', name, folder: 'shapes', created: now, modified: now, deletedAt: null, thumb, shape: { ...shape, name } };
  await saveRec(rec); render(); L.renderMyShapes(); return rec;
}
async function openRec(id) {
  const r = items.get(id); if (!r || r.deletedAt) return;
  if (r.kind === 'shape') { L.useShape(r.shape); hide(); return; }
  if (r.id === L.doc.id) { hide(); return; }
  if (!(await okToLeave())) return;
  L.loadDoc(r.data, { id: r.id, name: r.name, folder: r.folder }); hide();
}
// a new drawing: first the new canvas sheet (name, size, background, colour profile, video), then a blank sheet
async function newCanvas(folder) {
  if (!(await okToLeave())) return;
  hide();
  await window.SpeiraNewSheet.open(folder && folder !== 'trash' && folder !== 'shapes' ? folder : 'mine');
}

// ---------- tidying ----------
async function rename(id, name) {
  name = name.trim(); if (!name) return;
  const r = items.get(id); if (r) { r.name = name; if (r.kind === 'shape') r.shape = { ...r.shape, name }; await saveRec(r); }
  if (id === L.doc.id) L.renameDoc(name);
  render(); L.renderMyShapes();
}
async function duplicate(id) {
  const r = items.get(id), now = Date.now(), name = uniqueName(r.name + ' copy');
  await saveRec({ ...r, id: uid(), name, created: now, modified: now, ...(r.kind === 'shape' ? { shape: { ...r.shape, id: uid(), name } } : {}) }); render(); L.renderMyShapes();
}
async function move(id, folder) { const r = items.get(id); r.folder = folder; await saveRec(r); if (id === L.doc.id) L.setDocFolder(folder); render(); }
async function trash(id) {
  const r = items.get(id); r.deletedAt = Date.now(); await saveRec(r);
  if (id === L.doc.id) L.detachDoc();   // still open, but now an unsaved copy
  L.toast(`“${r.name}” moved to Recently deleted. It stays there for ${KEEP_DELETED} days.`); render(); L.renderMyShapes();
}
async function restore(id) { const r = items.get(id); r.deletedAt = null; if (!allFolders().some(f => f.id === r.folder)) r.folder = 'mine'; await saveRec(r); render(); L.renderMyShapes(); }
async function deleteNow(id) {
  const r = items.get(id);
  if (await ask(`Delete “${r.name}” for good?`, 'You can\'t undo this.', [{ label: 'Delete', value: 'yes', danger: true }, { label: 'Cancel', value: 'no', primary: true }]) !== 'yes') return;
  items.delete(id); await del('d:' + id); render();
}
async function emptyTrash() {
  const list = inFolder('trash'); if (!list.length) return;
  if (await ask('Empty Recently deleted?', `${list.length} drawing${list.length > 1 ? 's' : ''} will be gone for good. You can't undo this.`, [{ label: 'Empty', value: 'yes', danger: true }, { label: 'Cancel', value: 'no', primary: true }]) !== 'yes') return;
  for (const r of list) { items.delete(r.id); await del('d:' + r.id); }
  render();
}
async function purgeOld() { for (const r of [...items.values()]) if (r.deletedAt && Date.now() - r.deletedAt > KEEP_DELETED * DAY) { items.delete(r.id); await del('d:' + r.id); } }
async function newFolder() {
  const f = { id: 'f' + uid(), name: 'New folder' }; folders.push(f); await saveFolders(); view = f.id; render(); startRename($(`[data-folder="${f.id}"]`), f.name, n => renameFolder(f.id, n));
}
async function renameFolder(id, name) { name = name.trim(); const f = folders.find(x => x.id === id); if (f && name) { f.name = name; await saveFolders(); } render(); }
async function deleteFolder(id) {
  const f = folders.find(x => x.id === id), list = inFolder(id);
  const a = await ask(`Delete the folder “${f.name}”?`, list.length ? `Its ${list.length} drawing${list.length > 1 ? 's go' : ' goes'} to Recently deleted.` : 'It\'s empty.', [{ label: 'Delete folder', value: 'yes', danger: true }, { label: 'Cancel', value: 'no', primary: true }]);
  if (a !== 'yes') return;
  for (const r of list) { r.deletedAt = Date.now(); await saveRec(r); }
  folders = folders.filter(x => x !== f); await saveFolders(); view = 'mine'; render();
}

// ---------- .speira files ----------
// A small JSON file: the drawing, its name and dates, and a preview. Safe to email, AirDrop or keep as a backup.
function fileOf(r) { return JSON.stringify({ app: 'Speira', format: 1, name: r.name, created: r.created, modified: r.modified, thumb: r.thumb, data: r.data }); }
function download(text, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name.replace(/[\\/:*?"<>|]+/g, '-') + '.speira'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function saveFile(id) {
  if (id) { const r = items.get(id); download(fileOf(r), r.name); return; }
  const d = L.doc, now = Date.now(); download(fileOf({ name: d.name, created: now, modified: now, thumb: L.thumbnail(), data: L.docData() }), d.name);
  L.toast(`Saved “${d.name}.speira” to your downloads`);
}
async function openFile(file) {
  let o; try { o = JSON.parse(await file.text()); } catch { o = null; }
  if (!o || o.app !== 'Speira' || !o.data || !Array.isArray(o.data.layers)) { L.toast(`“${file.name}” isn't a Speira drawing`, true); return; }
  const folder = view !== 'trash' && view !== 'shapes' ? view : 'mine', now = Date.now();
  const rec = { id: uid(), name: uniqueName(o.name || file.name.replace(/\.speira$/i, '')), folder, created: o.created || now, modified: now, deletedAt: null, thumb: o.thumb || L.thumbnail(o.data), data: o.data };
  await saveRec(rec); render();
  if (await okToLeave()) { L.loadDoc(rec.data, { id: rec.id, name: rec.name, folder }); hide(); }
  L.toast(`Opened “${rec.name}” and added it to ${folderName(folder)}`);
}
const fileIn = $('#bookFileIn');
fileIn.addEventListener('change', () => { for (const f of fileIn.files) openFile(f); fileIn.value = ''; });
// drop a .speira file anywhere on Speira to open it
addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
addEventListener('drop', e => { const fs = [...(e.dataTransfer?.files || [])].filter(f => /\.speira$|\.json$/i.test(f.name)); if (fs.length) { e.preventDefault(); fs.forEach(openFile); } });

// ---------- the Sketchbook screen ----------
const root = $('#book'), side = $('#bookFolders'), grid = $('#bookGrid'), head = $('#bookHead');
let lastFocus = null;
function show(folder) {
  if (folder) view = folder; lastFocus = document.activeElement;
  root.hidden = false; render(); setTimeout(() => (grid.querySelector('.bcard') || $('#bookClose')).focus(), 0);
}
function hide() { root.hidden = true; closeMenu(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
function render() {
  if (root.hidden) return;
  side.innerHTML = '';
  const add = (id, name, count, own) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bfolder'; b.dataset.folder = id; b.setAttribute('aria-current', String(id === view));
    b.innerHTML = `<svg><use href="#i-${id === 'trash' ? 'trash' : 'folder-simple'}"/></svg><span>${esc(name)}</span><small>${count || ''}</small>`;
    b.addEventListener('click', () => { view = id; render(); });
    if (own) b.addEventListener('contextmenu', e => { e.preventDefault(); menu(e, [['Rename', () => startRename(b, name, n => renameFolder(id, n))], ['Delete folder', () => deleteFolder(id), true]]); });
    side.appendChild(b);
  };
  for (const f of allFolders()) add(f.id, f.name, inFolder(f.id).length, !f.system);
  add('trash', 'Recently deleted', inFolder('trash').length);

  const list = inFolder(view), own = folders.find(f => f.id === view);
  head.innerHTML = `<h3>${esc(folderName(view))}</h3>` + (view === 'trash' ? `<span class="bnote">Kept for ${KEEP_DELETED} days, then gone for good.</span>` : '');
  if (view === 'trash' && list.length) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm danger'; b.textContent = 'Empty'; b.addEventListener('click', emptyTrash); head.appendChild(b); }
  if (own) {
    const r = document.createElement('button'); r.type = 'button'; r.className = 'btn sm'; r.textContent = 'Rename folder';
    r.addEventListener('click', () => startRename(head.querySelector('h3'), own.name, n => renameFolder(own.id, n))); head.appendChild(r);
    const d = document.createElement('button'); d.type = 'button'; d.className = 'btn sm danger'; d.textContent = 'Delete folder'; d.addEventListener('click', () => deleteFolder(own.id)); head.appendChild(d);
  }

  grid.innerHTML = '';
  if (view === 'shapes') {
    const n = document.createElement('button'); n.type = 'button'; n.className = 'bcard bnew';
    n.innerHTML = '<span class="bthumb"><svg><use href="#i-pencil-simple"/></svg></span><span class="bname">New shape</span><span class="bdate">Draw your own piece</span>';
    n.addEventListener('click', () => { hide(); window.SpeiraShapes.open(); }); grid.appendChild(n);
  } else if (view !== 'trash') {
    const n = document.createElement('button'); n.type = 'button'; n.className = 'bcard bnew';
    n.innerHTML = '<span class="bthumb"><svg><use href="#i-plus"/></svg></span><span class="bname">New canvas</span><span class="bdate">A fresh sheet</span>';
    n.addEventListener('click', () => newCanvas(view)); grid.appendChild(n);
  }
  if (!list.length && view === 'trash') grid.innerHTML = '<p class="bempty">Nothing here. Drawings you delete wait here for 30 days in case you change your mind.</p>';
  for (const r of list) {
    const c = document.createElement('div'); c.className = 'bcard' + (r.id === L.doc.id ? ' open' : '');
    c.innerHTML = `<button type="button" class="bthumb" aria-label="${r.kind === 'shape' ? 'Use' : 'Open'} ${esc(r.name)}"><img alt="" src="${r.thumb}"></button>
      <span class="bname">${esc(r.name)}</span>
      <span class="bdate">${view === 'trash' ? `Deleted ${stampOf(r.deletedAt)} · ${daysLeft(r)} days left` : r.kind === 'shape' ? `${r.shape.teeth} teeth${r.shape.inner ? ` · ${r.shape.teeth - 24} inside` : ''}` : (r.id === L.doc.id ? 'Open now · ' : '') + 'Saved ' + stampOf(r.modified)}</span>
      <button type="button" class="ico bmore" aria-label="More for ${esc(r.name)}"><svg><use href="#i-dots-three"/></svg></button>`;
    const opts = view === 'trash'
      ? [['Put back', () => restore(r.id)], ['Delete now', () => deleteNow(r.id), true]]
      : r.kind === 'shape'
      ? [['Use it', () => openRec(r.id)], ['Rename', () => startRename(c.querySelector('.bname'), r.name, n => rename(r.id, n))], ['Duplicate', () => duplicate(r.id)], ['Delete', () => trash(r.id), true]]
      : [['Open', () => openRec(r.id)], ['Rename', () => startRename(c.querySelector('.bname'), r.name, n => rename(r.id, n))], ['Duplicate', () => duplicate(r.id)],
         ...allFolders().filter(f => f.id !== r.folder && f.id !== 'shapes').map(f => [`Move to ${f.name}`, () => move(r.id, f.id)]),
         ['Save as file', () => saveFile(r.id)], ['Delete', () => trash(r.id), true]];
    c.querySelector('.bthumb').addEventListener('click', () => view === 'trash' ? menu({ currentTarget: c.querySelector('.bmore') }, opts) : openRec(r.id));
    c.querySelector('.bmore').addEventListener('click', e => menu(e, opts));
    c.addEventListener('contextmenu', e => { e.preventDefault(); menu(e, opts); });
    if (view !== 'trash') c.querySelector('.bname').addEventListener('dblclick', () => startRename(c.querySelector('.bname'), r.name, n => rename(r.id, n)));
    grid.appendChild(c);
  }
}
// a little menu next to whatever was clicked
const menuEl = $('#bookMenu');
function menu(e, opts) {
  menuEl.innerHTML = '';
  for (const [label, fn, danger] of opts) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (danger) b.className = 'danger'; b.addEventListener('click', () => { closeMenu(); fn(); }); menuEl.appendChild(b); }
  const at = e.clientX != null ? { x: e.clientX, y: e.clientY } : (() => { const r = e.currentTarget.getBoundingClientRect(); return { x: r.right, y: r.bottom }; })();
  menuEl.hidden = false;
  const w = menuEl.offsetWidth, h = menuEl.offsetHeight;
  menuEl.style.left = Math.min(at.x, innerWidth - w - 8) + 'px'; menuEl.style.top = Math.min(at.y, innerHeight - h - 8) + 'px';
  menuEl.querySelector('button').focus();
}
function closeMenu() { menuEl.hidden = true; }
document.addEventListener('pointerdown', e => { if (!menuEl.hidden && !menuEl.contains(e.target)) closeMenu(); }, true);
// rename in place: the name becomes a text box; Enter keeps it, Esc cancels
function startRename(el, value, done) {
  if (!el) return;
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'brename'; inp.value = value; inp.setAttribute('aria-label', 'New name');
  el.replaceWith(inp); inp.focus(); inp.select();
  let over = false;
  const finish = ok => { if (over) return; over = true; ok && inp.value.trim() && inp.value.trim() !== value ? done(inp.value) : render(); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
}

$('#bookClose').addEventListener('click', hide);
$('#bookNewFolder').addEventListener('click', newFolder);
$('#bookOpenFile').addEventListener('click', () => fileIn.click());
$('#bookSaveFile').addEventListener('click', () => saveFile());
root.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' && $('#bookAsk').hidden) { if (!menuEl.hidden) closeMenu(); else hide(); } });
$('#bookBtn').addEventListener('click', () => show());
$('#saveBtn').addEventListener('click', () => save());
// the drawing's name in the header: click to rename it
$('#docName').addEventListener('click', () => {
  const n = $('#docName'), inp = document.createElement('input'); inp.type = 'text'; inp.className = 'brename docrename'; inp.value = L.doc.name; inp.setAttribute('aria-label', 'Drawing name');
  n.hidden = true; n.after(inp); inp.focus(); inp.select();
  let over = false;
  const finish = ok => { if (over) return; over = true; const v = inp.value.trim(); inp.remove(); n.hidden = false; if (ok && v && v !== L.doc.name) { if (L.doc.id) rename(L.doc.id, v); else L.renameDoc(v); } };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
});

window.SpeiraBook = { show, hide, save, saveNew, newCanvas, shapes, saveShape, info: id => items.get(id), ready: (async () => { db = await idb(); try { await loadAll(); } catch { db = null; await loadAll(); } await purgeOld(); L.renderMyShapes(); })() };
})();
