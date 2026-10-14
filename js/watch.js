// Just watch: Speira composes and draws by itself, full screen, forever.
// Up to six layers build up; after that the oldest fades out while each new one draws.
// Proving ground for the Apple TV app. It never touches the drawing in the main app.
(() => {
const $ = s => document.querySelector(s);
const root = $('#watch'), cv = $('#watchCv'), ctx = cv.getContext('2d'), bar = $('#wbar');

// palettes that glow on black; "auto" moves to the next mood every six layers
const MOODS = {
  aurora: ['#7cffcb', '#4cc9f0', '#4361ee', '#b5179e', '#f72585', '#ffd166'],
  ember: ['#ffb703', '#fb8500', '#ff5d73', '#e63946', '#ffd6a5', '#f4a261'],
  ocean: ['#48cae4', '#00b4d8', '#90e0ef', '#4361ee', '#80ffdb', '#caf0f8'],
  neon: ['#39ff14', '#ff2e97', '#00f0ff', '#ffe600', '#b026ff', '#ff6b00'],
  metallic: ['#e0b354', '#c8d1dc', '#e8a0a0', '#d9824b', '#b08d57', '#f2d8a7']
};
const MOOD_KEYS = Object.keys(MOODS);
const SPEEDS = { calm: 65, normal: 110, lively: 190 };          // pen travel, world units per second
// only pens that read on black (felt, highlighter and pencil blend into dark paper)
const PEN_MIX = [['gel', 30], ['fineliner', 14], ['metallic', 22], ['glitter', 16], ['ballpoint', 18]];
const MOOD_EVERY = 6, FADE_S = 10, DENSE = 30, CX = 500, CY = 500, REACH = 420, SLEEP_FADE_MS = 60000;

const KEY = 'speira-watch-v1';
const prefs = { speed: 'normal', mood: 'auto', vol: .35, muted: false, rainbow: false, pieces: false, layers: '6' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };

let on = false, fsOn = 0, paused = false, raf = 0, last = 0, clock = 0;
let dpr = 1, k = 1, ox = 0, oy = 0;
const mk = () => document.createElement('canvas');
let base = mk(), next = null;                 // base: finished layers (except one fading out)
const fadeCv = mk(), live = mk();             // fadeCv: the layer fading out; live: the layer being drawn
let finished = [], cur = null, fading = null, jobs = [];
let layerNo = 0, moodIdx = 0, moodKey = MOOD_KEYS[0];
let drag = null, coast = 0, handUntil = 0, sleepAt = 0, sleepMin = 0, sleeping = false;
const ring = SpiroLab.ringCache();   // the pieces' ring, cached like on the main paper

// Every session has a code: the seed of its own random numbers, so a lovely run can be replayed
// (with the same colour setting) or shared. Codes use letters and digits that can't be misread.
const ABC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const toCode = n => { let c = ''; for (let i = 0; i < 6; i++) { c = ABC[n & 31] + c; n >>>= 5; } return c; };
const fromCode = c => { c = c.trim().toUpperCase(); if (!/^[2-9A-HJ-NP-Z]{6}$/.test(c)) return null; let n = 0; for (const ch of c) n = n * 32 + ABC.indexOf(ch); return n >>> 0; };
let seed = 0, rng = Math.random;
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = (a, b) => a + rng() * (b - a);
const pickW = list => { let t = list.reduce((s, x) => s + x[1], 0) * rng(); for (const [v, w] of list) if ((t -= w) <= 0) return v; return list[0][0]; };
const ease = f => f < .5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
const worldT = c => c.setTransform(k, 0, 0, k, ox, oy);

// ---------- composing a layer ----------
function compose() {
  if (prefs.mood === 'auto') { if (layerNo % MOOD_EVERY === 0 && layerNo) moodKey = MOOD_KEYS[++moodIdx % MOOD_KEYS.length]; }
  else moodKey = prefs.mood;
  const pal = MOODS[moodKey];
  for (let tries = 0; tries < 400; tries++) {
    const ringNo = rng() < .5 ? 0 : 1, outside = rng() < .35, wheel = WHEELS[Math.floor(rng() * WHEELS.length)];
    const holes = holesFor(wheel, 16), T = outside ? RINGS[ringNo].outer : RINGS[ringNo].inner;
    const L = { id: 90000 + layerNo, ring: ringNo, mode: outside ? 'outside' : 'inside', wheel, hole: Math.floor(rng() * holes.length),
      shift: Math.floor(rng() * T), pitch: 16, cx: CX, cy: CY, opacity: 1 };
    // every size scales with the kit size (pitch), so pick the kit size that makes this pattern fill the screen nicely:
    // that lets the big wheel-outside-the-ring patterns in as well as the ones inside
    // with the pieces showing, size it so the whole ring and wheel fit on screen too
    const g16 = geom(L), target = rnd(.62, 1) * REACH;
    const extent = prefs.pieces ? Math.max(g16.c + g16.d, g16.c + g16.rr + 8, radiusOf(RINGS[ringNo].outer, 16) + 8) : g16.c + g16.d;
    L.pitch = 16 * target / extent;
    const G = geom(L);
    if (G.petals < 5 || G.petals > 80 || G.d < G.rr * .25) continue;
    // only one dense (many-petal) layer on screen at a time, or the picture turns to mush
    if (G.petals > DENSE && finished.some(f => f.G.petals > DENSE)) continue;
    // at least half a minute per layer; dense patterns (many laps) are welcome but draw a little faster,
    // so none takes much more than two and a half minutes at normal speed
    const len = G.total * (G.c + G.d * Math.abs(G.ratio)), dur = len / SPEEDS.normal;
    if (dur < 25 || G.laps > 30) continue;
    const boost = Math.max(1, dur / 150);
    const pen = moodKey === 'metallic' ? 'metallic' : pickW(PEN_MIX), rainbowLuck = rng() < .12;
    Object.assign(L, { pen, color: pal[layerNo % pal.length], rainbow: prefs.rainbow || (moodKey !== 'metallic' && rainbowLuck), width: PEN_STYLES[pen].w * 1.3 });
    const t = trace(L), xy = Array.from(t.pts); xy.push(t.pts[0], t.pts[1]);   // closed: point N repeats point 0
    layerNo++;
    return { L, G, N: t.N, plan: buildPlan(L, xy, false, t.N / G.laps), th: 0, drawn: 0, age: 0, boost, lucky: rainbowLuck && moodKey !== 'metallic' };
  }
  return null;
}

// ---------- drawing ----------
function drawFull(c, lay) { c.save(); worldT(c); drawPlan(c, lay.plan, lay.L.opacity); c.restore(); }
// draw only points i0..i1 of a layer (shared with the video export: drawPlanRange in pens.js)
function drawRange(c, lay, i0, i1) { c.save(); worldT(c); drawPlanRange(c, lay.plan, lay.L.opacity, i0, i1); c.restore(); }
function drawStars(c, lay) { c.save(); worldT(c); drawPlanStars(c, lay.plan, 1); c.restore(); }
const clear = c => { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); };
const runJobs = () => { while (jobs.length) jobs.shift()(); };

function size() {
  runJobs();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  for (const c of [base, fadeCv, live]) { c.width = cv.width; c.height = cv.height; }
  k = Math.min(cv.width, cv.height) * .47 / REACH; ox = cv.width / 2 - CX * k; oy = cv.height / 2 - CY * k;
  const b = base.getContext('2d'); for (const f of finished) drawFull(b, f);
  if (fading) for (const o of fading.layers) drawFull(fadeCv.getContext('2d'), o);
  if (cur) { for (const o of cur.plan.ops) o._r = 0; drawRange(live.getContext('2d'), cur, 0, cur.drawn); }
}

// ---------- the life of a layer ----------
function startLayer() {
  cur = compose(); if (!cur) return;
  runJobs();
  // at most `layers` on screen, counting the one being drawn: the oldest starts fading as a new one begins
  // (several at once if the Layers setting was just lowered)
  const keep = +prefs.layers - 1;
  if (finished.length > keep) {
    // skipping or rolling fast can outrun a fade: finish the one in progress at once
    if (fading) { fading = null; clear(fadeCv); }
    // rebuild the finished stack without the oldest, one layer per frame so nothing stutters, then fade them out
    const olds = finished.slice(0, finished.length - keep), rest = finished.slice(finished.length - keep);
    next = mk(); next.width = cv.width; next.height = cv.height;
    jobs.push(() => { clear(fadeCv); for (const o of olds) drawFull(fadeCv.getContext('2d'), o); });
    for (const f of rest) jobs.push(() => drawFull(next.getContext('2d'), f));
    jobs.push(() => { base = next; next = null; finished = rest; fading = { layers: olds, start: clock }; });
  }
}
function finishLayer() {
  runJobs();
  drawRange(live.getContext('2d'), cur, cur.drawn, cur.N); drawStars(live.getContext('2d'), cur);
  const b = base.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.drawImage(live, 0, 0); clear(live);
  for (const o of cur.plan.ops) o._r = 0;
  finished.push(cur); cur = null;
}
function advance(d) {
  if (!cur || d <= 0) return;
  const G = cur.G, before = Math.floor(cur.th * G.T / TAU);
  cur.th = Math.min(G.total, cur.th + d);
  if (Math.floor(cur.th * G.T / TAU) !== before) tick();
  const idx = Math.min(cur.N, Math.floor(cur.th / G.total * cur.N));
  if (idx > cur.drawn) { drawRange(live.getContext('2d'), cur, cur.drawn, idx); cur.drawn = idx; }
  if (cur.th >= G.total) finishLayer();
}
function step(dt) {
  clock += dt;
  if (!cur) startLayer();
  if (!cur) return;
  cur.age += dt;
  if (drag) return;
  if (coast > 0) { advance(coast * dt); coast *= Math.exp(-1.6 * dt); if (coast < .03) coast = 0; return; }
  if (clock < handUntil) return;
  const G = cur.G, rate = SPEEDS[prefs.speed] / (G.c + G.d * Math.abs(G.ratio));
  advance(rate * cur.boost * Math.min(1, cur.age / 2.5) * dt);
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (jobs.length) jobs.shift()();
  if (!paused) step(dt);
  // a very slow drift, so nothing sits still on an OLED for long (whole pixels, so the pieces' cache holds)
  const t = now / 1000, dx = Math.round(Math.sin(t / 83) * 10 * dpr), dy = Math.round(Math.cos(t / 127) * 10 * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (sleeping) return;
  if (fading) {
    const f = (clock - fading.start) / FADE_S;
    if (f >= 1) { fading = null; clear(fadeCv); }
    else { ctx.globalAlpha = 1 - ease(f); ctx.drawImage(fadeCv, dx, dy); ctx.globalAlpha = 1; }
  }
  ctx.drawImage(base, dx, dy); ctx.drawImage(live, dx, dy);
  if (prefs.pieces && cur) SpiroLab.drawPieces(ctx, { ...cur.L, pos: cur.th }, { s: k, ox: ox + dx, oy: oy + dy, dpr }, ring);
  // bedtime: when the timer runs out, the picture and the clicks fade to black over a minute, then it rests
  dim = 0;
  if (sleepAt && now > sleepAt) {
    dim = Math.min(1, (now - sleepAt) / SLEEP_FADE_MS);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = ease(dim); ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1;
    if (dim >= 1) { sleeping = true; setPaused(true, true); }
  }
}

// ---------- sound: gentle tooth clicks, never more than ~12 a second ----------
let actx = null, lastTick = 0, dim = 0;
function tick() {
  if (!actx || prefs.muted || prefs.vol <= 0) return;
  const now = actx.currentTime; if (now - lastTick < .085) return; lastTick = now;
  const n = Math.floor(actx.sampleRate * .028), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * .16));
  const src = actx.createBufferSource(), bp = actx.createBiquadFilter(), lp = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 450; bp.Q.value = 2.5;
  lp.type = 'lowpass'; lp.frequency.value = 3200; g.gain.value = prefs.vol * .3 * (1 - dim);
  src.connect(bp).connect(lp).connect(g).connect(actx.destination); src.start(now);
}

