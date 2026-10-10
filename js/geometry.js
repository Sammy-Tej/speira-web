// Gear maths. Every size is measured in teeth, like the paper kit: a radius is teeth × pitch / 2π,
// so a wheel always meshes with a ring and every pattern closes exactly.
// World units: the paper is 1000 × 1000.

const PAPER = 1000;

// Two classic rings: inner teeth (wheel rolls inside) / outer teeth (wheel rolls outside).
const RINGS = [
  { id: 'r96', inner: 96, outer: 150 },
  { id: 'r105', inner: 105, outer: 144 }
];
const WHEELS = [24, 30, 32, 36, 40, 42, 45, 48, 50, 52, 56, 60, 63, 64, 72, 75, 80, 84];
// Straight bars (racks): a bar with rounded ends, teeth all the way round its edge. The wheel rolls around the
// outside of it, along both straight sides and round both ends, so the pattern still closes.
// `straight` = teeth along each straight side, `end` = teeth round each rounded end.
const BARS = [
  { id: 'b84', kind: 'bar', straight: 24, end: 18 },
  { id: 'b108', kind: 'bar', straight: 36, end: 18 }
];
// Every piece the wheel can roll against. A layer's `ring` is an index into this list (rings first, so old drawings still work).
const PIECES = [...RINGS.map(r => ({ kind: 'ring', ...r })), ...BARS];
const barTeeth = b => 2 * b.straight + 2 * b.end;
const pieceName = i => { const pc = PIECES[i]; return pc.kind === 'bar' ? `Bar ${barTeeth(pc)}` : `${pc.inner} / ${pc.outer}`; };
const isBar = L => PIECES[L.ring] && PIECES[L.ring].kind === 'bar';

const TAU = Math.PI * 2;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const radiusOf = (teeth, pitch) => (teeth * pitch) / TAU;

// Pen holes spiral in from the rim towards the hub, like on a real wheel.
// Hole 1 sits nearest the teeth; each next hole is a little closer to the centre.
function holesFor(teeth, pitch) {
  const r = radiusOf(teeth, pitch), margin = pitch * 0.95, minD = pitch * 0.55, step = pitch * 0.42;
  const out = [];
  for (let d = r - margin, i = 0; d >= minD; d -= step, i++) out.push({ d, a: i * 0.6 });
  return out;
}

// Everything derived from one layer's settings.
function geom(L) {
  if (isBar(L)) return geomBar(L);
  const ring = RINGS[L.ring], inside = L.mode === 'inside';
  const T = inside ? ring.inner : ring.outer, t = L.wheel, p = L.pitch;
  const Rr = radiusOf(T, p), rr = radiusOf(t, p);
  const holes = holesFor(t, p), hole = clampN(L.hole, 0, holes.length - 1), h = holes[hole];
  const G = gcd(T, t);
  return {
    ring, inside, T, t, p, Rr, rr, holes, hole,
    d: h.d, a: h.a,
    c: inside ? Rr - rr : Rr + rr,              // distance from ring centre to wheel centre
    ratio: inside ? -(T - t) / t : (T + t) / t, // wheel spin per radian travelled round the ring
    total: (TAU * t) / G,                       // travel needed for the pattern to close
    petals: T / G,                              // loops in the finished pattern
    laps: t / G,                                // trips round the ring before it closes
    rot: (TAU * L.shift) / T                    // start offset, in teeth
  };
}

