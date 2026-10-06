import { describe, it, expect } from 'vitest';
import { fmtDeg, guidesFor } from '../src/geometry/guides';

const deg = (r: number) => (r * 180) / Math.PI;

describe('formatting', () => {
  it('shows whole degrees plainly and others to one decimal', () => {
    expect(fmtDeg(45)).toBe('45°');
    expect(fmtDeg(44.98)).toBe('45°');
    expect(fmtDeg(38.66)).toBe('38.7°');
  });
});

describe('rectangle guides', () => {
  it('shows 45° and 45° for a square, and marks it exact', () => {
    const g = guidesFor('rect', [0, 0, 100, 100], 1)!;
    expect(g.exact).toBe(true);
    const angles = g.labels.filter(l => l.text.endsWith('°')).map(l => l.text);
    expect(angles).toEqual(['45°', '45°']);
    expect(g.labels.some(l => l.text === 'square')).toBe(true);
    expect(g.solid).toEqual([[0, 0, 100, 100]]);
  });
  it('gives two angles that add up to 90 for an oblong', () => {
    const g = guidesFor('rect', [0, 0, 200, 100], 1)!;
    expect(g.exact).toBe(false);
    const [a, b] = g.arcs.map(x => Math.abs(deg(x.sweep)));
    expect(a + b).toBeCloseTo(90, 9);
    expect(a).toBeCloseTo(26.565, 2);
    expect(g.labels.some(l => l.text === 'square')).toBe(false);
  });
  it('uses the top-left corner however the rectangle was dragged', () => {
    const g = guidesFor('rect', [200, 100, 0, 0], 1)!;
    expect(g.arcs[0].x).toBe(0);
    expect(g.arcs[0].y).toBe(0);
  });
  it('skips guides for a rectangle too small to read them', () => {
    expect(guidesFor('rect', [0, 0, 4, 4], 1)).toBeNull();
  });
});

describe('oval guides', () => {
  it('shows width and height for an oval', () => {
    const g = guidesFor('ellipse', [0, 0, 200, 100], 1)!;
    expect(g.exact).toBe(false);
    expect(g.labels.map(l => l.text)).toEqual(['W 200', 'H 100']);
    expect(g.solid.length).toBe(2); // the two axes
  });
  it('shows the diameter of a circle and marks it exact', () => {
    const g = guidesFor('ellipse', [0, 0, 120, 120], 1)!;
    expect(g.exact).toBe(true);
    expect(g.labels.map(l => l.text)).toEqual(['⌀ 120', 'circle']);
  });
});

describe('line guides', () => {
  it('reports the angle to the horizontal and to the vertical', () => {
    const g = guidesFor('line', [0, 0, 100, 100 * Math.tan((30 * Math.PI) / 180)], 1)!;
    const angles = g.labels.filter(l => l.text.endsWith('°')).map(l => l.text);
    expect(angles).toEqual(['30°', '60°']);
    expect(g.exact).toBe(true); // 30° is on a 15° step
  });
  it('is not exact off the steps', () => {
    expect(guidesFor('line', [0, 0, 100, 20], 1)!.exact).toBe(false);
  });
  it('measures from the start whichever way the line points', () => {
    const g = guidesFor('line', [100, 100, 0, 0], 1)!; // up and to the left
    const angles = g.labels.filter(l => l.text.endsWith('°')).map(l => l.text);
    expect(angles).toEqual(['45°', '45°']);
    expect(g.arcs[0].x).toBe(100);
  });
  it('labels the length', () => {
    const g = guidesFor('line', [0, 0, 30, 40], 1)!;
    expect(g.labels.some(l => l.text === '50')).toBe(true);
  });
  it('has nothing to say about a shape it has no guides for', () => {
    expect(guidesFor('polygon', [0, 0, 10, 0], 1)).toBeNull(); // not enough points
  });
});

describe('polygon guides', () => {
  const text = (g: ReturnType<typeof guidesFor>) => g!.labels.map(l => l.text);
  it('shows 90° at every corner of a square polygon, and marks it exact', () => {
    const g = guidesFor('polygon', [0, 0, 100, 0, 100, 100, 0, 100], 1)!;
    expect(text(g)).toEqual(['90°', '90°', '90°', '90°']);
    expect(g.exact).toBe(true);
  });
  it('gives a triangle inside angles that add up to 180', () => {
    const g = guidesFor('polygon', [0, 0, 100, 0, 30, 80], 1)!;
    const sum = text(g).reduce((t, x) => t + parseFloat(x), 0);
    expect(sum).toBeCloseTo(180, 0);
  });
  it('takes the long way round at a dent', () => {
    // An arrow-head shape: the notch at (50,40) is a reflex corner (> 180).
    const g = guidesFor('polygon', [0, 0, 100, 0, 50, 40, 100, 100, 0, 100], 1)!;
    const reflex = text(g).map(parseFloat).filter(a => a > 180);
    expect(reflex.length).toBe(1);
    // Inside angles of any simple polygon add up to (n - 2) * 180.
    expect(text(g).reduce((t, x) => t + parseFloat(x), 0)).toBeCloseTo(3 * 180, 0);
  });
  it('skips the two ends of an open path', () => {
    const g = guidesFor('polyline', [0, 0, 100, 0, 100, 100], 1)!;
    expect(text(g)).toEqual(['90°']);
  });
});

describe('turned rectangle guides', () => {
  it('turns the angle arcs with the rectangle', () => {
    const upright = guidesFor('rect', [0, 0, 200, 100], 1, 0)!;
    const turned = guidesFor('rect', [0, 0, 200, 100], 1, Math.PI / 2)!;
    expect(turned.arcs[0].a0).toBeCloseTo(upright.arcs[0].a0 + Math.PI / 2, 9);
    // The top-left corner moves round the centre (100, 50): (0,0) -> (150, -50).
    expect(turned.arcs[0].x).toBeCloseTo(150, 6);
    expect(turned.arcs[0].y).toBeCloseTo(-50, 6);
    // The angles themselves do not change.
    expect(turned.labels.slice(0, 2).map(l => l.text)).toEqual(upright.labels.slice(0, 2).map(l => l.text));
  });
});
