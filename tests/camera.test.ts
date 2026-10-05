import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToScreen, zoomAt } from '../src/camera';

describe('camera', () => {
  const cam = { x: 100, y: -50, zoom: 2 };
  it('round trips', () => {
    const w = screenToWorld(cam, 30, 40);
    const s = worldToScreen(cam, w.x, w.y);
    expect(s.x).toBeCloseTo(30);
    expect(s.y).toBeCloseTo(40);
  });
  it('zoomAt keeps the point under the cursor', () => {
    const before = screenToWorld(cam, 200, 150);
    const next = zoomAt(cam, 200, 150, 1.5);
    const after = screenToWorld(next, 200, 150);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it('clamps zoom', () => {
    expect(zoomAt(cam, 0, 0, 1000).zoom).toBe(8);
    expect(zoomAt(cam, 0, 0, 0.0001).zoom).toBe(0.1);
  });
});
