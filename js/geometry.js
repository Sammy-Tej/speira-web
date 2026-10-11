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
// Shaped rings: an oval, a rounded triangle and a rounded square. The wheel can roll inside or outside the
// same toothed edge (inside only if the wheel is small enough to get round the tightest curve).
const SHAPES = [
  { id: 'oval120', kind: 'shape', shape: 'oval', name: 'Oval', teeth: 120 },
  { id: 'tri108', kind: 'shape', shape: 'poly', sides: 3, name: 'Triangle', teeth: 108 },
  { id: 'sq120', kind: 'shape', shape: 'poly', sides: 4, name: 'Square', teeth: 120 }
];
// Every piece the wheel can roll against. A layer's `ring` is an index into this list (rings first, so old drawings still work).
const PIECES = [...RINGS.map(r => ({ kind: 'ring', ...r })), ...BARS, ...SHAPES];
const barTeeth = b => 2 * b.straight + 2 * b.end;
const pieceName = i => { const pc = PIECES[i]; return pc.kind === 'bar' ? `Bar ${barTeeth(pc)}` : pc.kind === 'shape' ? `${pc.name} ${pc.teeth}` : `${pc.inner} / ${pc.outer}`; };
const isBar = L => PIECES[L.ring] && PIECES[L.ring].kind === 'bar';
const isShape = L => PIECES[L.ring] && PIECES[L.ring].kind === 'shape';
const isTrack = L => isBar(L) || isShape(L);   // anything that isn't a plain round ring (it can be turned to an angle)

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
  if (isShape(L)) return geomShape(L);
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
// A shaped ring's pitch line as a chain of arcs and straight sides, scaled so its length is exactly teeth × pitch.
// Each segment knows where its outward normal points (ψ), which only ever increases going round: the shape is convex.
function shapeSegments(pc, p) {
  const segs = [];
  if (pc.shape === 'oval') {
    // a four-arc oval: gentle arcs top and bottom, tighter arcs at the ends, meeting smoothly
    const al = .7, k = 2.6, dd = k - 1;   // half-angle of the end arcs, big/small radius ratio
    const e = dd * Math.cos(al), f = dd * Math.sin(al), per = 4 * al + 2 * (Math.PI - 2 * al) * k, sc = pc.teeth * p / per;
    const rb = sc, ra = k * sc;
    segs.push({ arc: true, x: e * sc, y: 0, r: rb, a0: -al, a1: al });
    segs.push({ arc: true, x: 0, y: -f * sc, r: ra, a0: al, a1: Math.PI - al });
    segs.push({ arc: true, x: -e * sc, y: 0, r: rb, a0: Math.PI - al, a1: Math.PI + al });
    segs.push({ arc: true, x: 0, y: f * sc, r: ra, a0: Math.PI + al, a1: TAU - al });
    return { segs, minR: rb };
  }
  // rounded polygon: corner arcs centred on a smaller polygon, joined by straight sides; a point faces up
  const n = pc.sides, rcRatio = .55, side = 1, rc = rcRatio * side, R0 = side / (2 * Math.sin(Math.PI / n));
  const sc = pc.teeth * p / (n * side + TAU * rc);
  for (let i = 0; i < n; i++) {
    const th = -Math.PI / 2 + i * TAU / n, cx = R0 * sc * Math.cos(th), cy = R0 * sc * Math.sin(th);
    segs.push({ arc: true, x: cx, y: cy, r: rc * sc, a0: th - Math.PI / n, a1: th + Math.PI / n });
    const psi = th + Math.PI / n;
    segs.push({ arc: false, x: cx + rc * sc * Math.cos(psi), y: cy + rc * sc * Math.sin(psi), psi, len: side * sc });
  }
  return { segs, minR: rc * sc };
}
function geomShape(L) {
  const pc = PIECES[L.ring], T = pc.teeth, t = L.wheel, p = L.pitch, inside = L.mode === 'inside';
  const { segs, minR } = shapeSegments(pc, p), ang = ((L.angle || 0) * Math.PI) / 180;
  let acc = 0; for (const g of segs) { g.len = g.arc ? g.r * (g.a1 - g.a0) : g.len; g.s0 = acc; acc += g.len; }
  const rr = radiusOf(t, p), holes = holesFor(t, p), hole = clampN(L.hole, 0, holes.length - 1), h = holes[hole], G = gcd(T, t);
  const far = Math.max(...segs.map(g => Math.hypot(g.x, g.y) + (g.arc ? g.r : 0)));
  return {
    ring: pc, track: { segs, Lp: acc, ang, ca: Math.cos(ang), sa: Math.sin(ang), minR }, inside, fits: !inside || rr < minR * .98,
    T, t, p, Rr: far, rr, holes, hole, d: h.d, a: h.a,
    c: far + (inside ? -rr : rr), ratio: inside ? -(T - t) / t : (T + t) / t,
    total: (TAU * t) / G, petals: T / G, laps: t / G, rot: (TAU * L.shift) / T
  };
}
// point on a shaped ring's pitch line `s` along, turned by its angle, with the outward normal angle ψ
function trackPoint(K, cx, cy, s) {
  let g = K.segs[K.segs.length - 1];
  for (const q of K.segs) if (s < q.s0 + q.len) { g = q; break; }
  const u = s - g.s0;
  let x, y, psi;
  if (g.arc) { psi = g.a0 + u / g.r; x = g.x + g.r * Math.cos(psi); y = g.y + g.r * Math.sin(psi); }
  else { psi = g.psi; x = g.x + u * Math.cos(psi + Math.PI / 2); y = g.y + u * Math.sin(psi + Math.PI / 2); }
  return [cx + x * K.ca - y * K.sa, cy + x * K.sa + y * K.ca, psi + K.ang];
}
// Wheel centre, wheel orientation and pen position after travelling `th` radians round the ring.
function wheelAt(G, L, th) {
  if (G.track) {
    // same rule as the bar; inside, the wheel turns the other way relative to the distance travelled
    const K = G.track, u = (G.rot + th) / TAU * K.Lp, lap = Math.floor(u / K.Lp), [x, y, psi] = trackPoint(K, L.cx, L.cy, u - lap * K.Lp);
    const psiU = psi + lap * TAU, sgn = G.inside ? -1 : 1, spin = sgn * u / G.rr + psiU;
    const wx = x + sgn * G.rr * Math.cos(psi), wy = y + sgn * G.rr * Math.sin(psi);
    return { wx, wy, spin, ang: psi, px: wx + G.d * Math.cos(spin + G.a), py: wy + G.d * Math.sin(spin + G.a) };
  }
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

if (typeof module !== 'undefined') module.exports = { PAPER, RINGS, BARS, SHAPES, PIECES, pieceName, isBar, isShape, isTrack, trackPoint, WHEELS, TAU, gcd, radiusOf, holesFor, geom, wheelAt, trace, rangeIdx };
