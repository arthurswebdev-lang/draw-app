import { ShapeKind } from '../types';

export type Seg = [number, number, number, number];
/** A label: anchored at a world point, then pushed (dx, dy) screen pixels away. */
export type GuideLabel = { x: number; y: number; dx: number; dy: number; text: string };
/** An angle arc about a world point; `r` is in screen pixels, `sweep` is signed. */
export type GuideArc = { x: number; y: number; a0: number; sweep: number; r: number };
export type Guide = {
  solid: Seg[];
  dashed: Seg[];
  arcs: GuideArc[];
  labels: GuideLabel[];
  /** True when the shape is exactly square, round, or on a 15 degree step. */
  exact: boolean;
};

const deg = (r: number) => (r * 180) / Math.PI;
const norm = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};

/** 45° when whole, 38.7° otherwise. */
export const fmtDeg = (d: number) => (Math.abs(d - Math.round(d)) < 0.05 ? `${Math.round(d)}°` : `${d.toFixed(1)}°`);
const len = (n: number) => String(Math.round(n));

const box = (x0: number, y0: number, x1: number, y1: number): Seg[] => [
  [x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0],
];

const onStep = (a: number, step: number) => Math.abs(a - Math.round(a / step) * step) < 1e-6;

/**
 * The measuring guides for a shape, shown while it is dragged out and again
 * whenever it is selected, so its angles and sizes can be read at any time.
 *
 * Rectangle: its diagonal, and the two angles the diagonal makes with the top
 * and left sides at the top-left corner. A square is exactly 45° and 45°.
 * Oval: its two axes with width and height (a circle shows its diameter).
 * Line: the rectangle the line is the diagonal of, with the angle to the
 * horizontal and to the vertical at the line's start.
 * Polygon or open path: the angle inside each corner.
 *
 * `zoom` keeps the arcs a sensible size on screen. `rotation` turns a rectangle
 * or oval's guides with it, about its centre. Returns null when the shape is
 * too small for guides to be anything but clutter.
 */
