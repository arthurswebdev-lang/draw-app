import { Change, Item } from '../types';

/**
 * Moves one item a step in front of, or behind, its neighbour in the stacking order.
 *
 * What is drawn on top is decided by `createdAt` (the list is sorted by it), so
 * "moving" an item means giving it a new `createdAt` that falls in the right gap.
 * Only that one item changes. The new value is the midpoint between the two items
 * it must sit between, so it is strictly between them and unique: items that
 * happen to share a time (pieces of an erased stroke do) would otherwise change
 * places at random when the board is loaded back from the database.
 *
 * `items` must already be in drawing order. Returns null when the item is not
 * found or is already at that end.
 */
export function reorder(items: Item[], id: string, dir: 1 | -1): Change | null {
  const at = items.findIndex(i => i.id === id);
  if (at === -1) return null;
  const cur = items[at];
  let createdAt: number;

  if (dir === 1) {
    const next = items[at + 1];
    if (!next) return null;
    // Land just after `next` and anything that shares its time.
    const base = next.createdAt;
    const after = items.slice(at + 2).find(i => i.createdAt > base);
    createdAt = after ? (base + after.createdAt) / 2 : base + 1;
  } else {
    const prev = items[at - 1];
    if (!prev) return null;
    // Land just before `prev` and anything that shares its time.
    const base = prev.createdAt;
    let before: Item | undefined;
    for (let j = at - 2; j >= 0; j--) {
      if (items[j].createdAt < base) { before = items[j]; break; }
    }
    createdAt = before ? (before.createdAt + base) / 2 : base - 1;
  }

  return { removed: [cur], added: [{ ...cur, createdAt }] };
}