// ---------- rolling it yourself: drag in circles; let go and it carries on alone ----------
const angleAt = e => Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2);
cv.addEventListener('pointerdown', e => {
  if (paused) return;
  try { cv.setPointerCapture(e.pointerId); } catch {}
  drag = { last: angleAt(e), samples: [] }; coast = 0;
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const a = angleAt(e); let d = a - drag.last; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; drag.last = a;
  const t = performance.now(); drag.samples.push([t, d]); while (drag.samples.length && t - drag.samples[0][0] > 90) drag.samples.shift();
  if (!cur) startLayer();
  advance(d);   // forwards only: backwards turns are ignored
});
const endDrag = () => {
  if (!drag) return;
  const s = drag.samples, span = s.length > 1 ? (s[s.length - 1][0] - s[0][0]) / 1000 : 0, v = span > .01 ? s.reduce((a, q) => a + q[1], 0) / span : 0;
  coast = v > .4 ? Math.min(v, 30) : 0; drag = null; handUntil = clock + 2.5;
};
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

// ---------- controls: appear when the mouse moves, fade away after a moment ----------
let awakeT;
function wake() {
  root.classList.add('awake'); clearTimeout(awakeT);
  awakeT = setTimeout(() => { if (!bar.matches(':hover')) root.classList.remove('awake'); else wake(); }, 2600);
}
root.addEventListener('pointermove', wake); root.addEventListener('pointerdown', wake);
function group(sel, attr, keyName) {
  const btns = [...document.querySelectorAll(`${sel} [${attr}]`)];
  const sync = () => btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === prefs[keyName])));
  btns.forEach(b => b.addEventListener('click', () => { prefs[keyName] = b.getAttribute(attr); sync(); savePrefs(); if (keyName === 'mood' && prefs.mood !== 'auto') moodKey = prefs.mood; }));
  sync();
}
group('#wSpeed', 'data-speed', 'speed');
group('#wMood', 'data-mood', 'mood');
group('#wLayers', 'data-layers', 'layers');
const vol = $('#wVol'), muteBtn = $('#wMute'), pauseBtn = $('#wPause');
const syncSound = () => { vol.value = prefs.vol; vol.style.setProperty('--fill', prefs.vol * 100 + '%'); muteBtn.setAttribute('aria-pressed', String(prefs.muted)); muteBtn.setAttribute('aria-label', prefs.muted ? 'Unmute clicks' : 'Mute clicks'); };
vol.addEventListener('input', () => { prefs.vol = +vol.value; prefs.muted = false; syncSound(); savePrefs(); });
muteBtn.addEventListener('click', () => { prefs.muted = !prefs.muted; syncSound(); savePrefs(); });
const setPaused = (p, asleep = false) => {
  paused = p; pauseBtn.setAttribute('aria-pressed', String(p));
  pauseBtn.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause'); pauseBtn.setAttribute('aria-label', p ? 'Carry on' : 'Pause');
  if (!p && !asleep && (sleeping || sleepAt)) { sleeping = false; sleepAt = 0; sleepMin = 0; syncSleep(); }   // carrying on wakes it up
};
// toggles: rainbow ink on every layer (the one drawing now changes straight away) and the pieces
const toggle = (id, keyName, after) => {
  const b = $(id), sync = () => b.setAttribute('aria-pressed', String(prefs[keyName]));
  b.addEventListener('click', () => { prefs[keyName] = !prefs[keyName]; sync(); savePrefs(); after && after(); });
  sync(); return () => b.click();
};
const toggleRainbow = toggle('#wRainbow', 'rainbow', () => {
  if (!cur) return;
  cur.L.rainbow = prefs.rainbow || cur.lucky;
  cur.plan = buildPlan(cur.L, cur.plan.xy, false, cur.N / cur.G.laps);
  clear(live); drawRange(live.getContext('2d'), cur, 0, cur.drawn);
});
const togglePieces = toggle('#wPieces', 'pieces');
// bedtime fade: off, 30, 60 or 90 minutes
const sleepBtn = $('#wSleep');
function syncSleep() { sleepBtn.querySelector('span').textContent = sleepMin ? sleepMin + ' min' : 'Sleep off'; sleepBtn.setAttribute('aria-pressed', String(!!sleepMin)); }
sleepBtn.addEventListener('click', () => {
  sleepMin = [0, 30, 60, 90][([0, 30, 60, 90].indexOf(sleepMin) + 1) % 4];
  sleepAt = sleepMin ? performance.now() + sleepMin * 60000 : 0; sleeping = false; syncSleep();
  if (sleepMin) toast(`Fades to black in ${sleepMin} minutes`);
});
// a small message at the top
let toastT;
function toast(msg) { const t = $('#wToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
// keep: what's on screen becomes your drawing (finished layers plus the one drawing now)
// keep asks how: as a drawing of its own in the Sketchbook, or as new layers on top of the canvas you were drawing
const keepAsk = $('#wKeepAsk');
const keepList = () => [...finished, ...(cur && cur.drawn > 1 ? [cur] : [])].map(l => ({ ...l.L, a: 0, b: l.th }));
function keep() { if (!keepList().length) return; keepAsk.hidden = false; wake(); keepAsk.querySelector('button').focus(); }
async function keepAs(how) {
  keepAsk.hidden = true;
  const list = keepList(); if (!list.length) return;
  const n = `${list.length} layer${list.length > 1 ? 's' : ''}`;
  if (how === 'add') { SpiroLab.adoptAdd(list); toast(`Added ${n} to your canvas. ⌘Z there takes them off again.`); }
  else { const name = await SpeiraBook.saveNew(SpiroLab.watchDoc(list)); toast(`Saved ${n} as “${name}” in My drawings`); }
}
keepAsk.querySelectorAll('[data-keep]').forEach(b => b.addEventListener('click', () => b.dataset.keep === 'cancel' ? (keepAsk.hidden = true) : keepAs(b.dataset.keep)));
$('#wKeep').addEventListener('click', keep);
// session code: copy it, or type one and press Enter to replay it
const codeIn = $('#wCode');
function restart(s) {
  runJobs(); seed = s >>> 0; rng = mulberry(seed);
  finished = []; cur = null; fading = null; next = null; coast = 0; layerNo = 0;
  moodIdx = Math.floor(rng() * MOOD_KEYS.length); moodKey = prefs.mood === 'auto' ? MOOD_KEYS[moodIdx] : prefs.mood;
  for (const c of [base, fadeCv, live]) clear(c);
  codeIn.value = toCode(seed);
}
codeIn.addEventListener('keydown', e => {
  if (e.key === 'Enter') { const n = fromCode(codeIn.value); if (n == null) toast('A code is six letters and numbers, like K7F2Q9'); else { restart(n); toast('Replaying ' + toCode(n)); codeIn.blur(); } }
  if (e.key === 'Escape') { codeIn.value = toCode(seed); codeIn.blur(); }
});
$('#wCopy').addEventListener('click', () => {
  const c = toCode(seed);
  (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => toast('Code ' + c + ' copied'), () => toast('Code: ' + c));
});
pauseBtn.addEventListener('click', () => setPaused(!paused));
const skip = () => { if (!cur) startLayer(); if (cur) advance(cur.G.total); };
$('#wNext').addEventListener('click', skip);
$('#wExit').addEventListener('click', () => leave());
syncSound(); syncSleep();

// keys while watching never reach the drawing app
addEventListener('keydown', e => {
  if (!on || e.target === codeIn) return;   // typing a code: the drawing app ignores text fields anyway
  e.stopImmediatePropagation();
  if (e.metaKey || e.ctrlKey) return;
  const key = e.key.toLowerCase();
  if (e.key === ' ') { e.preventDefault(); setPaused(!paused); wake(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); skip(); }
  else if (key === 'm') { prefs.muted = !prefs.muted; syncSound(); savePrefs(); wake(); }
  else if (key === 'r') { toggleRainbow(); wake(); }
  else if (key === 'p') { togglePieces(); wake(); }
  else if (key === 'k') keep();
  else if (e.key === 'Escape' || e.key.toLowerCase() === 'w') { e.preventDefault(); leave(); }
}, true);

// ---------- entering and leaving ----------
function enter() {
  if (on) return;
  on = true; root.hidden = false; document.body.classList.add('watching');
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); else actx.resume(); } catch {}
  if (!finished.length && !cur) restart(Math.floor(Math.random() * 2 ** 30));
  size(); setPaused(false); last = performance.now(); raf = requestAnimationFrame(frame); wake();
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) try { const p = req.call(root); if (p && p.catch) p.catch(() => {}); } catch {}
}
function leave() {
  if (!on) return;
  on = false; cancelAnimationFrame(raf); drag = null; coast = 0;
  root.hidden = true; root.classList.remove('awake'); document.body.classList.remove('watching');
  if (actx) actx.suspend().catch(() => {});
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
}
const onFs = () => {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  // Esc out of full screen leaves too (ignoring a full screen the browser takes back straight away)
  if (fs === root) fsOn = performance.now(); else if (fsOn) { const held = performance.now() - fsOn; fsOn = 0; if (held > 400) leave(); }
};
document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
addEventListener('resize', () => { if (on) size(); });
$('#watchBtn').addEventListener('click', enter);

window.SpeiraWatch = { enter, leave, get state() { return { on, paused, layers: finished.length, fading: !!fading, cur: cur && { th: cur.th, total: cur.G.total, pen: cur.L.pen, mood: moodKey, mode: cur.L.mode, ring: cur.L.ring, wheel: cur.L.wheel, hole: cur.L.hole, petals: cur.G.petals, rainbow: cur.L.rainbow } }; }, restart: n => restart(n),
  // for testing: the first n recipes a code produces (then starts that code afresh)
  recipes(code, n) { restart(code); const out = []; for (let i = 0; i < n; i++) { const c = compose(); out.push(`${c.L.mode}-${RINGS[c.L.ring].inner}/${c.L.wheel} h${c.L.hole + 1} ${c.G.petals}p ${c.L.pen}${c.L.rainbow ? ' rainbow' : ''}`); } restart(code); return out; } };
})();
