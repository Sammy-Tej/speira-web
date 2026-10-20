// Unwind: Speira composes and draws by itself, full screen, forever.
// Up to six layers build up; after that the oldest fades out while each new one draws.
// Every visit starts fresh. Pressing Unwind with a drawing on the canvas asks whether to bring it along: its layers
// then sit underneath and never fade. Leaving asks whether to keep what Speira drew. With "Two at once", two
// patterns grow side by side and never overlap. Proving ground for the Apple TV app.
(() => {
const $ = s => document.querySelector(s);
const root = $('#watch'), cv = $('#watchCv'), ctx = cv.getContext('2d'), bar = $('#wbar');

// palettes that glow on black; "auto" moves to the next mood every six layers
const MOODS = {
  aurora: ['#7cffcb', '#4cc9f0', '#4361ee', '#b5179e', '#f72585', '#ffd166'],
  ember: ['#ffb703', '#fb8500', '#ff5d73', '#e63946', '#ffd6a5', '#f4a261'],
  ocean: ['#48cae4', '#00b4d8', '#90e0ef', '#4361ee', '#80ffdb', '#caf0f8'],
  neon: ['#39ff14', '#ff2e97', '#00f0ff', '#ffe600', '#b026ff', '#ff6b00'],
  metallic: ['#e0b354', '#c8d1dc', '#e8a0a0', '#d9824b', '#b08d57', '#f2d8a7'],
  // from Sam's Style palette (the kaleidoscope reference images)
  kaleido: ['#6FE5EA', '#D03020', '#D1CE77', '#9537D1', '#AB7554', '#66BD77'],
  jewels: ['#9537D1', '#AD318A', '#6FE5EA', '#D1CE77', '#702F79', '#45879D'],
  earth: ['#AB7554', '#D1CE77', '#9C793C', '#CFC4A7', '#9C965B', '#724933']
};
const MOOD_KEYS = Object.keys(MOODS);   // "My pens" (the colours in your drawing) is chosen, never part of Auto
const SPEEDS = { calm: 65, normal: 110, lively: 190 };          // pen travel, world units per second
// only pens that read on black (felt, highlighter and pencil blend into dark paper)
const PEN_MIX = [['gel', 30], ['fineliner', 14], ['metallic', 22], ['glitter', 16], ['ballpoint', 18]];
const MOOD_EVERY = 6, FADE_S = 10, DENSE = 30, CX = 500, CY = 500, REACH = 420, SLEEP_FADE_MS = 60000;

const KEY = 'speira-watch-v1';
const prefs = { speed: 'normal', mood: 'auto', vol: .35, muted: false, rainbow: false, pieces: false, layers: '6', two: false, paper: 'black' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };

let on = false, fsOn = 0, paused = false, raf = 0, last = 0, clock = 0;
let dpr = 1, k = 1, ox = 0, oy = 0, hx = 500, hy = 500;
const mk = () => document.createElement('canvas');
let base = mk(), next = null;                 // base: your drawing (if brought along) and finished layers, except one fading out
const fadeCv = mk(), lives = [mk(), mk()];    // fadeCv: the layer fading out; lives: one per pattern being drawn
let finished = [], slots = [null], fading = null, jobs = [];
let layerNo = 0, moodIdx = 0, moodKey = MOOD_KEYS[0];
let drag = null, coast = 0, handUntil = 0, sleepAt = 0, sleepMin = 0, sleeping = false;
// your drawing, when Unwind was started with "Use my drawing": its layers, its paper size and how it is scaled to fit
let mine = null;
// with your drawing brought along, Unwind switches to its paper colour and its pens for that visit (your saved choices stay)
let ov = {};
const pref = k => ov[k] ?? prefs[k];
// the paper: black (best for OLED TVs, nothing bright for hours) or your drawing's paper colour
const paperCol = () => pref('paper') === 'mine' ? SpiroLab.paperColour() : '#000000';
// the colours in your drawing (and your current pen), for the My pens mood
function myPens() {
  const seen = new Set([...SpiroLab.inkForWatch().layers.map(l => l.color), SpiroLab.S.color].map(c => c.toLowerCase()));
  return [...seen];
}
// a colour that shows on the paper: if a mood colour is too close to the paper, a darker or lighter version of it
function shows(col) {
  const bg = paperCol(), lum = c => luminance(c), d = Math.abs(lum(col) - lum(bg));
  if (d > .28) return col;
  return mixHex(col, lum(bg) > .5 ? '#000000' : '#ffffff', .45);
}
const rings = [SpiroLab.ringCache(), SpiroLab.ringCache()];   // the pieces' rings, cached like on the main paper

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
const active = () => slots.filter(Boolean);

// Where the patterns go: one in the middle, or with "Two at once" two side by side along the screen's long side,
// each small enough that they can never touch
function layout() {
  if (!prefs.two) return [{ cx: CX, cy: CY, reach: REACH }];
  const wide = hx >= hy, along = wide ? hx : hy, across = wide ? hy : hx, d = along / 2, reach = Math.min(across * .9, d * .9);
  return wide ? [{ cx: CX - d, cy: CY, reach }, { cx: CX + d, cy: CY, reach }] : [{ cx: CX, cy: CY - d, reach }, { cx: CX, cy: CY + d, reach }];
}

// ---------- composing a layer ----------
function compose(spot) {
  if (pref('mood') === 'auto') { if (layerNo % MOOD_EVERY === 0 && layerNo) moodKey = MOOD_KEYS[++moodIdx % MOOD_KEYS.length]; }
  else moodKey = pref('mood');
  const pal = moodKey === 'mypens' ? myPens() : MOODS[moodKey], small = spot.reach / REACH, light = luminance(paperCol()) > .5;
  for (let tries = 0; tries < 400; tries++) {
    const ringNo = rng() < .5 ? 0 : 1, outside = rng() < .35, wheel = WHEELS[Math.floor(rng() * WHEELS.length)];
    const holes = holesFor(wheel, 16), T = outside ? RINGS[ringNo].outer : RINGS[ringNo].inner;
    const L = { id: 90000 + layerNo, ring: ringNo, mode: outside ? 'outside' : 'inside', wheel, hole: Math.floor(rng() * holes.length),
      shift: Math.floor(rng() * T), pitch: 16, cx: spot.cx, cy: spot.cy, opacity: 1 };
    // every size scales with the kit size (pitch), so pick the kit size that makes this pattern fill its space nicely:
    // that lets the big wheel-outside-the-ring patterns in as well as the ones inside
    // with the pieces showing, size it so the whole ring and wheel fit too
    const g16 = geom(L), target = rnd(.62, 1) * spot.reach;
    const extent = prefs.pieces ? Math.max(g16.c + g16.d, g16.c + g16.rr + 8, radiusOf(RINGS[ringNo].outer, 16) + 8) : g16.c + g16.d;
    L.pitch = 16 * target / extent;
    const G = geom(L);
    if (G.petals < 5 || G.petals > 80 || G.d < G.rr * .25) continue;
    // only one dense (many-petal) layer on screen at a time, or the picture turns to mush
    if (G.petals > DENSE && [...finished, ...active()].some(f => f.G.petals > DENSE)) continue;
    // at least half a minute per layer; dense patterns (many laps) are welcome but draw a little faster,
    // so none takes much more than two and a half minutes at normal speed
    const len = G.total * (G.c + G.d * Math.abs(G.ratio)), dur = len / SPEEDS.normal;
    if (dur < 25 * small || G.laps > 30) continue;
    const boost = Math.max(1, dur / (150 * small));
    const pen = moodKey === 'metallic' ? 'metallic' : pickW(PEN_MIX), rainbowLuck = rng() < .12;
    Object.assign(L, { pen, color: shows(pal[layerNo % pal.length]), rainbow: prefs.rainbow || (moodKey !== 'metallic' && rainbowLuck), width: PEN_STYLES[pen].w * 1.3 });
    const t = trace(L), xy = Array.from(t.pts); xy.push(t.pts[0], t.pts[1]);   // closed: point N repeats point 0
    layerNo++;
    return { L, G, N: t.N, plan: buildPlan(L, xy, light, t.N / G.laps), th: 0, drawn: 0, age: 0, boost, lucky: rainbowLuck && moodKey !== 'metallic' };
  }
  return null;
}

// ---------- drawing ----------
function drawFull(c, lay) { c.save(); worldT(c); drawPlan(c, lay.plan, lay.L.opacity); c.restore(); }
// draw only points i0..i1 of a layer (shared with the video export: drawPlanRange in pens.js)
function drawRange(c, lay, i0, i1) { c.save(); worldT(c); drawPlanRange(c, lay.plan, lay.L.opacity, i0, i1); c.restore(); }
function drawStars(c, lay) { c.save(); worldT(c); drawPlanStars(c, lay.plan, 1); c.restore(); }
// your own drawing, scaled from its paper to fit the screen, centred
function drawMine(c) {
  if (!mine) return;
  const s = k * mine.sc;
  for (const m of mine.list) { c.save(); c.setTransform(s, 0, 0, s, ox + (CX - mine.W / 2 * mine.sc) * k, oy + (CY - mine.H / 2 * mine.sc) * k); drawPlan(c, m.plan, m.L.opacity); c.restore(); }
}
const clear = c => { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); };
const runJobs = () => { while (jobs.length) jobs.shift()(); };

function size() {
  runJobs();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  for (const c of [base, fadeCv, ...lives]) { c.width = cv.width; c.height = cv.height; }
  k = Math.min(cv.width, cv.height) * .47 / REACH; ox = cv.width / 2 - CX * k; oy = cv.height / 2 - CY * k;
  hx = cv.width / 2 / k; hy = cv.height / 2 / k;
  const b = base.getContext('2d'); drawMine(b); for (const f of finished) drawFull(b, f);
  if (fading) for (const o of fading.layers) drawFull(fadeCv.getContext('2d'), o);
  slots.forEach((s, i) => { if (s) { for (const o of s.plan.ops) o._r = 0; drawRange(lives[i].getContext('2d'), s, 0, s.drawn); } });
}

// ---------- the life of a layer ----------
function startLayer(i) {
  const spot = layout()[i]; if (!spot) return;
  slots[i] = compose(spot); if (!slots[i]) return;
  runJobs();
  // at most `layers` on screen, counting the ones being drawn: the oldest starts fading as a new one begins
  // (several at once if the Layers setting was just lowered). Your own drawing never counts and never fades.
  const keep = Math.max(0, +prefs.layers - active().length);
  if (finished.length > keep) {
    // skipping or rolling fast can outrun a fade: finish the one in progress at once
    if (fading) { fading = null; clear(fadeCv); }
    // rebuild the finished stack without the oldest, one layer per frame so nothing stutters, then fade them out
    const olds = finished.slice(0, finished.length - keep), rest = finished.slice(finished.length - keep);
    next = mk(); next.width = cv.width; next.height = cv.height;
    jobs.push(() => { clear(fadeCv); for (const o of olds) drawFull(fadeCv.getContext('2d'), o); });
    jobs.push(() => drawMine(next.getContext('2d')));
    for (const f of rest) jobs.push(() => drawFull(next.getContext('2d'), f));
    jobs.push(() => { base = next; next = null; finished = rest; fading = { layers: olds, start: clock }; });
  }
}
function finishLayer(i) {
  runJobs();
  const s = slots[i], live = lives[i];
  drawRange(live.getContext('2d'), s, s.drawn, s.N); drawStars(live.getContext('2d'), s);
  const b = base.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.drawImage(live, 0, 0); clear(live);
  for (const o of s.plan.ops) o._r = 0;
  finished.push(s); slots[i] = null;
}
function advance(i, d) {
  const s = slots[i];
  if (!s || d <= 0) return;
  const G = s.G, before = Math.floor(s.th * G.T / TAU);
  s.th = Math.min(G.total, s.th + d);
  if (Math.floor(s.th * G.T / TAU) !== before) tick();
  const idx = Math.min(s.N, Math.floor(s.th / G.total * s.N));
  if (idx > s.drawn) { drawRange(lives[i].getContext('2d'), s, s.drawn, idx); s.drawn = idx; }
  if (s.th >= G.total) finishLayer(i);
}
const advanceAll = d => slots.forEach((_, i) => advance(i, d));
// one slot per pattern: turning "Two at once" off lets the second one finish, then no new one starts there
function fillSlots() {
  const want = layout().length;
  for (let i = 0; i < want; i++) if (!slots[i]) startLayer(i);
  if (slots.length < want) slots.length = want;
}
function step(dt) {
  clock += dt;
  fillSlots();
  if (!active().length) return;
  for (const s of active()) s.age += dt;
  if (drag) return;
  if (coast > 0) { advanceAll(coast * dt); coast *= Math.exp(-1.6 * dt); if (coast < .03) coast = 0; return; }
  if (clock < handUntil) return;
  slots.forEach((s, i) => {
    if (!s) return;
    const G = s.G, rate = SPEEDS[prefs.speed] / (G.c + G.d * Math.abs(G.ratio));
    advance(i, rate * s.boost * Math.min(1, s.age / 2.5) * dt);
  });
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (jobs.length) jobs.shift()();
  if (!paused && !asking) step(dt);
  // a very slow drift, so nothing sits still on an OLED for long (whole pixels, so the pieces' cache holds)
  const t = now / 1000, dx = Math.round(Math.sin(t / 83) * 10 * dpr), dy = Math.round(Math.cos(t / 127) * 10 * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = paperCol(); ctx.fillRect(0, 0, cv.width, cv.height);
  if (sleeping) return;
  if (fading) {
    const f = (clock - fading.start) / FADE_S;
    if (f >= 1) { fading = null; clear(fadeCv); }
    else { ctx.globalAlpha = 1 - ease(f); ctx.drawImage(fadeCv, dx, dy); ctx.globalAlpha = 1; }
  }
  ctx.drawImage(base, dx, dy); for (const l of lives) ctx.drawImage(l, dx, dy);
  if (prefs.pieces) slots.forEach((s, i) => { if (s) SpiroLab.drawPieces(ctx, { ...s.L, pos: s.th }, { s: k, ox: ox + dx, oy: oy + dy, dpr }, rings[i]); });
  // bedtime: when the timer runs out, the picture and the clicks fade to black over a minute, then it rests
  dim = 0;
  if (sleepAt && now > sleepAt) {
    dim = Math.min(1, (now - sleepAt) / SLEEP_FADE_MS);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = ease(dim); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1;
    if (dim >= 1) { sleeping = true; setPaused(true, true); quietKeep(); }
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

// ---------- rolling it yourself: drag in circles (both patterns turn together); let go and it carries on alone ----------
const angleAt = e => Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2);
cv.addEventListener('pointerdown', e => {
  if (paused || asking) return;
  try { cv.setPointerCapture(e.pointerId); } catch {}
  drag = { last: angleAt(e), samples: [] }; coast = 0;
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const a = angleAt(e); let d = a - drag.last; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; drag.last = a;
  const t = performance.now(); drag.samples.push([t, d]); while (drag.samples.length && t - drag.samples[0][0] > 90) drag.samples.shift();
  fillSlots();
  advanceAll(d);   // forwards only: backwards turns are ignored
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
  awakeT = setTimeout(() => { if (!bar.matches(':hover') && !asking) root.classList.remove('awake'); else wake(); }, 2600);
}
root.addEventListener('pointermove', wake); root.addEventListener('pointerdown', wake);
function group(sel, attr, keyName) {
  const btns = [...document.querySelectorAll(`${sel} [${attr}]`)];
  const sync = () => btns.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === pref(keyName))));
  btns.forEach(b => b.addEventListener('click', () => {
    prefs[keyName] = b.getAttribute(attr); delete ov[keyName]; sync(); savePrefs();
    if (keyName === 'mood' && prefs.mood !== 'auto') moodKey = prefs.mood;
    if (keyName === 'paper') repaintLive();
  }));
  sync(); syncs.push(sync);
}
const syncs = [];
group('#wSpeed', 'data-speed', 'speed');
group('#wMood', 'data-mood', 'mood');
group('#wLayers', 'data-layers', 'layers');
group('#wPaper', 'data-paper', 'paper');
const syncAll = () => syncs.forEach(f => f());
// a new paper colour: the line being drawn is redrawn so its ink suits the paper (finished layers keep theirs)
function repaintLive() { slots.forEach((s, i) => { if (!s) return; s.L.color = shows(s.L.color); s.plan = buildPlan(s.L, s.plan.xy, luminance(paperCol()) > .5, s.N / s.G.laps); clear(lives[i]); drawRange(lives[i].getContext('2d'), s, 0, s.drawn); }); }
const vol = $('#wVol'), muteBtn = $('#wMute'), pauseBtn = $('#wPause');
const syncSound = () => { vol.value = prefs.vol; vol.style.setProperty('--fill', prefs.vol * 100 + '%'); muteBtn.setAttribute('aria-pressed', String(prefs.muted)); muteBtn.setAttribute('aria-label', prefs.muted ? 'Unmute clicks' : 'Mute clicks'); };
vol.addEventListener('input', () => { prefs.vol = +vol.value; prefs.muted = false; syncSound(); savePrefs(); });
muteBtn.addEventListener('click', () => { prefs.muted = !prefs.muted; syncSound(); savePrefs(); });
const setPaused = (p, asleep = false) => {
  paused = p; pauseBtn.setAttribute('aria-pressed', String(p));
  pauseBtn.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause'); pauseBtn.setAttribute('aria-label', p ? 'Carry on' : 'Pause');
  if (!p && !asleep && (sleeping || sleepAt)) { sleeping = false; sleepAt = 0; sleepMin = 0; syncSleep(); }   // carrying on wakes it up
};
// toggles: rainbow ink on every layer (the ones drawing now change straight away), the pieces, two at once
const toggle = (id, keyName, after) => {
  const b = $(id), sync = () => b.setAttribute('aria-pressed', String(prefs[keyName]));
  b.addEventListener('click', () => { prefs[keyName] = !prefs[keyName]; sync(); savePrefs(); after && after(); });
  sync(); return () => b.click();
};
const toggleRainbow = toggle('#wRainbow', 'rainbow', () => {
  slots.forEach((s, i) => {
    if (!s) return;
    s.L.rainbow = prefs.rainbow || s.lucky;
    s.plan = buildPlan(s.L, s.plan.xy, false, s.N / s.G.laps);
    clear(lives[i]); drawRange(lives[i].getContext('2d'), s, 0, s.drawn);
  });
});
const togglePieces = toggle('#wPieces', 'pieces');
const toggleTwo = toggle('#wTwo', 'two', () => toast(prefs.two ? 'Two at once: a second pattern starts beside this one' : 'One at a time from the next layer'));
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

// ---------- questions: one small dialog for starting, keeping and leaving ----------
const askBox = $('#wAsk');
let asking = false;
// buttons: [label, value, primary?]; resolves with the chosen value (Esc = the last button)
function ask(title, buttons) {
  return new Promise(done => {
    asking = true; root.classList.add('asking'); wake();
    askBox.querySelector('p').textContent = title;
    const row = askBox.querySelector('.wask-btns'); row.innerHTML = '';
    const close = v => { askBox.hidden = true; asking = false; root.classList.remove('asking'); askBox.onkeydown = null; done(v); };
    buttons.forEach(([label, v, primary]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wtog' + (primary ? ' primary' : ''); b.textContent = label;
      b.addEventListener('click', () => close(v)); row.appendChild(b);
    });
    askBox.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(buttons[buttons.length - 1][1]); } };
    askBox.hidden = false; row.querySelector('button').focus();
  });
}

