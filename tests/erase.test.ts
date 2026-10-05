import { describe, it, expect } from 'vitest';
import { eraseSegment, segSegDistSq, strokeTouches } from '../src/geometry/erase';

const line = (...xy: number[][]) => new Float32Array(xy.flatMap(([x, y]) => [x, y, 0.5]));
const xs = (p: Float32Array) => Array.from({ length: p.length / 3 }, (_, i) => p[i * 3]);

describe('segSegDistSq', () => {
  it('is 0 for crossing segments', () => {
    expect(segSegDistSq({ x: 0, y: -1 }, { x: 0, y: 1 }, -1, 0, 1, 0)).toBe(0);
  });
  it('measures gap between parallel segments', () => {
    expect(segSegDistSq({ x: 0, y: 0 }, { x: 4, y: 0 }, 0, 3, 4, 3)).toBe(9);
  });
});

describe('strokeTouches', () => {
  const s = line([0, 0], [100, 0]);
  it('hits when the eraser disc reaches the ink', () => {
    expect(strokeTouches(s, 2, { x: 50, y: 5 }, { x: 50, y: 5 }, 4.5)).toBe(true);
    expect(strokeTouches(s, 2, { x: 50, y: 5 }, { x: 50, y: 5 }, 3.9)).toBe(false);
  });
});

describe('eraseSegment', () => {
  const s = line([0, 0], [100, 0]);
  const c = { x: 50, y: 0 };
  it('returns null when nothing is touched', () => {
    expect(eraseSegment(s, 2, { x: 50, y: 40 }, { x: 50, y: 40 }, 5, 1)).toBeNull();
  });
  it('splits a line in two and leaves a gap', () => {
    const pieces = eraseSegment(s, 2, c, c, 5, 1)!;
    expect(pieces.length).toBe(2);
    const left = xs(pieces[0]), right = xs(pieces[1]);
    expect(Math.max(...left)).toBeLessThan(50 - 5);
    expect(Math.min(...right)).toBeGreaterThan(50 + 5);
    expect(left[0]).toBe(0);
    expect(right[right.length - 1]).toBe(100);
  });
  it('removes everything when fully covered', () => {
    expect(eraseSegment(s, 2, { x: -10, y: 0 }, { x: 110, y: 0 }, 5, 1)).toEqual([]);
  });
  it('trims an end without splitting', () => {
    const pieces = eraseSegment(s, 2, { x: 0, y: 0 }, { x: 20, y: 0 }, 5, 1)!;
    expect(pieces.length).toBe(1);
    expect(Math.min(...xs(pieces[0]))).toBeGreaterThan(25);
  });
});
