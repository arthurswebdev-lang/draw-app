import { describe, it, expect } from 'vitest';
import { createBoard, sig } from '../sync-server/board.mjs';
import { decodeItem, encodeChange, encodeItem, normalizeUrl, reconcile } from '../src/sync/wire';
import { IconItem, Item, Stroke } from '../src/types';

const stroke = (id: string, createdAt: number, x = 0): Stroke => ({
  id, color: '#000', size: 2, createdAt,
  points: new Float32Array([x, 0, 0.5, x + 10.1, 3.3, 0.5]),
  bbox: { minX: x, minY: 0, maxX: x + 11, maxY: 4 },
});
const icon = (id: string, createdAt: number, x = 50): IconItem => ({
  id, kind: 'lamp', color: '#000', size: 2, x, y: 50, box: 40, rotation: 0,
  bbox: { minX: x - 20, minY: 30, maxX: x + 20, maxY: 70 }, createdAt,
});
const ids = (l: Item[]) => l.map(i => i.id).sort();

describe('wire format', () => {
  it('round-trips a stroke and keeps the same fingerprint', () => {
    const s = stroke('a', 1);
    const back = decodeItem(JSON.parse(JSON.stringify(encodeItem(s)))) as Stroke;
    expect(back.points).toBeInstanceOf(Float32Array);
    expect(Array.from(back.points)).toEqual(Array.from(s.points));
    expect(sig(encodeItem(back))).toBe(sig(encodeItem(s)));
  });
  it('sends removed items as ids only', () => {
    expect(encodeChange({ removed: [stroke('a', 1)], added: [] })).toEqual({ removed: ['a'], added: [] });
  });
});

describe('normalizeUrl', () => {
  it('turns what is typed into a wss address', () => {
    expect(normalizeUrl('my-mac.local:8443')).toBe('wss://my-mac.local:8443');
    expect(normalizeUrl(' https://my-mac.local:9000/ ')).toBe('wss://my-mac.local:9000');
    expect(normalizeUrl('my-mac.local')).toBe('wss://my-mac.local:8443');
    expect(normalizeUrl('ws://localhost:8443')).toBe('ws://localhost:8443');
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('a b')).toBeNull();
  });
});

describe('server board', () => {
  it('keeps deleted items from coming back through a merge, but not through an undo', () => {
    const b = createBoard();
    b.applyChange({ removed: [], added: [encodeItem(stroke('a', 1))] });
    b.applyChange({ removed: ['a'], added: [] });
    expect(b.want(['a', 'b'])).toEqual(['b']);
    b.applyChange({ removed: [], added: [encodeItem(stroke('a', 1))] }); // undo of the delete
    expect(b.ids()).toEqual(['a']);
  });
  it('sends a device only what it lacks or holds a different version of', () => {
    const b = createBoard();
    const a = encodeItem(stroke('a', 1)), c = encodeItem(icon('c', 2));
    b.applyChange({ removed: [], added: [a, c] });
    expect(b.diffFor({ a: sig(a), c: 'old' }).map(i => i.id)).toEqual(['c']);
    expect(createBoard(JSON.parse(JSON.stringify(b))).ids()).toEqual(['a', 'c']); // survives saving
  });
});

describe('reconcile', () => {
  it('merges two boards on the first connect', () => {
    const local = [stroke('mine', 1)];
    const c = reconcile(local, { ids: ['theirs'], items: [encodeItem(icon('theirs', 2))], want: ['mine'] }, []);
    expect(c.removed).toEqual([]);
    expect(ids(c.added)).toEqual(['theirs']);
  });
  it('removes what another device deleted, and takes newer versions', () => {
    const a = icon('a', 1, 10), b = stroke('b', 2);
    const moved = icon('a', 1, 99);
    const c = reconcile([a, b], { ids: ['a'], items: [encodeItem(moved)], want: [] }, []);
    expect(ids(c.removed)).toEqual(['a', 'b']);
    expect((c.added[0] as IconItem).x).toBe(99);
  });
  it('changes nothing when the device is already up to date', () => {
    const a = icon('a', 1);
    expect(reconcile([a], { ids: ['a'], items: [], want: [] }, [])).toEqual({ removed: [], added: [] });
  });
  it('keeps changes made after the hello was sent', () => {
    const a = icon('a', 1), late = stroke('late', 5);
    const c = reconcile([a, late], { ids: [], items: [], want: [] }, [encodeChange({ removed: [], added: [late] })]);
    expect(ids(c.removed)).toEqual(['a']); // deleted elsewhere
    expect(c.added).toEqual([]); // `late` stays as it is
  });
});

describe('follow mode view', () => {
  it('shows the same area on a screen of another shape, centred', async () => {
    const { fitView, viewOf } = await import('../src/sync/wire');
    // iPad 1180×820 at zoom 2, looking at x 9600.., y 5500..
    const v = viewOf({ x: 9600, y: 5500, zoom: 2 }, 1180, 820);
    expect(v).toEqual({ x: 9600, y: 5500, w: 590, h: 410 });
    // Mac 1440×900: zoom limited by height (900/410), the middle stays the same.
    const c = fitView(v, 1440, 900);
    expect(c.zoom).toBeCloseTo(900 / 410);
    expect(c.x + 1440 / c.zoom / 2).toBeCloseTo(9600 + 295);
    expect(c.y + 900 / c.zoom / 2).toBeCloseTo(5500 + 205);
    // The whole area is visible.
    expect(c.x).toBeLessThanOrEqual(9600);
    expect(c.x + 1440 / c.zoom).toBeGreaterThanOrEqual(9600 + 590);
  });
});
