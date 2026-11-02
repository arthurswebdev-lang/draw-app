import { describe, it, expect } from 'vitest';
import { hitText, measureText, retext, textAnchor, textBBox, textTouches } from '../src/geometry/text';
import { rotateItem, sameGeometry, selectionBox, translateItem } from '../src/geometry/selection';
import { isIcon, isShape, isText, TextItem } from '../src/types';

const make = (text: string, rotation = 0): TextItem => {
  const t: TextItem = {
    id: 't', text: '', color: '#000', fontSize: 20, x: 0, y: 0, w: 10, h: 26, rotation,
    bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, createdAt: 1,
  };
  return retext(t, text, 20, { x: 100, y: 50 });
};

describe('text geometry', () => {
  it('is told apart from icons, shapes and strokes', () => {
    const t = make('hi');
    expect(isText(t)).toBe(true);
    expect(isIcon(t)).toBe(false);
    expect(isShape(t)).toBe(false);
  });
  it('grows from its top-left corner as you type', () => {
    const a = make('hi');
    const b = retext(a, 'hello there\nsecond line');
    expect(textAnchor(b).x).toBeCloseTo(100);
    expect(textAnchor(b).y).toBeCloseTo(50);
    expect(b.w).toBeGreaterThan(a.w);
    expect(b.h).toBeCloseTo(2 * a.h);
  });
  it('keeps the top-left corner of a turned text too', () => {
    const a = rotateItem(make('hi'), Math.PI / 6) as TextItem;
    const anchor = textAnchor(a);
    const b = retext(a, 'a much longer line');
    expect(textAnchor(b).x).toBeCloseTo(anchor.x);
    expect(textAnchor(b).y).toBeCloseTo(anchor.y);
  });
  it('an empty line still has height', () => {
    expect(measureText('', 20).h).toBeGreaterThan(0);
    expect(measureText('a\n\nb', 20).h).toBeCloseTo(3 * measureText('a', 20).h);
  });
  it('is hit inside its box, turned or not, and the box bounds it', () => {
    const t = make('hello');
    expect(hitText(t, t.x, t.y)).toBe(true);
    expect(hitText(t, t.x + t.w, t.y)).toBe(false);
    const r = rotateItem(t, Math.PI / 2) as TextItem;
    expect(hitText(r, r.x, r.y + t.w / 2 - 1)).toBe(true);
    const b = textBBox(r);
    expect(b.maxY - b.minY).toBeCloseTo(t.w);
  });
  it('moves, turns and is touched by the eraser like an object', () => {
    const t = make('hello');
    const m = translateItem(t, 10, 5) as TextItem;
    expect(m.x).toBe(t.x + 10);
    expect(m.bbox.minX).toBeCloseTo(t.bbox.minX + 10);
    expect(sameGeometry(t, m)).toBe(false);
    expect(selectionBox(t)).toMatchObject({ hw: t.w / 2, hh: t.h / 2 });
    expect(textTouches(t, { x: t.x - 500, y: t.y }, { x: t.x + 500, y: t.y }, 2)).toBe(true);
    expect(textTouches(t, { x: t.x - 500, y: t.y + 200 }, { x: t.x + 500, y: t.y + 200 }, 2)).toBe(false);
  });
});
