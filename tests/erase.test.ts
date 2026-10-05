import { describe, it, expect } from 'vitest';
import { capsuleSpan, eraseSegment, segSegDistSq, strokeTouches } from '../src/geometry/erase';

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

describe('capsuleSpan', () => {
  const a = { x: 50, y: 0 };
  it('finds where a line enters and leaves the eraser', () => {
    const [t0, t1] = capsuleSpan(0, 0, 100, 0, a, a, 6)!;
    expect(t0 * 100).toBeCloseTo(44, 6);
    expect(t1 * 100).toBeCloseTo(56, 6);
  });
  it('covers the whole stretch between the ends of a dragged eraser', () => {
    const [t0, t1] = capsuleSpan(0, 0, 100, 0, { x: 20, y: 3 }, { x: 70, y: 3 }, 6)!;
    expect(t0 * 100).toBeLessThan(20);
    expect(t1 * 100).toBeGreaterThan(70);
  });
  it('returns null when the line misses', () => {
    expect(capsuleSpan(0, 0, 100, 0, { x: 50, y: 20 }, { x: 60, y: 20 }, 6)).toBeNull();
  });
});

describe('eraseSegment', () => {
  const s = line([0, 0], [100, 0]);
  const c = { x: 50, y: 0 };
  it('returns null when nothing is touched', () => {
    expect(eraseSegment(s, 2, { x: 50, y: 40 }, { x: 50, y: 40 }, 5)).toBeNull();
  });
  it('cuts a line exactly at the eraser edge', () => {
    // radius 5 plus half the stroke width 1 = 6 either side of x = 50.
    const pieces = eraseSegment(s, 2, c, c, 5)!;
    expect(pieces.length).toBe(2);
    expect(xs(pieces[0])).toEqual([0, 44]);
    expect(xs(pieces[1])).toEqual([56, 100]);
  });
  it('removes everything when fully covered', () => {
    expect(eraseSegment(s, 2, { x: -10, y: 0 }, { x: 110, y: 0 }, 5)).toEqual([]);
  });
  it('trims an end without splitting', () => {
    const pieces = eraseSegment(s, 2, { x: 0, y: 0 }, { x: 20, y: 0 }, 5)!;
    expect(pieces.length).toBe(1);
    expect(xs(pieces[0])).toEqual([26, 100]);
  });
  it('leaves every point away from the eraser exactly where it was', () => {
    const wave = line([0, 0], [10, 8], [20, -6], [30, 9], [40, -7], [50, 5], [60, 0], [70, 12]);
    const pieces = eraseSegment(wave, 2, { x: 5, y: 4 }, { x: 5, y: 4 }, 3, true)!;
    const tail = pieces[pieces.length - 1];
    // Everything from (20, -6) on is untouched, bit for bit.
    expect(Array.from(tail).slice(-18)).toEqual(Array.from(wave).slice(-18));
  });
  it('does not drift when a stroke is erased again and again', () => {
    const wave = line([0, 0], [10, 8], [20, -6], [30, 9], [40, -7], [50, 5]);
    let pieces: Float32Array[] = [wave];
    let poly = false;
    let firstTail: number[] = [];
    for (let k = 0; k < 40; k++) {
      // A small eraser nibbling near the start; the far end must stay put.
      const p = { x: 2 + (k % 5) * 0.3, y: 0 };
      const next: Float32Array[] = [];
      for (const piece of pieces) {
        const r = eraseSegment(piece, 2, p, p, 1.5, poly);
        if (r) next.push(...r); else next.push(piece);
      }
      pieces = next;
      poly = true;
      if (k === 0) firstTail = Array.from(pieces[pieces.length - 1]).slice(-30);
    }
    const tail = Array.from(pieces[pieces.length - 1]).slice(-30);
    // After the first cut turns the curve into a polyline, later cuts change nothing far away.
    expect(tail).toEqual(firstTail);
    expect(tail.slice(-3)).toEqual([50, 5, 0.5]);
  });
});