// ---------- keeping: what Speira drew becomes part of your drawings ----------
// Speira's layers not kept yet (finished ones, plus whatever is drawing now), ready for the drawing app.
// With your drawing brought along they are scaled back from the screen to your paper, so they land where you saw them.
const unkept = () => [...finished.filter(l => !l.kept), ...active().filter(l => l.drawn > 1 && l.keptTh !== l.th)];
function asCanvasLayers(list) {
  const sc = mine ? mine.sc : 1;
  return list.map(l => ({ ...l.L, a: 0, b: l.th, cx: (l.L.cx - CX) / sc + CX, cy: (l.L.cy - CY) / sc + CY, pitch: l.L.pitch / sc, width: l.L.width / sc }));
}
// a finished layer is kept once; one still drawing remembers how far it had got (if it carries on, the rest is offered later)
const markKept = list => list.forEach(l => { if (finished.includes(l)) l.kept = true; else l.keptTh = l.th; });
const plural = n => `${n} layer${n > 1 ? 's' : ''}`;
// how: 'add' = new layers on the canvas (your drawing, if you brought it), 'new' = a drawing of its own, 'copy' = a copy of your drawing with them on top
async function keepAs(how, quiet = false) {
  const list = unkept(); if (!list.length) return;
  const layers = asCanvasLayers(list), n = plural(list.length);
  markKept(list);
  if (how === 'add') { SpiroLab.adoptAdd(layers); if (!quiet) toast(`Added ${n} to your ${mine ? 'drawing' : 'canvas'}. ⌘Z there takes them off again.`); return; }
  const name = await SpeiraBook.saveNew(how === 'copy' ? SpiroLab.watchCopy(layers, paperCol()) : SpiroLab.watchDoc(layers, paperCol()));
  toast(how === 'copy' ? `Saved a copy of your drawing with ${n} as “${name}”` : `Saved ${n} as “${name}” in My drawings`);
}
const keepChoices = () => mine
  ? [['Add them to my drawing', 'add', true], ['Save as a copy', 'copy']]
  : [['Add them to my canvas', 'add', true], ['Save as a new drawing', 'new']];
