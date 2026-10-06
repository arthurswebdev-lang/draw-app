import { describe, expect, it } from 'vitest';
import { snapRotation } from '../src/geometry/icon';

const rad = (d: number) => (d * Math.PI) / 180;

describe('snapRotation', () => {
  it('keeps exact steps', () => {
    for (const d of [0, 90, 180]) {
      const r = snapRotation(rad(d));
      expect(r.snapped).toBe(false);
      expect(r.degrees).toBe(d);
      expect(r.rotation).toBeCloseTo(rad(d), 10);
    }
  });

  it('snaps near a multiple of 45', () => {
    const a = snapRotation(rad(88));
    expect(a.snapped).toBe(true);
    expect(a.rotation).toBeCloseTo(Math.PI / 2, 10);
    expect(a.degrees).toBe(90);
    const b = snapRotation(rad(93));
    expect(b.snapped).toBe(true);
    expect(b.degrees).toBe(90);
    expect(snapRotation(rad(50)).degrees).toBe(45);
  });

  it('snaps to a multiple of 15 only within 3 degrees', () => {
    const a = snapRotation(rad(16.5));
    expect(a.snapped).toBe(true);
    expect(a.degrees).toBe(15);
    expect(a.rotation).toBeCloseTo(rad(15), 10);
    expect(snapRotation(rad(73)).degrees).toBe(75);
    expect(snapRotation(rad(19)).snapped).toBe(false);
  });

  it('leaves other angles free', () => {
    const r = snapRotation(rad(22));
    expect(r.snapped).toBe(false);
    expect(r.rotation).toBe(rad(22));
    expect(r.degrees).toBe(22);
  });

  it('keeps the same turn for negative rotation', () => {
    const r = snapRotation(rad(-88));
    expect(r.snapped).toBe(true);
    expect(r.rotation).toBeCloseTo(-Math.PI / 2, 10);
    expect(r.degrees).toBe(270);
  });

  it('keeps the same turn beyond 360 degrees', () => {
    const a = snapRotation(rad(358));
    expect(a.rotation).toBeCloseTo(2 * Math.PI, 10);
    expect(a.degrees).toBe(0);
    const b = snapRotation(2 * Math.PI + 0.02);
    expect(b.snapped).toBe(true);
    expect(b.rotation).toBeCloseTo(2 * Math.PI, 10);
    expect(b.degrees).toBe(0);
  });

  it('force snaps to the nearest 15 degrees', () => {
    expect(snapRotation(rad(22), true).degrees).toBe(15);
    expect(snapRotation(rad(23), true).degrees).toBe(30);
    const r = snapRotation(rad(22), true);
    expect(r.snapped).toBe(true);
    expect(r.rotation).toBeCloseTo(rad(15), 10);
  });

  it('reports degrees in [0, 360)', () => {
    for (const d of [-400, -1, 0, 10, 359.9, 360, 725]) {
      for (const force of [false, true]) {
        const { degrees } = snapRotation(rad(d), force);
        expect(degrees).toBeGreaterThanOrEqual(0);
        expect(degrees).toBeLessThan(360);
      }
    }
  });
});
