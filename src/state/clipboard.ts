import { translateItem } from '../geometry/selection';
import { Item, Selectable } from '../types';

/** How far a pasted copy lands from the original, in screen px. */
const MIN_OFFSET = 24;
const MAX_OFFSET = 56;

/**
 * A new copy of `it` for pasting: its own id, on top of everything, and moved a
 * short way in a random direction so it is not hidden under the original. The
 * distance is in screen px, so it looks the same at any zoom. Because the direction
 * is random, pasting twice gives two copies you can both see.
 */
export function pasteCopy(it: Selectable, items: Item[], zoom: number, rand: () => number = Math.random): Selectable {
  const angle = rand() * Math.PI * 2;
  const dist = (MIN_OFFSET + rand() * (MAX_OFFSET - MIN_OFFSET)) / zoom;
  const moved = translateItem(it, Math.cos(angle) * dist, Math.sin(angle) * dist);
  // Strictly after the top item, so the copy is drawn on top and its time is unique.
  const top = items.reduce((m, i) => Math.max(m, i.createdAt), -Infinity);
  return { ...moved, id: crypto.randomUUID(), createdAt: Math.max(Date.now(), top + 1) };
}
