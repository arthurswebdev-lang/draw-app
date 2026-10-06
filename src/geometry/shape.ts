import { BBox, ShapeItem } from '../types';
import { distToSegmentSq } from './simplify';
import { FLAT_EPS, Pt, segSegDistSq } from './erase';

type Shapeish = Pick<ShapeItem, 'shape' | 'pts'>;

export function shapeBBox(pts: number[], size: number): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
  }
  const r = size / 2;
  return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
}

/** Bounds of a whole shape, allowing for a turned rectangle or oval and the line width. */
export function shapeItemBBox(s: ShapeItem): BBox {
  const r = s.rotation ?? 0;
  if (r && (s.shape === 'rect' || s.shape === 'ellipse')) {
    const q = s.pts;
    const hw = Math.abs(q[2] - q[0]) / 2, hh = Math.abs(q[3] - q[1]) / 2;
    const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2;
    const c = Math.cos(r), sn = Math.sin(r);
    const ex = s.shape === 'rect' ? hw * Math.abs(c) + hh * Math.abs(sn) : Math.hypot(hw * c, hh * sn);
    const ey = s.shape === 'rect' ? hw * Math.abs(sn) + hh * Math.abs(c) : Math.hypot(hw * sn, hh * c);
    const pad = s.size / 2;
    return { minX: cx - ex - pad, minY: cy - ey - pad, maxX: cx + ex + pad, maxY: cy + ey + pad };
  }
  return shapeBBox(s.pts, s.size);
}

/** The outline as a Path2D, for drawing. */
export function buildShapePath(s: Shapeish): Path2D {
  const p = new Path2D();
  const q = s.pts;
  if (s.shape === 'line') {
    p.moveTo(q[0], q[1]);
    p.lineTo(q[2], q[3]);
  } else if (s.shape === 'rect') {
    p.rect(Math.min(q[0], q[2]), Math.min(q[1], q[3]), Math.abs(q[2] - q[0]), Math.abs(q[3] - q[1]));
  } else if (s.shape === 'ellipse') {
    const rx = Math.abs(q[2] - q[0]) / 2, ry = Math.abs(q[3] - q[1]) / 2;
    p.ellipse((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, rx, ry, 0, 0, Math.PI * 2);
  } else {
    p.moveTo(q[0], q[1]);
    for (let i = 2; i < q.length; i += 2) p.lineTo(q[i], q[i + 1]);
    if (s.shape === 'polygon') p.closePath();
  }
  return p;
}

/** Turns [x, y, x, y, ...] about (cx, cy). */
function turnAbout(xy: number[], cx: number, cy: number, a: number): number[] {
  if (!a) return xy;
  const c = Math.cos(a), s = Math.sin(a);
  const out: number[] = [];
  for (let i = 0; i < xy.length; i += 2) {
    const dx = xy[i] - cx, dy = xy[i + 1] - cy;
    out.push(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
  return out;
}

/** The outline as straight segments [x, y, x, y, ...], closed shapes ending where they began. */
export function shapeCenterline(s: Shapeish & { rotation?: number }): number[] {
  const q = s.pts;
  if (s.shape === 'line' || s.shape === 'polyline') return [...q];
  if (s.shape === 'polygon') return [...q, q[0], q[1]];
  if (s.rotation) {
    // A turned rectangle or oval: build it upright, then turn it about its centre.
    const upright = shapeCenterline({ shape: s.shape, pts: s.pts });
    return turnAbout(upright, (q[0] + q[2]) / 2, (q[1] + q[3]) / 2, s.rotation);
  }
  if (s.shape === 'rect') {
    const [x0, y0, x1, y1] = q;
    return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  }
  // Oval: enough segments that none strays more than FLAT_EPS from the true curve.
  const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2;
  const rx = Math.abs(q[2] - q[0]) / 2, ry = Math.abs(q[3] - q[1]) / 2;
  const big = Math.max(rx, ry, FLAT_EPS * 2);
  const n = Math.min(1440, Math.max(24, Math.ceil(Math.PI / Math.acos(1 - FLAT_EPS / big))));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
  }
  return out;
}

export function pointInShape(s: Shapeish & { rotation?: number }, x: number, y: number): boolean {
  const q = s.pts;
  if (s.rotation && (s.shape === 'rect' || s.shape === 'ellipse')) {
    // Turn the point the opposite way and test against the upright shape.
    const [rx, ry] = turnAbout([x, y], (q[0] + q[2]) / 2, (q[1] + q[3]) / 2, -s.rotation);
    return pointInShape({ shape: s.shape, pts: s.pts }, rx, ry);
  }
  if (s.shape === 'rect') {
    return x >= Math.min(q[0], q[2]) && x <= Math.max(q[0], q[2])
      && y >= Math.min(q[1], q[3]) && y <= Math.max(q[1], q[3]);
  }
  if (s.shape === 'ellipse') {
    const rx = Math.abs(q[2] - q[0]) / 2, ry = Math.abs(q[3] - q[1]) / 2;
    if (rx === 0 || ry === 0) return false;
    return ((x - (q[0] + q[2]) / 2) / rx) ** 2 + ((y - (q[1] + q[3]) / 2) / ry) ** 2 <= 1;
  }
  if (s.shape === 'polygon') {
    let inside = false;
    for (let i = 0, j = q.length - 2; i < q.length; j = i, i += 2) {
      const xi = q[i], yi = q[i + 1], xj = q[j], yj = q[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  return false;
}

/**
 * Does an eraser sweeping from a to b (a disc of `radius`) touch the shape?
 * Its outline counts, and so does a filled inside, which is part of what you see.
 */
export function shapeTouches(s: ShapeItem, a: Pt, b: Pt, radius: number): boolean {
  const xy = shapeCenterline(s);
  const reach2 = (radius + s.size / 2) ** 2;
  for (let i = 0; i < xy.length - 2; i += 2) {
    if (segSegDistSq(a, b, xy[i], xy[i + 1], xy[i + 2], xy[i + 3]) <= reach2) return true;
  }
  if (xy.length === 2 && distToSegmentSq(xy[0], xy[1], a.x, a.y, b.x, b.y) <= reach2) return true;
  if (s.fill && (pointInShape(s, a.x, a.y) || pointInShape(s, b.x, b.y))) return true;
  return false;
}

/**
 * Magnet for a rectangle or oval being dragged out from (x1, y1) to (x2, y2).
 * Close to square, it snaps to exactly square. Returns the corner to use.
 */
export function snapBox(x1: number, y1: number, x2: number, y2: number, tol: number, force = false): [number, number] {
  const w = x2 - x1, h = y2 - y1;
  const aw = Math.abs(w), ah = Math.abs(h);
  if (!force && Math.abs(aw - ah) > Math.max(tol, 0.06 * Math.max(aw, ah))) return [x2, y2];
  const side = force ? Math.max(aw, ah) : (aw + ah) / 2;
  return [x1 + (w < 0 ? -side : side), y1 + (h < 0 ? -side : side)];
}

/** Magnet for a line: close to a multiple of 15 degrees, it snaps to it. */
export function snapLine(x1: number, y1: number, x2: number, y2: number, force = false): [number, number] {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [x2, y2];
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 12;
  const nearest = Math.round(angle / step) * step;
  if (!force && Math.abs(angle - nearest) > (3 * Math.PI) / 180) return [x2, y2];
  return [x1 + Math.cos(nearest) * len, y1 + Math.sin(nearest) * len];
}
