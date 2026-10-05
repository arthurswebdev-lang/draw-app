import { STRIDE } from '../types';
import { distToSegmentSq } from './simplify';
import { polyline, smooth } from './smooth';

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

/** How far a flattened curve may stray from the true curve, in world units. */
export const FLAT_EPS = 0.02;

/** The stroke's centerline as [x, y, x, y, ...], exact for a polyline, flattened for a smooth stroke. */
export function centerline(points: Float32Array, poly: boolean): number[] {
  const out: number[] = [];
  let cx = 0, cy = 0;
  for (const c of poly ? polyline(points) : smooth(points)) {
    if (c.t === 'dot') {
      out.push(c.x, c.y);
    } else if (c.t === 'M') {
      out.push(c.x, c.y);
      cx = c.x; cy = c.y;
    } else if (c.t === 'L') {
      out.push(c.x, c.y);
      cx = c.x; cy = c.y;
    } else {
      // Quadratic curve error is |A - 2C + B| / (4 n^2) for n pieces.
      const bend = Math.hypot(cx - 2 * c.cx + c.x, cy - 2 * c.cy + c.y);
      const n = Math.max(1, Math.ceil(Math.sqrt(bend / (4 * FLAT_EPS))));
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

type Span = [number, number];

/** Part of s + t*d (0 <= t <= 1) that lies inside the disc, or null. */
function discSpan(sx: number, sy: number, dx: number, dy: number, c: Pt, r: number): Span | null {
  const A = dx * dx + dy * dy;
  if (A === 0) return null;
  const fx = sx - c.x, fy = sy - c.y;
  const B = 2 * (dx * fx + dy * fy);
  const disc = B * B - 4 * A * (fx * fx + fy * fy - r * r);
  if (disc < 0) return null;
  const q = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - q) / (2 * A)), t1 = Math.min(1, (-B + q) / (2 * A));
  return t0 < t1 ? [t0, t1] : null;
}

/** Clip t-range to {t : lo <= p0 + t*dp <= hi}. Returns false if nothing is left. */
function clip(span: Span, p0: number, dp: number, lo: number, hi: number): boolean {
  if (dp === 0) return p0 >= lo && p0 <= hi;
  let t0 = (lo - p0) / dp, t1 = (hi - p0) / dp;
  if (t0 > t1) [t0, t1] = [t1, t0];
  span[0] = Math.max(span[0], t0);
  span[1] = Math.min(span[1], t1);
  return span[0] < span[1];
}

/**
 * The part of segment s->e that lies inside the eraser capsule (path a-b, radius r).
 * A capsule is convex, so the answer is a single span of t, or null.
 */
export function capsuleSpan(sx: number, sy: number, ex: number, ey: number, a: Pt, b: Pt, r: number): Span | null {
  const dx = ex - sx, dy = ey - sy;
  const spans: Span[] = [];
  const da = discSpan(sx, sy, dx, dy, a, r);
  if (da) spans.push(da);
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L > 0) {
    const db = discSpan(sx, sy, dx, dy, b, r);
    if (db) spans.push(db);
    // The strip between the two end discs, in the capsule's own axes.
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const span: Span = [0, 1];
    const u0 = (sx - a.x) * ux + (sy - a.y) * uy, du = dx * ux + dy * uy;
    const v0 = -(sx - a.x) * uy + (sy - a.y) * ux, dv = -dx * uy + dy * ux;
    if (clip(span, u0, du, 0, L) && clip(span, v0, dv, -r, r)) spans.push(span);
  }
  if (!spans.length) return null;
  const t0 = Math.min(...spans.map(x => x[0])), t1 = Math.max(...spans.map(x => x[1]));
  return t1 - t0 > 1e-9 ? [t0, t1] : null;
}

/**
 * Subtract the eraser capsule from a stroke's centerline.
 *
 * Returns null if nothing changes, or the pieces that remain (maybe none), each
 * an exact polyline. Points outside the eraser are copied untouched, and a cut
 * lands exactly where the line crosses the eraser edge, so nothing else moves.
 * `poly` says the points are already a polyline and must not be smoothed.
 */
export function eraseSegment(
  points: Float32Array, size: number, a: Pt, b: Pt, radius: number, poly = false,
): Float32Array[] | null {
  if (!strokeTouches(points, size, a, b, radius)) return null;
  const R = radius + size / 2;
  const line = centerline(points, poly);
  const n = line.length / 2;

  if (n === 1) {
    return distToSegmentSq(line[0], line[1], a.x, a.y, b.x, b.y) <= R * R ? [] : null;
  }

  const pieces: Float32Array[] = [];
  let run: number[] = [];
  let cut = false;
  const flush = () => {
    if (run.length >= 4) pieces.push(toPoints(run));
    run = [];
  };

  for (let i = 0; i < n - 1; i++) {
    const sx = line[2 * i], sy = line[2 * i + 1], ex = line[2 * i + 2], ey = line[2 * i + 3];
    const span = capsuleSpan(sx, sy, ex, ey, a, b, R);
    if (!span) {
      if (!run.length) run.push(sx, sy);
      run.push(ex, ey);
      continue;
    }
    cut = true;
    const [t0, t1] = span;
    if (t0 > 0) {
      if (!run.length) run.push(sx, sy);
      run.push(sx + (ex - sx) * t0, sy + (ey - sy) * t0);
    }
    flush();
    if (t1 < 1) run = [sx + (ex - sx) * t1, sy + (ey - sy) * t1, ex, ey];
  }
  flush();
  return cut ? pieces : null;
}
