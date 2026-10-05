import { describe, it, expect } from 'vitest';
import { simplify } from '../src/geometry/simplify';

const pts = (...xy: number[][]) => new Float32Array(xy.flatMap(([x, y]) => [x, y, 0.5]));

describe('simplify', () => {
  it('removes collinear points but keeps endpoints', () => {
    const out = simplify(pts([0, 0], [1, 0], [2, 0], [3, 0]), 0.1);
    expect(out.length / 3).toBe(2);
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(3);
  });
  it('epsilon 0 changes nothing', () => {
    const p = pts([0, 0], [1, 0], [2, 0]);
    expect(simplify(p, 0)).toBe(p);
  });
  it('keeps a zigzag', () => {
    const p = pts([0, 0], [1, 5], [2, 0], [3, 5], [4, 0]);
    expect(simplify(p, 0.5).length / 3).toBe(5);
  });
});