export function guidesFor(shape: ShapeKind, pts: number[], zoom: number, rotation = 0): Guide | null {
  const [ax, ay, bx, by] = pts;

  // Everything for a rectangle or oval is worked out upright, then turned about
  // the centre of its box. These map a point, an angle and a screen offset.
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const at = (x: number, y: number) => ({ x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos });
  const seg = ([x1, y1, x2, y2]: Seg): Seg => {
    const a = at(x1, y1), b = at(x2, y2);
    return [a.x, a.y, b.x, b.y];
  };
  const label = (x: number, y: number, dx: number, dy: number, text: string): GuideLabel => {
    const p = at(x, y);
    return { x: p.x, y: p.y, dx: dx * cos - dy * sin, dy: dx * sin + dy * cos, text };
  };
  /** An angle label out along the middle of its arc, past the arc's end. */
  const arcLabel = (x: number, y: number, a0: number, sweep: number, r: number, text: string): GuideLabel => {
    const mid = a0 + sweep / 2 + rotation;
    const p = at(x, y);
    return { x: p.x, y: p.y, dx: Math.cos(mid) * (r + 17), dy: Math.sin(mid) * (r + 17), text };
  };

  if (shape === 'rect') {
    const x0 = Math.min(ax, bx), y0 = Math.min(ay, by), x1 = Math.max(ax, bx), y1 = Math.max(ay, by);
    const w = x1 - x0, h = y1 - y0;
    if (w * zoom < 8 || h * zoom < 8) return null;
    const d = Math.atan2(h, w);
    const r = Math.min(26, 0.4 * Math.min(w, h) * zoom);
    const exact = Math.abs(w - h) < 1e-6;
    const tl = at(x0, y0);
    const labels = [
      arcLabel(x0, y0, 0, d, r, fmtDeg(deg(d))),
      arcLabel(x0, y0, d, Math.PI / 2 - d, r, fmtDeg(90 - deg(d))),
      label(x0 + w / 2, y1, 0, 14, `${len(w)} × ${len(h)}`),
    ];
    if (exact) labels.push(label(x0 + w / 2, y0, 0, -14, 'square'));
    return {
      solid: [seg([x0, y0, x1, y1])], dashed: [],
      arcs: [
        { x: tl.x, y: tl.y, a0: rotation, sweep: d, r },
        { x: tl.x, y: tl.y, a0: rotation + d, sweep: Math.PI / 2 - d, r },
      ],
      labels, exact,
    };
  }

  if (shape === 'ellipse') {
    const x0 = Math.min(ax, bx), y0 = Math.min(ay, by), x1 = Math.max(ax, bx), y1 = Math.max(ay, by);
    const w = x1 - x0, h = y1 - y0, mx = x0 + w / 2, my = y0 + h / 2;
    if (w * zoom < 8 || h * zoom < 8) return null;
    const exact = Math.abs(w - h) < 1e-6;
    const labels: GuideLabel[] = [];
    if (exact) {
      labels.push(label(mx, my, 0, -12, `⌀ ${len(w)}`), label(mx, y0, 0, -14, 'circle'));
    } else if (w * zoom >= 90 && h * zoom >= 60) {
      labels.push(label(x1, my, -28, -11, `W ${len(w)}`), label(mx, y0, 26, 13, `H ${len(h)}`));
    } else {
      labels.push(label(mx, y1, 0, 14, `${len(w)} × ${len(h)}`));
    }
    return {
      solid: [seg([x0, my, x1, my]), seg([mx, y0, mx, y1])],
      dashed: box(x0, y0, x1, y1).map(seg),
      arcs: [], labels, exact,
    };
  }

  if (shape === 'line') {
    const dx = bx - ax, dy = by - ay;
    const l = Math.hypot(dx, dy);
    if (l * zoom < 8) return null;
    const ang = Math.atan2(dy, dx);
    const toH = dx >= 0 ? 0 : Math.PI;
    const toV = dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const sweepH = norm(ang - toH), sweepV = norm(toV - ang);
    const r = Math.min(30, 0.4 * l * zoom);
    return {
      solid: [], dashed: box(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)),
      arcs: [{ x: ax, y: ay, a0: toH, sweep: sweepH, r }, { x: ax, y: ay, a0: ang, sweep: sweepV, r }],
      labels: [
        arcLabel(ax, ay, toH, sweepH, r, fmtDeg(deg(Math.abs(sweepH)))),
        arcLabel(ax, ay, ang, sweepV, r, fmtDeg(deg(Math.abs(sweepV)))),
        { x: (ax + bx) / 2, y: (ay + by) / 2, dx: 0, dy: -13, text: len(l) },
      ],
      exact: onStep(ang, Math.PI / 12),
    };
  }

  if ((shape === 'polygon' && pts.length >= 6) || (shape === 'polyline' && pts.length >= 6)) {
    return polygonGuides(pts, shape === 'polygon', zoom);
  }

  return null;
}

/** The angle inside every corner of a polygon (or every inner corner of an open path). */
function polygonGuides(pts: number[], closed: boolean, zoom: number): Guide | null {
  const n = pts.length / 2;
  const P = (i: number) => ({ x: pts[2 * ((i + n) % n)], y: pts[2 * ((i + n) % n) + 1] });
  // Which way round the polygon runs, so "inside" can be told from "outside" at a dent.
  let area = 0;
  for (let i = 0; i < n; i++) area += P(i).x * P(i + 1).y - P(i + 1).x * P(i).y;
  const orient = Math.sign(area) || 1;

  const labels: GuideLabel[] = [];
  let exact = true;
  for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
    const c = P(i), a = P(i - 1), b = P(i + 1);
    const ux = a.x - c.x, uy = a.y - c.y, vx = b.x - c.x, vy = b.y - c.y;
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu * zoom < 6 || lv * zoom < 6) continue;
    let ang = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv))));
    let bx = ux / lu + vx / lv, by = uy / lu + vy / lv;
    if (closed) {
      // A dent bends the other way from the polygon's turn: its inside angle is the long way round.
      const turn = (c.x - a.x) * (b.y - c.y) - (c.y - a.y) * (b.x - c.x);
      if (Math.sign(turn) === -orient) { ang = 2 * Math.PI - ang; bx = -bx; by = -by; }
    }
    const lb = Math.hypot(bx, by);
    // A dead-straight corner has no bisector: push the label sideways instead.
    const [dx, dy] = lb < 1e-9 ? [-uy / lu, ux / lu] : [bx / lb, by / lb];
    labels.push({ x: c.x, y: c.y, dx: dx * 26, dy: dy * 26, text: fmtDeg(deg(ang)) });
    if (!onStep(deg(ang), 15)) exact = false;
  }
  return labels.length ? { solid: [], dashed: [], arcs: [], labels, exact } : null;
}
