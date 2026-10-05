import { BBox, IconItem } from '../types';

/** Smallest an icon may be scaled to, in world units. */
export const MIN_ICON = 12;
/** How close a pointer must land to a handle to grab it, in screen pixels. */
export const HANDLE_HIT = 16;
/** How far the turn handle sits above the top edge, in screen pixels. */
const ROTATE_OFFSET = 30;

type Pt = { x: number; y: number };

const turn = (x: number, y: number, a: number): Pt => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

/** The four corners of the icon box in world units, clockwise from top-left. */
export function iconCorners(i: Pick<IconItem, 'x' | 'y' | 'box' | 'rotation'>): Pt[] {
  const h = i.box / 2;
  return ([[-h, -h], [h, -h], [h, h], [-h, h]] as const).map(([cx, cy]) => {
    const r = turn(cx, cy, i.rotation);
    return { x: i.x + r.x, y: i.y + r.y };
  });
}

/** Bounds of the turned box, grown by half the outline so nothing is clipped. */
export function iconBBox(i: Pick<IconItem, 'x' | 'y' | 'box' | 'rotation' | 'size'>): BBox {
  const h = i.box / 2;
  const c = Math.abs(Math.cos(i.rotation)), s = Math.abs(Math.sin(i.rotation));
  const reach = h * (c + s) + i.size / 2;
  return { minX: i.x - reach, minY: i.y - reach, maxX: i.x + reach, maxY: i.y + reach };
}

/** Is world point (wx, wy) inside the icon's box? `pad` widens the box on every side. */
export function hitIcon(i: IconItem, wx: number, wy: number, pad = 0): boolean {
  const l = turn(wx - i.x, wy - i.y, -i.rotation);
  const h = i.box / 2 + pad;
  return Math.abs(l.x) <= h && Math.abs(l.y) <= h;
}

/**
 * Handle positions in world units: the four corners, the point on the top edge
 * the turn line starts from, and the turn handle itself.
 *
 * The turn handle's distance is a fixed number of screen pixels, so it is divided
 * by the zoom to keep it clear of the icon however far the board is zoomed.
 */
export function iconHandles(i: IconItem, zoom: number) {
  const h = i.box / 2;
  const top = turn(0, -h, i.rotation);
  const out = turn(0, -(h + ROTATE_OFFSET / zoom), i.rotation);
  return {
    corners: iconCorners(i),
    anchor: { x: i.x + top.x, y: i.y + top.y },
    rotate: { x: i.x + out.x, y: i.y + out.y },
  };
}
