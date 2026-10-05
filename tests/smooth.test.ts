import { describe, it, expect } from 'vitest';
import { smooth } from '../src/geometry/smooth';

const pts = (...xy: number[][]) => new Float32Array(xy.flatMap(([x, y]) => [x, y, 0.5]));

describe('smooth', () => {
  it('handles 0, 1, 2 points', () => {
    expect(smooth(pts())).toEqual([]);
    expect(smooth(pts([1, 2]))).toEqual([{ t: 'dot', x: 1, y: 2 }]);
    expect(smooth(pts([0, 0], [4, 4]))).toEqual([{ t: 'M', x: 0, y: 0 }, { t: 'L', x: 4, y: 4 }]);
  });
  it('uses samples as controls and midpoints as ends', () => {
    const c = smooth(pts([0, 0], [2, 0], [2, 2], [4, 2]));
    expect(c[0]).toEqual({ t: 'M', x: 0, y: 0 });
    expect(c[1]).toEqual({ t: 'Q', cx: 2, cy: 0, x: 2, y: 1 });
    expect(c[2]).toEqual({ t: 'Q', cx: 2, cy: 2, x: 3, y: 2 });
    expect(c[3]).toEqual({ t: 'L', x: 4, y: 2 });
  });
});
