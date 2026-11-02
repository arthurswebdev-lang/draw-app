import { describe, it, expect } from 'vitest';
import { pasteCopy } from '../src/state/clipboard';
import { IconItem, Item, ShapeItem } from '../src/types';
import { shapeItemBBox } from '../src/geometry/shape';

const rect = (): ShapeItem => {
  const s: ShapeItem = {
    id: 'r', shape: 'rect', pts: [0, 0, 100, 50], color: '#000', fill: null, size: 2,
    bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, createdAt: 10,
  };
  s.bbox = shapeItemBBox(s);
  return s;
};
const icon = (): IconItem => ({
  id: 'i', kind: 'resistor', color: '#000', size: 2, x: 50, y: 50, box: 40, rotation: 0,
  bbox: { minX: 30, minY: 30, maxX: 70, maxY: 70 }, createdAt: 20,
});

describe('pasteCopy', () => {
  it('makes a new item on top, moved a little, leaving the original alone', () => {
    const r = rect();
    const items: Item[] = [r, icon()];
    const c = pasteCopy(r, items, 1, () => 0) as ShapeItem; // angle 0, shortest distance
    expect(c.id).not.toBe(r.id);
    expect(c.createdAt).toBeGreaterThan(20);
    expect(c.pts).toEqual([24, 0, 124, 50]);
    expect(c.bbox.minX).toBeCloseTo(r.bbox.minX + 24);
    expect(r.pts).toEqual([0, 0, 100, 50]);
  });
  it('keeps the offset the same on screen at any zoom', () => {
    const c = pasteCopy(icon(), [icon()], 2, () => 0) as IconItem;
    expect(c.x).toBeCloseTo(62);
  });
  it('puts two pastes in different places', () => {
    const i = icon();
    const a = pasteCopy(i, [i], 1) as IconItem;
    const b = pasteCopy(i, [i, a], 1) as IconItem;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0);
    expect(b.createdAt).toBeGreaterThan(a.createdAt);
  });
});
