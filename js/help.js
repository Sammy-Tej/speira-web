// The Help panel: sections down the side, everything readable on the right, a search box that narrows it down.
// The words live in help-content.js; this file only shows them.
(() => {
const $ = s => document.querySelector(s);
const root = $('#help'), nav = $('#helpNav'), body = $('#helpBody'), search = $('#helpSearch'), btn = $('#helpBtn');
let lastFocus = null;

// build once from the data
for (const sec of HELP) {
  const a = document.createElement('button'); a.type = 'button'; a.className = 'helpnav'; a.dataset.id = sec.id; a.textContent = sec.title;
  a.addEventListener('click', () => { const t = body.querySelector(`[data-sec="${sec.id}"]`); t.scrollIntoView({ block: 'start', behavior: 'smooth' }); mark(sec.id); });
  nav.appendChild(a);
  const s = document.createElement('section'); s.className = 'helpsec'; s.dataset.sec = sec.id;
  s.innerHTML = `<h3>${sec.title}</h3><p class="helpsum">${sec.summary}</p>` +
    sec.items.map(([h, t]) => `<div class="helpitem"><h4>${h}</h4><p>${t}</p></div>`).join('');
  body.appendChild(s);
}
const mark = id => nav.querySelectorAll('.helpnav').forEach(b => b.setAttribute('aria-current', String(b.dataset.id === id)));
// highlight the section you're reading
body.addEventListener('scroll', () => {
  const top = body.getBoundingClientRect().top + 40;
  let cur = HELP[0].id; for (const s of body.querySelectorAll('.helpsec:not([hidden])')) if (s.getBoundingClientRect().top <= top) cur = s.dataset.sec;
  mark(cur);
});

// search: keep the items that mention every word you typed
search.addEventListener('input', () => {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
  let any = false;
  for (const s of body.querySelectorAll('.helpsec')) {
    let shown = 0;
    for (const it of s.querySelectorAll('.helpitem')) {
      const text = (s.querySelector('h3').textContent + ' ' + it.textContent).toLowerCase(), ok = words.every(w => text.includes(w));
      it.hidden = !ok; if (ok) shown++;
    }
    s.hidden = !shown; nav.querySelector(`[data-id="${s.dataset.sec}"]`).hidden = !shown; if (shown) any = true;
  }
  $('#helpNone').hidden = any;
});

function open() {
  if (!root.hidden) return;
  lastFocus = document.activeElement; root.hidden = false; btn.setAttribute('aria-expanded', 'true');
  mark(HELP[0].id); setTimeout(() => search.focus(), 0);
}
function close() {
  root.hidden = true; btn.setAttribute('aria-expanded', 'false');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
btn.addEventListener('click', () => root.hidden ? open() : close());
$('#helpClose').addEventListener('click', close);
root.addEventListener('pointerdown', e => { if (e.target === root) close(); });   // click outside the panel
// keys typed in Help stay in Help (so Space doesn't start drawing); Esc closes
root.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } });

window.SpeiraHelp = { open, close };
})();