async function keep() {
  if (asking) return;
  const list = unkept(); if (!list.length) { toast('Nothing new to keep yet'); return; }
  const v = await ask(`Keep ${plural(list.length)} Speira drew?`, [...keepChoices(), ['Cancel', null]]);
  if (v) keepAs(v);
}
// after the bedtime fade nobody is there to ask, so it keeps quietly: a drawing of its own, or a copy of yours
function quietKeep() { if (unkept().length) keepAs(mine ? 'copy' : 'new', true); }
$('#wKeep').addEventListener('click', keep);

// session code: copy it, or type one and press Enter to replay it
const codeIn = $('#wCode');
function restart(s) {
  runJobs(); seed = s >>> 0; rng = mulberry(seed);
  finished = []; slots = [null]; fading = null; next = null; coast = 0; layerNo = 0;
  moodIdx = Math.floor(rng() * MOOD_KEYS.length); moodKey = pref('mood') === 'auto' ? MOOD_KEYS[moodIdx] : pref('mood');
  for (const c of [base, fadeCv, ...lives]) clear(c);
  drawMine(base.getContext('2d'));
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
const skip = () => { fillSlots(); slots.forEach((s, i) => s && advance(i, s.G.total)); };
$('#wNext').addEventListener('click', skip);
$('#wExit').addEventListener('click', () => leave());
syncSound(); syncSleep();

// keys while watching never reach the drawing app
addEventListener('keydown', e => {
  if (!on || e.target === codeIn || asking) return;   // typing a code, or a question is open
  e.stopImmediatePropagation();
  if (e.metaKey || e.ctrlKey) return;
  const key = e.key.toLowerCase();
  if (e.key === ' ') { e.preventDefault(); setPaused(!paused); wake(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); skip(); }
  else if (key === 'm') { prefs.muted = !prefs.muted; syncSound(); savePrefs(); wake(); }
  else if (key === 'r') { toggleRainbow(); wake(); }
  else if (key === 'p') { togglePieces(); wake(); }
  else if (key === 't') { toggleTwo(); wake(); }
  else if (key === 'k') keep();
  else if (e.key === 'Escape' || key === 'w') { e.preventDefault(); leave(); }
}, true);

// ---------- entering and leaving ----------
// your drawing, ready to sit under Speira's layers: each visible layer's line, fitted to the screen
function bringMine() {
  const d = SpiroLab.inkForWatch(); if (!d.layers.length) return null;
  const list = d.layers.map(L => { const t = trace(L), xy = []; for (const i of rangeIdx(t, L.a, L.b)) xy.push(t.pts[i * 2], t.pts[i * 2 + 1]); return { L, plan: buildPlan(L, xy, false, t.N / t.G.laps) }; });
  return { list, W: d.W, H: d.H, sc: Math.min(2 * hx * .92 / d.W, 2 * hy * .92 / d.H) };
}
function show() {
  on = true; root.hidden = false; document.body.classList.add('watching');
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); else actx.resume(); } catch {}
  size(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); wake();
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) try { const p = req.call(root); if (p && p.catch) p.catch(() => {}); } catch {}
}
// Every visit starts fresh. With something on the canvas, Unwind first asks whether to bring it along.
async function enter() {
  if (on) return;
  mine = null; ov = {}; syncAll(); show(); restart(Math.floor(Math.random() * 2 ** 30)); setPaused(false);
  if (SpiroLab.inkForWatch().layers.length) {
    const v = await ask('Start fresh, or watch Speira carry on your drawing?', [['Start fresh', 'fresh', true], ['Use my drawing', 'mine'], ['Cancel', null]]);
    if (!v) { close(); return; }
    if (v === 'mine') { mine = bringMine(); ov = { paper: 'mine', mood: 'mypens' }; syncAll(); restart(seed); toast('Your paper and pens: your layers stay, only the ones Speira adds come and go'); }
  }
}
function close() {
  on = false; cancelAnimationFrame(raf); drag = null; coast = 0; mine = null;
  root.hidden = true; root.classList.remove('awake', 'asking'); document.body.classList.remove('watching');
  if (actx) actx.suspend().catch(() => {});
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
}
// leaving asks what to do with anything Speira drew that hasn't been kept yet
async function leave() {
  if (!on || asking) return;
  if (!unkept().length) { close(); return; }
  const was = paused; setPaused(true);
  const v = await ask(`Keep the ${plural(unkept().length)} Speira drew?`, [...keepChoices(), ['Leave without saving', 'drop'], ['Keep watching', null]]);
  if (!v) { setPaused(was); return; }
  if (v !== 'drop') await keepAs(v);
  close();
}
const onFs = () => {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  // Esc out of full screen leaves too (ignoring a full screen the browser takes back straight away)
  if (fs === root) fsOn = performance.now(); else if (fsOn) { const held = performance.now() - fsOn; fsOn = 0; if (held > 400) leave(); }
};
document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
addEventListener('resize', () => { if (on) size(); });
$('#watchBtn').addEventListener('click', enter);

