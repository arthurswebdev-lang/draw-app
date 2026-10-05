import { STRIDE } from '../types';

export type PathCmd =
  | { t: 'dot'; x: number; y: number }
  | { t: 'M'; x: number; y: number }
  | { t: 'L'; x: number; y: number }
  | { t: 'Q'; cx: number; cy: number; x: number; y: number };

/** Quadratic midpoint smoothing: samples are control points, midpoints are curve points. */
export function smooth(points: Float32Array): PathCmd[] {
  const n = points.length / STRIDE;
  const px = (i: number) => points[i * STRIDE];
  const py = (i: number) => points[i * STRIDE + 1];
  if (n === 0) return [];
  if (n === 1) return [{ t: 'dot', x: px(0), y: py(0) }];
  if (n === 2) return [{ t: 'M', x: px(0), y: py(0) }, { t: 'L', x: px(1), y: py(1) }];
  const cmds: PathCmd[] = [{ t: 'M', x: px(0), y: py(0) }];
  for (let i = 1; i < n - 1; i++) {
    cmds.push({
      t: 'Q',
      cx: px(i), cy: py(i),
      x: (px(i) + px(i + 1)) / 2, y: (py(i) + py(i + 1)) / 2,
    });
  }
  cmds.push({ t: 'L', x: px(n - 1), y: py(n - 1) });
  return cmds;
}

/** Straight segments through every point: for strokes that were cut and must not move. */
export function polyline(points: Float32Array): PathCmd[] {
  const n = points.length / STRIDE;
  if (n === 0) return [];
  if (n === 1) return [{ t: 'dot', x: points[0], y: points[1] }];
  const cmds: PathCmd[] = [{ t: 'M', x: points[0], y: points[1] }];
  for (let i = 1; i < n; i++) cmds.push({ t: 'L', x: points[i * STRIDE], y: points[i * STRIDE + 1] });
  return cmds;
}

export function toPath2D(cmds: PathCmd[], size: number): Path2D {
  const p = new Path2D();
  for (const c of cmds) {
    if (c.t === 'dot') {
      p.moveTo(c.x + size / 2, c.y);
      p.arc(c.x, c.y, size / 2, 0, Math.PI * 2);
    } else if (c.t === 'M') p.moveTo(c.x, c.y);
    else if (c.t === 'L') p.lineTo(c.x, c.y);
    else p.quadraticCurveTo(c.cx, c.cy, c.x, c.y);
  }
  return p;
}
