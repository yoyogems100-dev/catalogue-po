// Three-view line drawings of each cut -- the stone from the top (crown),
// from the side (profile) and from below (pavilion) -- in the style of the
// Preciosa price-list drawings. Plain vector strokes, no fill, so they sit on
// any background. Drawn from each shape's top outline and its cut family:
//  brilliant: star facets on the crown, a pointed pavilion
//  step:      parallel steps around a flat table, a keel line below
//  rose:      a faceted dome with a flat back
// ShapeIcon draws these; nothing here touches the DOM.

type Pt = [number, number];
type Family = 'brilliant' | 'step' | 'rose';
type Spec = { outline: Pt[]; family: Family; corners?: boolean };

const TAU = Math.PI * 2;
const ring = (n: number, f: (t: number) => Pt): Pt[] => Array.from({ length: n }, (_, i) => f((i / n) * TAU));
const poly = (...pts: Pt[]) => pts;

// Top outlines in a box about [-1, 1] each way; y grows downward.
function ellipse(rx: number, ry: number, n = 16) { return ring(n, (t) => [rx * Math.sin(t), -ry * Math.cos(t)]); }
function superellipse(r: number, p: number, n = 16) {
  return ring(n, (t) => { const c = Math.cos(t), s = Math.sin(t); return [r * Math.sign(s) * Math.abs(s) ** (2 / p), -r * Math.sign(c) * Math.abs(c) ** (2 / p)]; });
}
function cutRect(w: number, h: number, cut: number): Pt[] {
  return [[-w + cut, -h], [w - cut, -h], [w, -h + cut], [w, h - cut], [w - cut, h], [-w + cut, h], [-w, h - cut], [-w, -h + cut]];
}
function regular(n: number, r: number, rot = 0): Pt[] { return ring(n, (t) => [r * Math.sin(t + rot), -r * Math.cos(t + rot)]); }
function pear(n = 18): Pt[] {
  // Pointed at the top, round at the bottom.
  return ring(n, (t) => [0.72 * Math.sin(t) * ((1 - Math.cos(t)) / 2) ** 0.6, -Math.cos(t)]);
}
function marquise(n = 16): Pt[] { return ring(n, (t) => [0.5 * Math.sin(t) * Math.abs(Math.sin(t)) ** 0.15, -Math.cos(t)]); }
function heart(n = 20): Pt[] {
  return ring(n, (t) => { const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [x / 17, -(y + 3) / 15]; });
}
function trillion(n = 15): Pt[] {
  return ring(n, (t) => { const k = 1 + 0.1 * Math.cos(3 * t); const r = 0.62 / (Math.cos(((t + Math.PI / 3) % (TAU / 3)) - Math.PI / 3) || 1); return [Math.min(1, r * k) * Math.sin(t), -Math.min(1, r * k) * Math.cos(t) + 0.15]; });
}
function clover(n = 32): Pt[] { return ring(n, (t) => { const r = 0.55 + 0.45 * Math.abs(Math.cos(2 * t)) ** 0.7; return [r * Math.sin(t), -r * Math.cos(t)]; }); }
function star(points: number, r1: number, r2: number): Pt[] { return ring(points * 2, (t) => { const r = Math.round(t / (TAU / (points * 2))) % 2 ? r2 : r1; return [r * Math.sin(t), -r * Math.cos(t)]; }); }
function gourd(n = 28): Pt[] { return ring(n, (t) => { const y = -Math.cos(t); const w = y < -0.1 ? 0.42 * Math.sqrt(Math.max(0, 1 - ((y + 0.55) / 0.45) ** 2)) : 0.62 * Math.sqrt(Math.max(0, 1 - ((y - 0.38) / 0.62) ** 2)); return [Math.sign(Math.sin(t)) * Math.max(0.12, w), y]; }); }
function halfMoon(n = 9): Pt[] { const arc = Array.from({ length: n }, (_, i) => { const t = Math.PI * (i / (n - 1)); return [-Math.cos(t), 0.55 - 1.1 * Math.sin(t)] as Pt; }); return arc.reverse(); }