// A bar: the pitch line is a stadium (two straight sides joined by half-circles). One trip round = 2π of travel,
// like a ring, so tooth counts, laps and petals work exactly the same way.
function geomBar(L) {
  const bar = PIECES[L.ring], T = barTeeth(bar), t = L.wheel, p = L.pitch;
  const re = radiusOf(2 * bar.end, p), ls = bar.straight * p, Lp = T * p;   // end radius, straight length, perimeter
  const ang = ((L.angle || 0) * Math.PI) / 180;                                // the bar can lie at any angle
  const rr = radiusOf(t, p), holes = holesFor(t, p), hole = clampN(L.hole, 0, holes.length - 1), h = holes[hole];
  const G = gcd(T, t);
  return {
    ring: bar, bar: { re, ls, Lp, ang, ca: Math.cos(ang), sa: Math.sin(ang) }, inside: false, T, t, p, Rr: re, rr, holes, hole,
    d: h.d, a: h.a,
    c: ls / 2 + re + rr,               // furthest the wheel centre gets from the middle (used for sampling density)
    ratio: (T + t) / t,                // average wheel spin per radian of travel
    total: (TAU * t) / G, petals: T / G, laps: t / G,
    rot: (TAU * L.shift) / T
  };
}
// point on the bar's pitch line `s` along from the bottom of its right-hand end, with the outward normal angle ψ
// (worked out with the bar lying flat, then turned by the bar's angle about its centre)
function barPoint(B, cx, cy, s) {
  const { re, ls } = B, arc = Math.PI * re;
  let x, y, psi;
  if (s < arc) { psi = -Math.PI / 2 + s / re; x = ls / 2 + re * Math.cos(psi); y = re * Math.sin(psi); }
  else if ((s -= arc) < ls) { psi = Math.PI / 2; x = ls / 2 - s; y = re; }
  else if ((s -= ls) < arc) { psi = Math.PI / 2 + s / re; x = -ls / 2 + re * Math.cos(psi); y = re * Math.sin(psi); }
  else { s -= arc; psi = 3 * Math.PI / 2; x = -ls / 2 + s; y = -re; }
  const ca = B.ca ?? 1, sa = B.sa ?? 0;
  return [cx + x * ca - y * sa, cy + x * sa + y * ca, psi + (B.ang || 0)];
}
// Wheel centre, wheel orientation and pen position after travelling `th` radians round the ring.
function wheelAt(G, L, th) {
  if (G.bar) {
    // rolling round a shape: the wheel turns by distance travelled ÷ its radius, plus however much the edge itself has turned
    const B = G.bar, u = (G.rot + th) / TAU * B.Lp, lap = Math.floor(u / B.Lp), [x, y, psi] = barPoint(B, L.cx, L.cy, u - lap * B.Lp);
    const psiU = psi + Math.PI / 2 + lap * TAU, spin = u / G.rr + psiU;
    const wx = x + G.rr * Math.cos(psi), wy = y + G.rr * Math.sin(psi);
    return { wx, wy, spin, ang: psi, px: wx + G.d * Math.cos(spin + G.a), py: wy + G.d * Math.sin(spin + G.a) };
  }
  const ang = G.rot + th, spin = G.rot + G.ratio * th;
  const wx = L.cx + G.c * Math.cos(ang), wy = L.cy + G.c * Math.sin(ang);
  return { wx, wy, spin, ang, px: wx + G.d * Math.cos(spin + G.a), py: wy + G.d * Math.sin(spin + G.a) };
}

// One full closed loop, sampled finely enough to stay smooth at poster size.
function trace(L) {
  const G = geom(L);
  const speed = G.c + G.d * Math.abs(G.ratio);
  const N = clampN(Math.ceil((G.total * speed) / 0.6), 400, 600000);
  const pts = new Float64Array(N * 2);
  for (let i = 0; i < N; i++) {
    const w = wheelAt(G, L, (i / N) * G.total);
    pts[i * 2] = w.px; pts[i * 2 + 1] = w.py;
  }
  return { G, N, pts };
}

// Indices into the closed loop covered by the travelled range [a, b] (radians, may be negative or long).
function* rangeIdx(tr, a, b) {
  const { N, G } = tr;
  if (b - a >= G.total) { for (let i = 0; i <= N; i++) yield i % N; return; }
  const i0 = Math.floor((a / G.total) * N), i1 = Math.ceil((b / G.total) * N);
  for (let i = i0; i <= i1; i++) yield ((i % N) + N) % N;
}

if (typeof module !== 'undefined') module.exports = { PAPER, RINGS, BARS, PIECES, pieceName, isBar, WHEELS, TAU, gcd, radiusOf, holesFor, geom, wheelAt, trace, rangeIdx };
