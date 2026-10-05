import { STRIDE } from '../types';

function distToSegmentSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/** Ramer-Douglas-Peucker on a flat [x,y,p,...] array. Endpoints are always kept. */
export function simplify(points: Float32Array, epsilon: number): Float32Array {
  const n = points.length / STRIDE;
  if (n <= 2 || epsilon <= 0) return points;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const eps2 = epsilon * epsilon;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    const ax = points[s * STRIDE], ay = points[s * STRIDE + 1];
    const bx = points[e * STRIDE], by = points[e * STRIDE + 1];
    for (let i = s + 1; i < e; i++) {
      const d = distToSegmentSq(points[i * STRIDE], points[i * STRIDE + 1], ax, ay, bx, by);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx !== -1 && maxD > eps2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(points[i * STRIDE], points[i * STRIDE + 1], points[i * STRIDE + 2]);
  }
  return new Float32Array(out);
}
