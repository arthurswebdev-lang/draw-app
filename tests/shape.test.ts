import { describe, it, expect } from 'vitest';
import { pointInShape, shapeBBox, shapeCenterline, shapeTouches, snapBox, snapLine } from '../src/geometry/shape';
import { ShapeItem } from '../src/types';

const shape = (over: Partial<ShapeItem>): ShapeItem => ({
  id: 's', shape: 'rect', pts: [0, 0, 100, 60], color: '#000', fill: null, size: 2,
  bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, createdAt: 1, ...over,
});

describe('snapBox', () => {
  it('snaps a nearly square drag to exactly square', () => {
    const [x, y] = snapBox(0, 0, 100, 94, 10);
    expect(Math.abs(x)).toBeCloseTo(Math.abs(y), 9);
  });
  it('leaves a clearly oblong drag alone', () => {
    expect(snapBox(0, 0, 100, 40, 10)).toEqual([100, 40]);
  });
  it('keeps the direction of the drag', () => {
    const [x, y] = snapBox(0, 0, -100, -96, 10);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    expect(Math.abs(x)).toBeCloseTo(Math.abs(y), 9);
  });
  it('can be forced', () => {
    const [x, y] = snapBox(0, 0, 100, 30, 1, true);
    expect([x, y]).toEqual([100, 100]);
  });
  it('treats a tiny drag as square rather than a sliver', () => {
    const [x, y] = snapBox(0, 0, 4, 2, 10);
    expect(x).toBeCloseTo(y, 9);
  });
});

describe('snapLine', () => {
  it('snaps near-horizontal to horizontal and keeps the length', () => {
    const [x, y] = snapLine(0, 0, 100, 3);
    expect(y).toBeCloseTo(0, 9);
    expect(x).toBeCloseTo(Math.hypot(100, 3), 6);
  });
  it('snaps near 45 degrees', () => {
    const [x, y] = snapLine(0, 0, 100, 98);
    expect(x).toBeCloseTo(y, 6);
  });
  it('leaves other angles alone', () => {
    expect(snapLine(0, 0, 100, 20)).toEqual([100, 20]);
  });
});

describe('outlines', () => {
  it('closes a rectangle and a polygon', () => {
    const r = shapeCenterline(shape({}));
    expect(r.slice(0, 2)).toEqual(r.slice(-2));
    const p = shapeCenterline(shape({ shape: 'polygon', pts: [0, 0, 10, 0, 5, 8] }));
    expect(p).toEqual([0, 0, 10, 0, 5, 8, 0, 0]);
  });
  it('leaves an open polyline open', () => {
    expect(shapeCenterline(shape({ shape: 'polyline', pts: [0, 0, 10, 0, 5, 8] }))).toEqual([0, 0, 10, 0, 5, 8]);
  });
  it('keeps every point of an oval on the curve', () => {
    const xy = shapeCenterline(shape({ shape: 'ellipse', pts: [0, 0, 200, 100] }));
    for (let i = 0; i < xy.length; i += 2) {
      expect(((xy[i] - 100) / 100) ** 2 + ((xy[i + 1] - 50) / 50) ** 2).toBeCloseTo(1, 6);
    }
  });
  it('grows the box by half the line width', () => {
    expect(shapeBBox([0, 0, 100, 60], 4)).toEqual({ minX: -2, minY: -2, maxX: 102, maxY: 62 });
  });
});

describe('points inside', () => {
  it('knows the inside of a rectangle, an oval and a polygon', () => {
    expect(pointInShape(shape({}), 50, 30)).toBe(true);
    expect(pointInShape(shape({}), 150, 30)).toBe(false);
    const oval = shape({ shape: 'ellipse', pts: [0, 0, 100, 100] });
    expect(pointInShape(oval, 50, 50)).toBe(true);
    expect(pointInShape(oval, 5, 5)).toBe(false); // inside the box, outside the curve
    const tri = shape({ shape: 'polygon', pts: [0, 0, 100, 0, 50, 80] });
    expect(pointInShape(tri, 50, 20)).toBe(true);
    expect(pointInShape(tri, 5, 70)).toBe(false);
  });
});

describe('touching with an eraser', () => {
  const a = { x: 50, y: 30 };
  it('misses the hollow middle of an unfilled rectangle', () => {
    expect(shapeTouches(shape({}), a, a, 5)).toBe(false);
  });
  it('hits its outline', () => {
    const edge = { x: 50, y: 0 };
    expect(shapeTouches(shape({}), edge, edge, 5)).toBe(true);
  });
  it('hits the middle of a filled one, since the fill is part of what you see', () => {
    expect(shapeTouches(shape({ fill: '#f00' }), a, a, 5)).toBe(true);
  });
});
