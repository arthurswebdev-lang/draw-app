import { describe, expect, it } from 'vitest';
import { hitIcon, iconBBox, iconCorners, iconHandles } from '../src/geometry/icon';
import { ICON_DEFS, iconDef, iconsIn, SPHERES } from '../src/icons/library';
import { IconItem } from '../src/types';

const at = (over: Partial<IconItem> = {}): IconItem => ({
  id: 'i', kind: 'lamp', color: '#000', size: 2,
  x: 100, y: 100, box: 40, rotation: 0,
  bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, createdAt: 1, ...over,
});

describe('the box around an icon', () => {
  it('is the icon plus half its outline when upright', () => {
    expect(iconBBox(at())).toEqual({ minX: 79, minY: 79, maxX: 121, maxY: 121 });
  });

  it('grows when the icon is turned, or a corner would be cut off', () => {
    const turned = iconBBox(at({ rotation: Math.PI / 4 }));
    const upright = iconBBox(at());
    expect(turned.maxX - turned.minX).toBeGreaterThan(upright.maxX - upright.minX);
    // A square turned 45 degrees spans its diagonal: 40 * sqrt(2) plus the outline.
    expect(turned.maxX - turned.minX).toBeCloseTo(40 * Math.SQRT2 + 2, 5);
  });

  it('comes back to the same box after a quarter turn', () => {
    expect(iconBBox(at({ rotation: Math.PI / 2 }))).toEqual(iconBBox(at()));
  });
});

describe('hitting an icon', () => {
  it('takes a point inside and refuses one outside', () => {
    // box 40 means 20 either side of the centre.
    expect(hitIcon(at(), 100, 100)).toBe(true);
    expect(hitIcon(at(), 119, 100)).toBe(true);
    expect(hitIcon(at(), 121, 100)).toBe(false);
  });

  it('follows the icon round when it is turned', () => {
    // A point off the upright corner falls inside once the square turns under it.
    const corner = { x: 100 + 19, y: 100 + 19 };
    expect(hitIcon(at(), corner.x, corner.y)).toBe(true);
    expect(hitIcon(at({ rotation: Math.PI / 4 }), corner.x, corner.y)).toBe(false);
    expect(hitIcon(at({ rotation: Math.PI / 4 }), 100, 100 + 25)).toBe(true);
  });

  it('lets a pad catch a thin icon a finger just missed', () => {
    expect(hitIcon(at(), 100, 124)).toBe(false);
    expect(hitIcon(at(), 100, 124, 6)).toBe(true);
  });
});

describe('the handles', () => {
  it('puts the turn handle clear of the top edge', () => {
    const { rotate } = iconHandles(at(), 1);
    expect(rotate.x).toBeCloseTo(100, 5);
    expect(rotate.y).toBeCloseTo(80 - 30, 5);
  });

  it('keeps the turn handle over the top of the drawing once turned', () => {
    // Turned a half circle, "above the icon" is below it on screen.
    const { rotate } = iconHandles(at({ rotation: Math.PI }), 1);
    expect(rotate.y).toBeCloseTo(120 + 30, 5);
  });

  it('holds the handle the same distance away however far the board is zoomed', () => {
    const near = iconHandles(at(), 1).rotate;
    const far = iconHandles(at(), 3).rotate;
    expect(100 - near.y).toBeCloseTo(50, 5);
    // Three times the zoom, a third of the world distance: the same on screen.
    expect(100 - far.y).toBeCloseTo(20 + 10, 5);
  });

  it('gives a corner for each corner', () => {
    expect(iconCorners(at())).toHaveLength(4);
  });
});

describe('the library', () => {
  it('has no duplicate ids, since a placed icon stores only its id', () => {
    const ids = ICON_DEFS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws every icon inside the 0..100 box', () => {
    for (const def of ICON_DEFS) {
      const numbers = def.d.join(' ').match(/-?\d+(\.\d+)?/g) ?? [];
      for (const n of numbers) {
        expect(Math.abs(Number(n)), `${def.id} strays outside the box`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('starts every subpath with a move, or it draws from wherever the last one ended', () => {
    for (const def of ICON_DEFS) {
      for (const d of def.d) expect(d[0], `${def.id}`).toMatch(/[Mm]/);
    }
  });

  it('uses only path commands, so a typo cannot silently draw nothing', () => {
    for (const def of ICON_DEFS) {
      for (const d of def.d) {
        expect(d.replace(/[\d\s.,-]/g, ''), `${def.id}`).toMatch(/^[MmLlHhVvCcSsQqTtAaZz]*$/);
      }
    }
  });

  it('files every icon under a sphere and a tab that exist', () => {
    for (const def of ICON_DEFS) {
      const sphere = SPHERES.find(s => s.id === def.sphere);
      expect(sphere, `${def.id} has an unknown sphere`).toBeDefined();
      expect(sphere!.groups).toContain(def.group);
    }
  });

  it('leaves no tab empty', () => {
    for (const s of SPHERES) {
      for (const g of s.groups) expect(iconsIn(s.id, g).length, `${s.id}/${g}`).toBeGreaterThan(0);
    }
  });

  it('finds an icon by id and shrugs at one it does not know', () => {
    expect(iconDef('lamp')?.label).toBe('Lamp');
    expect(iconDef('nope')).toBeUndefined();
  });
});
