import { describe, it, expect } from 'vitest';
import { reorder } from '../src/state/zorder';
import { Item } from '../src/types';

const item = (id: string, createdAt: number) => ({ id, createdAt } as Item);
/** Applies a change the way the renderer does, then returns the ids bottom to top. */
const apply = (items: Item[], c: { removed: Item[]; added: Item[] }) =>
  [...items.filter(i => !c.removed.some(r => r.id === i.id)), ...c.added]
    .sort((a, b) => a.createdAt - b.createdAt).map(i => i.id);

describe('reorder', () => {
  const four = [item('a', 10), item('b', 20), item('c', 30), item('d', 40)];

  it('brings an item forward one step', () => {
    expect(apply(four, reorder(four, 'b', 1)!)).toEqual(['a', 'c', 'b', 'd']);
  });
  it('sends an item back one step', () => {
    expect(apply(four, reorder(four, 'c', -1)!)).toEqual(['a', 'c', 'b', 'd']);
  });
  it('does nothing at either end', () => {
    expect(reorder(four, 'd', 1)).toBeNull();
    expect(reorder(four, 'a', -1)).toBeNull();
    expect(reorder(four, 'nope', 1)).toBeNull();
  });
  it('changes only the item that moved, and leaves it a unique time', () => {
    const c = reorder(four, 'a', 1)!;
    expect(c.removed.map(i => i.id)).toEqual(['a']);
    expect(c.added[0].createdAt).toBe(25); // between b (20) and c (30)
    expect(four.some(i => i.createdAt === c.added[0].createdAt)).toBe(false);
  });
  it('goes past the very top and bottom with room to spare', () => {
    expect(apply(four, reorder(four, 'c', 1)!)).toEqual(['a', 'b', 'd', 'c']);
    expect(reorder(four, 'c', 1)!.added[0].createdAt).toBeGreaterThan(30);
    expect(reorder(four, 'b', -1)!.added[0].createdAt).toBeLessThan(20);
  });
  it('steps over a whole group that shares one time, and stays unique', () => {
    const tied = [item('a', 10), item('x', 20), item('y', 20), item('z', 20), item('w', 30)];
    const c = reorder(tied, 'a', 1)!;
    expect(apply(tied, c)).toEqual(['x', 'y', 'z', 'a', 'w']);
    expect(c.added[0].createdAt).toBe(25);
    const down = reorder(tied, 'w', -1)!;
    expect(apply(tied, down)).toEqual(['a', 'w', 'x', 'y', 'z']);
  });
  it('keeps going when moved repeatedly in the same direction', () => {
    let items = four;
    for (let n = 0; n < 3; n++) { const c = reorder(items, 'a', 1)!; items = [...items.filter(i => i.id !== 'a'), c.added[0]].sort((p, q) => p.createdAt - q.createdAt); }
    expect(items.map(i => i.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(reorder(items, 'a', 1)).toBeNull();
  });
});
