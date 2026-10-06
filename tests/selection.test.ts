import { describe, it, expect } from 'vitest';
import {
  handlesFor, moveVertex, resizeShape, rotateItem, sameGeometry, selectionBox, translateItem,
} from '../src/geometry/selection';
import { pointInShape, shapeCenterline, shapeItemBBox, shapeTouches } from '../src/geometry/shape';
import { ShapeItem } from '../src/types';

const shape = (over: Partial<ShapeItem>): ShapeItem => ({
  id: 's', shape: 'rect', pts: [0, 0, 100, 60], color: '#000', fill: null, size: 2,
  bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, createdAt: 1, ...over,
});
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('what can be grabbed', () => {
  it('gives a rectangle four corners and no vertices', () => {
    const h = handlesFor(shape({}), 1);
    expect(h.corners.length).toBe(4);
    expect(h.vertices.length).toBe(0);
  });
  it('gives a line its two ends and no corners', () => {
    const h = handlesFor(shape({ shape: 'line', pts: [0, 0, 80, 40] }), 1);
    expect(h.corners.length).toBe(0);
    expect(h.vertices).toEqual([{ x: 0, y: 0 }, { x: 80, y: 40 }]);
  });
  it('gives a polygon a dot on every vertex and the corner squares too', () => {
    const h = handlesFor(shape({ shape: 'polygon', pts: [0, 0, 10, 0, 5, 8] }), 1);
    expect(h.vertices.length).toBe(3);
    expect(h.corners.length).toBe(4);
  });
  it('boxes a polygon by its extent and a rectangle by its corners', () => {
    expect(selectionBox(shape({ shape: 'polygon', pts: [0, 0, 10, 0, 5, 8] }))).toEqual({ x: 5, y: 4, hw: 5, hh: 4, rotation: 0 });
    expect(selectionBox(shape({}))).toEqual({ x: 50, y: 30, hw: 50, hh: 30, rotation: 0 });
  });
});

describe('moving', () => {
  it('moves every point and the bounds', () => {
    const m = translateItem(shape({}), 10, -5) as ShapeItem;
    expect(m.pts).toEqual([10, -5, 110, 55]);
    expect(m.bbox.minX).toBe(9);
  });
});

describe('turning', () => {
  it('turns a rectangle by a rotation, leaving its box alone', () => {
    const r = rotateItem(shape({}), Math.PI / 2) as ShapeItem;
    expect(r.pts).toEqual([0, 0, 100, 60]);
    expect(r.rotation).toBeCloseTo(Math.PI / 2, 9);
    // Turned a quarter, it is 60 wide and 100 tall, about the same centre.
    expect(r.bbox.maxX - r.bbox.minX).toBeCloseTo(60 + 2, 6);
    expect(r.bbox.maxY - r.bbox.minY).toBeCloseTo(100 + 2, 6);
  });
  it('turns a line by moving its points, about its centre', () => {
    const l = rotateItem(shape({ shape: 'line', pts: [0, 0, 10, 0] }), Math.PI / 2) as ShapeItem;
    close(l.pts, [5, -5, 5, 5]);
    expect(l.rotation).toBeUndefined();
  });
  it('turns a polygon a full circle back to itself', () => {
    const p = shape({ shape: 'polygon', pts: [0, 0, 10, 0, 5, 8] });
    close((rotateItem(p, Math.PI * 2) as ShapeItem).pts, p.pts);
  });
  it('hits and bounds a turned rectangle correctly', () => {
    const r = shape({ pts: [0, 0, 100, 20], rotation: Math.PI / 2, fill: '#f00' });
    // Centre (50,10); turned a quarter it stands up: about 20 wide, 100 tall.
    expect(pointInShape(r, 50, -30)).toBe(true);
    expect(pointInShape(r, 90, 10)).toBe(false);
    const b = shapeItemBBox(r);
    expect(b.maxY - b.minY).toBeCloseTo(100 + 2, 6);
    expect(shapeTouches(r, { x: 50, y: -42 }, { x: 50, y: -42 }, 3)).toBe(true);
    const xy = shapeCenterline(r);
    expect(xy.length).toBe(10);
  });
});

describe('resizing a shape', () => {
  it('keeps the opposite corner fixed', () => {
    const r = resizeShape(shape({}), 2, { x: 200, y: 100 }) as ShapeItem; // drag bottom-right
    expect(r.pts).toEqual([0, 0, 200, 100]);
    const tl = resizeShape(shape({}), 0, { x: -50, y: -20 }) as ShapeItem; // drag top-left
    expect(tl.pts).toEqual([-50, -20, 100, 60]);
  });
  it('keeps the proportions when uniform', () => {
    const r = resizeShape(shape({}), 2, { x: 200, y: 70 }, { uniform: true }) as ShapeItem;
    const w = r.pts[2] - r.pts[0], h = r.pts[3] - r.pts[1];
    expect(w / h).toBeCloseTo(100 / 60, 6);
  });
  it('snaps a nearly square rectangle to square with the magnet', () => {
    const r = resizeShape(shape({ pts: [0, 0, 100, 100] }), 2, { x: 140, y: 136 }, { square: true, zoom: 1 }) as ShapeItem;
    expect(r.pts[2] - r.pts[0]).toBeCloseTo(r.pts[3] - r.pts[1], 9);
  });
  it('keeps the anchor corner in place on a turned rectangle', () => {
    const turned = shape({ pts: [0, 0, 100, 60], rotation: Math.PI / 6 });
    const before = shapeCenterline(turned);
    const grown = resizeShape(turned, 2, { x: 140, y: 120 }) as ShapeItem;   // drag bottom-right
    const after = shapeCenterline(grown);
    // The first outline point is the top-left corner: the anchor.
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });
  it('scales a polygon about the opposite corner', () => {
    const p = shape({ shape: 'polygon', pts: [0, 0, 10, 0, 10, 10, 0, 10] });
    const r = resizeShape(p, 2, { x: 20, y: 30 }) as ShapeItem;
    expect(r.pts).toEqual([0, 0, 20, 0, 20, 30, 0, 30]);
  });
});

describe('vertices and sameness', () => {
  it('moves one vertex and leaves the rest', () => {
    const p = shape({ shape: 'polygon', pts: [0, 0, 10, 0, 5, 8] });
    expect((moveVertex(p, 2, { x: 5, y: 20 }) as ShapeItem).pts).toEqual([0, 0, 10, 0, 5, 20]);
  });
  it('knows an unmoved item from a moved one', () => {
    const a = shape({});
    expect(sameGeometry(a, { ...a })).toBe(true);
    expect(sameGeometry(a, translateItem(a, 1, 0))).toBe(false);
  });
});
