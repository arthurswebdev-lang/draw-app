import { isIcon, Selectable, ShapeItem } from '../types';
import { iconBBox } from './icon';
import { Pt } from './erase';
import { shapeItemBBox } from './shape';

/** An upright-or-turned box: its centre, half the width and height, and its turn in radians. */
export type OBox = { x: number; y: number; hw: number; hh: number; rotation: number };

/** Corner order everywhere: top-left, top-right, bottom-right, bottom-left. */
export const CORNER_SIGNS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const ROTATE_OFFSET = 30; // screen px above the top edge

const turn = (x: number, y: number, a: number): Pt => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

const isBoxShape = (s: ShapeItem) => s.shape === 'rect' || s.shape === 'ellipse';

function pointBounds(q: number[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < q.length; i += 2) {
    minX = Math.min(minX, q[i]); maxX = Math.max(maxX, q[i]);
    minY = Math.min(minY, q[i + 1]); maxY = Math.max(maxY, q[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}

/** The box the selection handles are drawn around. */
export function selectionBox(it: Selectable): OBox {
  if (isIcon(it)) return { x: it.x, y: it.y, hw: it.box / 2, hh: it.box / 2, rotation: it.rotation };
  const q = it.pts;
  if (isBoxShape(it)) {
    return {
      x: (q[0] + q[2]) / 2, y: (q[1] + q[3]) / 2,
      hw: Math.abs(q[2] - q[0]) / 2, hh: Math.abs(q[3] - q[1]) / 2, rotation: it.rotation ?? 0,
    };
  }
  const b = pointBounds(q);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, hw: (b.maxX - b.minX) / 2, hh: (b.maxY - b.minY) / 2, rotation: 0 };
}

export function boxHandles(b: OBox, zoom: number) {
  const corners = CORNER_SIGNS.map(([sx, sy]) => {
    const r = turn(sx * b.hw, sy * b.hh, b.rotation);
    return { x: b.x + r.x, y: b.y + r.y };
  });
  const top = turn(0, -b.hh, b.rotation);
  const out = turn(0, -(b.hh + ROTATE_OFFSET / zoom), b.rotation);
  return {
    corners,
    anchor: { x: b.x + top.x, y: b.y + top.y },
    rotate: { x: b.x + out.x, y: b.y + out.y },
  };
}

const pointsOf = (q: number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < q.length; i += 2) out.push({ x: q[i], y: q[i + 1] });
  return out;
};

/**
 * Everything the select tool can grab on an item. Corner squares resize it, the
 * round handle above turns it, and a line, polygon or open path also gets a dot on
 * each vertex so a single point can be dragged. A line has no corner squares:
 * its two end dots do that job, and bbox corners that are not on the line confuse.
 */
export function handlesFor(it: Selectable, zoom: number) {
  const h = boxHandles(selectionBox(it), zoom);
  if (isIcon(it) || isBoxShape(it)) return { ...h, vertices: [] as Pt[], box: true };
  if (it.shape === 'line') return { ...h, corners: [] as Pt[], vertices: pointsOf(it.pts), box: false };
  return { ...h, vertices: pointsOf(it.pts), box: true };
}

function withShape(s: ShapeItem, pts: number[], rotation = s.rotation): ShapeItem {
  const next: ShapeItem = { ...s, pts };
  if (rotation) next.rotation = rotation; else delete next.rotation;
  next.bbox = shapeItemBBox(next);
  return next;
}

/** The item moved by (dx, dy). */
export function translateItem(it: Selectable, dx: number, dy: number): Selectable {
  if (isIcon(it)) {
    const next = { ...it, x: it.x + dx, y: it.y + dy };
    next.bbox = iconBBox(next);
    return next;
  }
  return withShape(it, it.pts.map((v, i) => v + (i % 2 ? dy : dx)));
}

/** The item turned a further `delta` radians about its centre. */
export function rotateItem(it: Selectable, delta: number): Selectable {
  if (isIcon(it)) {
    const next = { ...it, rotation: it.rotation + delta };
    next.bbox = iconBBox(next);
    return next;
  }
  if (isBoxShape(it)) return withShape(it, it.pts, (it.rotation ?? 0) + delta);
  // A line or polygon is turned by moving its points, so it never carries a rotation.
  const c = selectionBox(it);
  const cos = Math.cos(delta), sin = Math.sin(delta);
  const pts = it.pts.map((v, i) => {
    if (i % 2) return 0; // filled in below
    const dx = v - c.x, dy = it.pts[i + 1] - c.y;
    return c.x + dx * cos - dy * sin;
  });
  for (let i = 1; i < pts.length; i += 2) {
    const dx = it.pts[i - 1] - c.x, dy = it.pts[i] - c.y;
    pts[i] = c.y + dx * sin + dy * cos;
  }
  return withShape(it, pts);
}

/**
 * Drags corner `corner` of a shape to world point p, the opposite corner staying
 * where it is. `uniform` keeps the proportions. `square` lets a rectangle or oval
 * that is nearly square snap to exactly square (the magnet).
 */
export function resizeShape(
  s: ShapeItem, corner: number, p: Pt,
  opts: { uniform?: boolean; square?: boolean; zoom?: number; min?: number } = {},
): ShapeItem {
  const b = selectionBox(s);
  const [sx, sy] = CORNER_SIGNS[corner];
  const off = turn(-sx * b.hw, -sy * b.hh, b.rotation);
  const A = { x: b.x + off.x, y: b.y + off.y };            // the corner that stays put
  const l = turn(p.x - A.x, p.y - A.y, -b.rotation);       // pointer, in the box's own axes
  const min = opts.min ?? 2;
  const w0 = 2 * b.hw, h0 = 2 * b.hh;
  let w = Math.max(min, l.x * sx), h = Math.max(min, l.y * sy);

  if (opts.uniform && w0 > 0 && h0 > 0) {
    const k = Math.max(w / w0, h / h0);
    w = w0 * k; h = h0 * k;
  } else if (opts.square && isBoxShape(s)) {
    const tol = Math.max(10 / (opts.zoom ?? 1), 0.06 * Math.max(w, h));
    if (Math.abs(w - h) <= tol) w = h = (w + h) / 2;
  }

  if (isBoxShape(s)) {
    const c = turn(sx * w / 2, sy * h / 2, b.rotation);
    const cx = A.x + c.x, cy = A.y + c.y;
    return withShape(s, [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]);
  }
  // Lines and polygons are never turned, so the box is upright: scale about A.
  const fx = w0 > 0 ? w / w0 : 1, fy = h0 > 0 ? h / h0 : 1;
  return withShape(s, s.pts.map((v, i) => (i % 2 ? A.y + (v - A.y) * fy : A.x + (v - A.x) * fx)));
}

/** A line, polygon or open path with vertex `index` dragged to p. */
export function moveVertex(s: ShapeItem, index: number, p: Pt): ShapeItem {
  const pts = [...s.pts];
  pts[2 * index] = p.x;
  pts[2 * index + 1] = p.y;
  return withShape(s, pts);
}

/** True when two items have the same geometry, so a tap that moved nothing is not an action. */
export function sameGeometry(a: Selectable, b: Selectable): boolean {
  if (isIcon(a) && isIcon(b)) return a.x === b.x && a.y === b.y && a.box === b.box && a.rotation === b.rotation;
  if (!isIcon(a) && !isIcon(b)) {
    return (a.rotation ?? 0) === (b.rotation ?? 0) && a.pts.length === b.pts.length && a.pts.every((v, i) => v === b.pts[i]);
  }
  return false;
}