const SPECS: Record<string, Spec> = {
  round: { outline: ellipse(1, 1), family: 'brilliant' },
  oval: { outline: ellipse(0.7, 1), family: 'brilliant' },
  pear: { outline: pear(), family: 'brilliant' },
  marquise: { outline: marquise(), family: 'brilliant' },
  heart: { outline: heart(), family: 'brilliant' },
  cushion: { outline: superellipse(1, 3.2), family: 'brilliant' },
  square: { outline: poly([-1, -1], [1, -1], [1, 1], [-1, 1]), family: 'brilliant', corners: true },
  radiant: { outline: cutRect(0.72, 1, 0.22), family: 'brilliant', corners: true },
  trillion: { outline: trillion(), family: 'brilliant' },
  triangle: { outline: poly([0, -1], [0.95, 0.75], [-0.95, 0.75]), family: 'step', corners: true },
  emerald: { outline: cutRect(0.68, 1, 0.24), family: 'step', corners: true },
  asscher: { outline: cutRect(1, 1, 0.34), family: 'step', corners: true },
  octagon: { outline: regular(8, 1, Math.PI / 8), family: 'step', corners: true },
  baguette: { outline: poly([-0.42, -1], [0.42, -1], [0.42, 1], [-0.42, 1]), family: 'step', corners: true },
  taperedbaguette: { outline: poly([-0.5, -1], [0.5, -1], [0.3, 1], [-0.3, 1]), family: 'step', corners: true },
  trapezoid: { outline: poly([-0.55, -0.6], [0.55, -0.6], [1, 0.6], [-1, 0.6]), family: 'step', corners: true },
  hexagon: { outline: regular(6, 1), family: 'step', corners: true },
  pentagon: { outline: regular(5, 1), family: 'brilliant', corners: true },
  diamond: { outline: poly([0, -1], [0.85, -0.25], [0, 1], [-0.85, -0.25]), family: 'brilliant', corners: true },
  kite: { outline: poly([0, -1], [0.55, -0.35], [0, 1], [-0.55, -0.35]), family: 'brilliant', corners: true },
  lozenge: { outline: poly([0, -1], [0.55, 0], [0, 1], [-0.55, 0]), family: 'brilliant', corners: true },
  arrow: { outline: poly([0, -1], [0.62, -0.45], [0.42, 1], [-0.42, 1], [-0.62, -0.45]), family: 'step', corners: true },
  shield: { outline: poly([-0.7, -1], [0.7, -1], [0.78, 0.05], [0, 1], [-0.78, 0.05]), family: 'brilliant', corners: true },
  bucket: { outline: poly([-0.4, -1], [0.4, -1], [0.75, -0.3], [0.45, 1], [-0.45, 1], [-0.75, -0.3]), family: 'brilliant', corners: true },
  bullet: { outline: poly([-0.6, -1], [0.6, -1], [0.6, 0.35], [0, 1], [-0.6, 0.35]), family: 'step', corners: true },
  whistle: { outline: poly([-0.6, -0.4], [0.05, -1], [0.6, -0.65], [0.6, 1], [-0.6, 1]), family: 'step', corners: true },
  star: { outline: star(5, 1, 0.45), family: 'brilliant', corners: true },
  lily: { outline: star(4, 1, 0.38), family: 'brilliant', corners: true },
  clover: { outline: clover(), family: 'brilliant' },
  gourd: { outline: gourd(), family: 'brilliant' },
  halfmoon: { outline: halfMoon(), family: 'step' },
  rose: { outline: ellipse(1, 1, 12), family: 'rose' },
  fan: { outline: poly([0, 0.9], [-0.95, -0.35], [-0.6, -0.8], [0, -1], [0.6, -0.8], [0.95, -0.35]), family: 'brilliant', corners: true },
};

const H = 24;      // drawing height in viewBox units
const GAP = 3.5;   // space between the three views
const PAD = 0.6;   // keep strokes inside