window.SpeiraWatch = { enter, leave, keep, get state() {
    const c = active()[0];
    return { on, paused, asking, mine: !!mine, two: prefs.two, drawing: active().length, layers: finished.length, unkept: unkept().length, fading: !!fading,
      cur: c && { th: c.th, total: c.G.total, pen: c.L.pen, mood: moodKey, mode: c.L.mode, ring: c.L.ring, wheel: c.L.wheel, hole: c.L.hole, petals: c.G.petals, rainbow: c.L.rainbow, cx: c.L.cx, cy: c.L.cy },
      spots: active().map(s => [Math.round(s.L.cx), Math.round(s.L.cy), Math.round(s.G.c + s.G.d)]) }; },
  restart: n => restart(n), skip,
  // for testing: jump to the end of the bedtime fade
  bedtimeNow() { sleepMin = 30; sleepAt = performance.now() - SLEEP_FADE_MS; },
  // for testing: the first n recipes a code produces (then starts that code afresh)
  recipes(code, n) { restart(code); const out = []; for (let i = 0; i < n; i++) { const c = compose(layout()[0]); out.push(`${c.L.mode}-${RINGS[c.L.ring].inner}/${c.L.wheel} h${c.L.hole + 1} ${c.G.petals}p ${c.L.pen}${c.L.rainbow ? ' rainbow' : ''}`); } restart(code); return out; } };
})();
