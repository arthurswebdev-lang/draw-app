import { STRIDE } from '../types';
import { distToSegmentSq, simplify } from './simplify';
import { smooth } from './smooth';

export type Pt = { x: number; y: number };

function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsCross(a: Pt, b: Pt, cx: number, cy: number, dx: number, dy: number) {
  const d1 = cross(cx, cy, dx, dy, a.x, a.y);
  const d2 = cross(cx, cy, dx, dy, b.x, b.y);
  const d3 = cross(a.x, a.y, b.x, b.y, cx, cy);
  const d4 = cross(a.x, a.y, b.x, b.y, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Squared distance between segment a-b and segment (cx,cy)-(dx,dy). */
export function segSegDistSq(a: Pt, b: Pt, cx: number, cy: number, dx: number, dy: number) {
  if (segmentsCross(a, b, cx, cy, dx, dy)) return 0;
  return Math.min(
    distToSegmentSq(a.x, a.y, cx, cy, dx, dy),
    distToSegmentSq(b.x, b.y, cx, cy, dx, dy),
    distToSegmentSq(cx, cy, a.x, a.y, b.x, b.y),
    distToSegmentSq(dx, dy, a.x, a.y, b.x, b.y),
  );
}

/** Does the eraser path a-b (a disc of `radius`) touch the ink of this stroke? */
export function strokeTouches(points: Float32Array, size: number, a: Pt, b: Pt, radius: number) {
  const reach2 = (radius + size / 2) ** 2;
  const n = points.length / STRIDE;
  if (n === 1) return distToSegmentSq(points[0], points[1], a.x, a.y, b.x, b.y) <= reach2;
  for (let i = 0; i < n - 1; i++) {
    const j = i * STRIDE;
    if (segSegDistSq(a, b, points[j], points[j + 1], points[j + STRIDE], points[j + STRIDE + 1]) <= reach2) {
      return true;
    }
  }
  return false;
}

/** Turn the smoothed curve into a dense list [x, y, x, y, ...] with spacing <= tol. */
export function flatten(points: Float32Array, tol: number): number[] {
  const out: number[] = [];
  let cx = 0, cy = 0;
  for (const c of smooth(points)) {
    if (c.t === 'dot') {
      out.push(c.x, c.y);
    } else if (c.t === 'M') {
      out.push(c.x, c.y);
      cx = c.x; cy = c.y;
    } else if (c.t === 'L') {
      const n = Math.max(1, Math.ceil(Math.hypot(c.x - cx, c.y - cy) / tol));
      for (let k = 1; k <= n; k++) out.push(cx + ((c.x - cx) * k) / n, cy + ((c.y - cy) * k) / n);
      cx = c.x; cy = c.y;
    } else {
      const est = Math.hypot(c.cx - cx, c.cy - cy) + Math.hypot(c.x - c.cx, c.y - c.cy);
      const n = Math.max(2, Math.ceil(est / tol));
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        out.push(u * u * cx + 2 * u * t * c.cx + t * t * c.x, u * u * cy + 2 * u * t * c.cy + t * t * c.y);
      }
      cx = c.x; cy = c.y;
    }
  }
  return out;
}

function toPoints(xy: number[]): Float32Array {
  const out = new Float32Array((xy.length / 2) * STRIDE);
  for (let i = 0, j = 0; i < xy.length; i += 2, j += STRIDE) {
    out[j] = xy[i]; out[j + 1] = xy[i + 1]; out[j + 2] = 0.5;
  }
  return out;
}

/**
 * Remove the ink that the eraser path a-b covers.
 * Returns null if nothing changes, or the remaining pieces (maybe none).
 */
export function eraseSegment(
  points: Float32Array, size: number, a: Pt, b: Pt, radius: number, tol: number,
): Float32Array[] | null {
  if (!strokeTouches(points, size, a, b, radius)) return null;
  const reach2 = (radius + size / 2) ** 2;
  const flat = flatten(points, tol);
  const pieces: Float32Array[] = [];
  let run: number[] = [];
  let erasedAny = false;
  const flush = () => {
    if (run.length) pieces.push(simplify(toPoints(run), tol * 0.25));
    run = [];
  };
  for (let i = 0; i < flat.length; i += 2) {
    if (distToSegmentSq(flat[i], flat[i + 1], a.x, a.y, b.x, b.y) <= reach2) {
      erasedAny = true;
      flush();
    } else {
      run.push(flat[i], flat[i + 1]);
    }
  }
  flush();
  return erasedAny ? pieces : null;
}