function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
const f = (n: number) => +n.toFixed(2);
const pathOf = (pts: Pt[], close = true) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}${close ? 'Z' : ''}`;
const line = (a: Pt, b: Pt) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
const scaleAbout = (pts: Pt[], c: Pt, k: number): Pt[] => pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);

/** The top outline, placed in a box `h` high starting at x = `left`. */
function place(outline: Pt[], left: number, h: number) {
  const b = bounds(outline), k = (h - 2 * PAD) / (b.y1 - b.y0);
  const pts = outline.map(([x, y]) => [left + PAD + (x - b.x0) * k, PAD + (y - b.y0) * k] as Pt);
  const w = (b.x1 - b.x0) * k + 2 * PAD;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { pts, w, c: [cx, cy] as Pt };
}

/** A few-sided brilliant gets its edge midpoints as facet points too. */
function facetPoints(spec: Spec, pts: Pt[]): Pt[] {
  if (spec.family !== 'brilliant' || pts.length >= 8) return pts;
  return pts.flatMap((p, i) => { const q = pts[(i + 1) % pts.length]; return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as Pt]; });
}

function crown(spec: Spec, left: number): { d: string; w: number } {
  const placed = place(spec.outline, left, H);
  const { w, c } = placed, pts = facetPoints(spec, placed.pts);
  const parts = [pathOf(pts)];
  if (spec.family === 'step') {
    const mid = scaleAbout(pts, c, 0.78), table = scaleAbout(pts, c, 0.52);
    parts.push(pathOf(mid), pathOf(table));
    pts.forEach((p, i) => parts.push(line(p, table[i])));
  } else if (spec.family === 'rose') {
    const inner = scaleAbout(pts, c, 0.5);
    pts.forEach((p, i) => { parts.push(line(p, inner[i]), line(inner[i], c), line(p, inner[(i + 1) % pts.length])); });
  } else {
    const table = scaleAbout(pts, c, 0.5);
    parts.push(pathOf(table));
    const n = pts.length, step = n > 12 ? 2 : 1;
    for (let i = 0; i < n; i += step) {
      parts.push(line(table[i], pts[i]));
      parts.push(line(table[i], pts[(i + step) % n]));
    }
  }
  return { d: parts.join(''), w };
}

function pavilion(spec: Spec, left: number): { d: string; w: number } {
  const placed = place(spec.outline, left, H);
  const { w, c } = placed, pts = facetPoints(spec, placed.pts);
  const parts = [pathOf(pts)];
  if (spec.family === 'rose') return { d: parts.join(''), w };
  if (spec.family === 'step') {
    const a = scaleAbout(pts, c, 0.66), b = scaleAbout(pts, c, 0.34);
    parts.push(pathOf(a), pathOf(b));
    pts.forEach((p, i) => parts.push(line(p, b[i])));
    const bb = bounds(b);
    const long = bb.y1 - bb.y0 >= bb.x1 - bb.x0;
    parts.push(long ? line([c[0], bb.y0 + (bb.y1 - bb.y0) * 0.2], [c[0], bb.y1 - (bb.y1 - bb.y0) * 0.2]) : line([bb.x0 + (bb.x1 - bb.x0) * 0.2, c[1]], [bb.x1 - (bb.x1 - bb.x0) * 0.2, c[1]]));
  } else {
    const n = pts.length, step = n > 18 ? 2 : 1;
    const half = scaleAbout(pts, c, 0.42);
    for (let i = 0; i < n; i += step) parts.push(line(pts[i], c));
    for (let i = 0; i < n; i += 2) parts.push(line(half[i], pts[(i + 1) % n]));
  }
  return { d: parts.join(''), w };
}

/** The stone seen side-on: crown on the left, girdle, pavilion to the right. */
function profile(spec: Spec, left: number): { d: string; w: number } {
  const w = H * (spec.family === 'rose' ? 0.42 : 0.5);
  const X = (t: number) => left + PAD + t * (w - 2 * PAD), Y = (t: number) => PAD + t * (H - 2 * PAD);
  const parts: string[] = [];
  if (spec.family === 'rose') {
    parts.push(`M${f(X(1))} ${f(Y(0))}Q${f(X(-0.15))} ${f(Y(0.5))} ${f(X(1))} ${f(Y(1))}Z`);
    parts.push(line([X(1), Y(0.5)], [X(0.18), Y(0.5)]), line([X(1), Y(0.2)], [X(0.32), Y(0.32)]), line([X(1), Y(0.8)], [X(0.32), Y(0.68)]));
    return { d: parts.join(''), w };
  }
  const g0 = 0.3, g1 = 0.36;
  if (spec.family === 'step') {
    parts.push(pathOf([[X(0.04), Y(0.16)], [X(g0), Y(0)], [X(g1), Y(0)], [X(1), Y(0.3)], [X(1), Y(0.7)], [X(g1), Y(1)], [X(g0), Y(1)], [X(0.04), Y(0.84)]]));
    parts.push(line([X(g0), Y(0)], [X(g0), Y(1)]), line([X(g1), Y(0)], [X(g1), Y(1)]));
    parts.push(line([X(0.17), Y(0.08)], [X(0.17), Y(0.92)]), line([X(0.6), Y(0.11)], [X(0.6), Y(0.89)]), line([X(0.82), Y(0.21)], [X(0.82), Y(0.79)]));
  } else {
    parts.push(pathOf([[X(0.04), Y(0.24)], [X(g0), Y(0)], [X(g1), Y(0)], [X(1), Y(0.5)], [X(g1), Y(1)], [X(g0), Y(1)], [X(0.04), Y(0.76)]]));
    parts.push(line([X(g0), Y(0)], [X(g0), Y(1)]), line([X(g1), Y(0)], [X(g1), Y(1)]));
    parts.push(line([X(0.04), Y(0.24)], [X(g0), Y(0.36)]), line([X(0.04), Y(0.76)], [X(g0), Y(0.64)]), line([X(0.04), Y(0.5)], [X(g0), Y(0.5)]));
    parts.push(line([X(g1), Y(0.3)], [X(1), Y(0.5)]), line([X(g1), Y(0.7)], [X(1), Y(0.5)]), line([X(g1), Y(0.5)], [X(1), Y(0.5)]));
  }
  return { d: parts.join(''), w };
}

export type ThreeView = { width: number; height: number; d: string };
const cache = new Map<string, ThreeView>();

/** Top, side and bottom views of a cut, as one stroked path. */
export function threeView(iconKey: string | null | undefined): ThreeView {
  const key = iconKey && SPECS[iconKey] ? iconKey : 'diamond';
  const hit = cache.get(key);
  if (hit) return hit;
  const spec = SPECS[key];
  const top = crown(spec, 0);
  const side = profile(spec, top.w + GAP);
  const bottom = pavilion(spec, top.w + GAP + side.w + GAP);
  const view = { width: f(top.w + GAP + side.w + GAP + bottom.w), height: H, d: top.d + side.d + bottom.d };
  cache.set(key, view);
  return view;
}

export const THREE_VIEW_KEYS = Object.keys(SPECS);
