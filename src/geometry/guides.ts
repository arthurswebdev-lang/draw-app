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

/** Where an angle label sits: out along the middle of its arc, past the arc's end. */
function arcLabel(x: number, y: number, a0: number, sweep: number, r: number, text: string): GuideLabel {
  const mid = a0 + sweep / 2;
  return { x, y, dx: Math.cos(mid) * (r + 17), dy: Math.sin(mid) * (r + 17), text };
}

/**
 * The measuring guides shown while a shape is being dragged out.
 *
 * Rectangle: its diagonal, and the two angles the diagonal makes with the top
 * and left sides at the top-left corner. A square is exactly 45° and 45°.
 * Oval: its two axes with width and height (a circle shows its diameter).
 * Line: the rectangle the line is the diagonal of, with the angle to the
 * horizontal and to the vertical at the line's start.
 *
 * `zoom` keeps the arcs a sensible size on screen. Returns null when the shape
 * is too small for guides to be anything but clutter.
 */
export function guidesFor(shape: ShapeKind, pts: number[], zoom: number): Guide | null {
  const [ax, ay, bx, by] = pts;

  if (shape === 'rect') {
    const x0 = Math.min(ax, bx), y0 = Math.min(ay, by), x1 = Math.max(ax, bx), y1 = Math.max(ay, by);
    const w = x1 - x0, h = y1 - y0;
    if (w * zoom < 8 || h * zoom < 8) return null;
    const d = Math.atan2(h, w);
    const r = Math.min(26, 0.4 * Math.min(w, h) * zoom);
    const exact = Math.abs(w - h) < 1e-6;
    const labels = [
      arcLabel(x0, y0, 0, d, r, fmtDeg(deg(d))),
      arcLabel(x0, y0, d, Math.PI / 2 - d, r, fmtDeg(90 - deg(d))),
      { x: x0 + w / 2, y: y1, dx: 0, dy: 14, text: `${len(w)} × ${len(h)}` },
    ];
    if (exact) labels.push({ x: x0 + w / 2, y: y0, dx: 0, dy: -14, text: 'square' });
    return {
      solid: [[x0, y0, x1, y1]], dashed: [],
      arcs: [{ x: x0, y: y0, a0: 0, sweep: d, r }, { x: x0, y: y0, a0: d, sweep: Math.PI / 2 - d, r }],
      labels, exact,
    };
  }

  if (shape === 'ellipse') {
    const x0 = Math.min(ax, bx), y0 = Math.min(ay, by), x1 = Math.max(ax, bx), y1 = Math.max(ay, by);
    const w = x1 - x0, h = y1 - y0, cx = x0 + w / 2, cy = y0 + h / 2;
    if (w * zoom < 8 || h * zoom < 8) return null;
    const exact = Math.abs(w - h) < 1e-6;
    const labels: GuideLabel[] = [];
    if (exact) {
      labels.push({ x: cx, y: cy, dx: 0, dy: -12, text: `⌀ ${len(w)}` }, { x: cx, y: y0, dx: 0, dy: -14, text: 'circle' });
    } else if (w * zoom >= 90 && h * zoom >= 60) {
      labels.push(
        { x: x1, y: cy, dx: -28, dy: -11, text: `W ${len(w)}` },
        { x: cx, y: y0, dx: 26, dy: 13, text: `H ${len(h)}` },
      );
    } else {
      labels.push({ x: cx, y: y1, dx: 0, dy: 14, text: `${len(w)} × ${len(h)}` });
    }
    return {
      solid: [[x0, cy, x1, cy], [cx, y0, cx, y1]], dashed: box(x0, y0, x1, y1),
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
    const step = Math.PI / 12;
    const exact = Math.abs(ang - Math.round(ang / step) * step) < 1e-6;
    return {
      solid: [], dashed: box(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)),
      arcs: [{ x: ax, y: ay, a0: toH, sweep: sweepH, r }, { x: ax, y: ay, a0: ang, sweep: sweepV, r }],
      labels: [
        arcLabel(ax, ay, toH, sweepH, r, fmtDeg(deg(Math.abs(sweepH)))),
        arcLabel(ax, ay, ang, sweepV, r, fmtDeg(deg(Math.abs(sweepV)))),
        { x: (ax + bx) / 2, y: (ay + by) / 2, dx: 0, dy: -13, text: len(l) },
      ],
      exact,
    };
  }

  return null;
}
