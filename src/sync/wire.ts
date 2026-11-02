import type { WireChange, WireItem } from '../../sync-server/board.mjs';
import { Change, Item } from '../types';

export type { WireChange, WireItem };

/**
 * Items as JSON. Only a pen stroke needs work: its points are a Float32Array,
 * which JSON cannot hold, so they travel as a plain number array. Values that came
 * from a Float32Array survive the round trip exactly, so an item encodes to the
 * same JSON (and the same `sig`) on every device.
 */
export function encodeItem(i: Item): WireItem {
  if ('points' in i) return { ...i, points: Array.from(i.points) } as unknown as WireItem;
  return i as unknown as WireItem;
}

export function decodeItem(w: WireItem): Item {
  if (Array.isArray(w.points)) return { ...w, points: Float32Array.from(w.points as number[]) } as unknown as Item;
  return w as unknown as Item;
}

/** Removed items travel as ids only: the receiver has its own copy. */
export const encodeChange = (c: Change): WireChange => ({
  removed: c.removed.map(i => i.id),
  added: c.added.map(encodeItem),
});

/**
 * Turns what the user typed into a WebSocket address. "my-mac.local:8443",
 * "https://my-mac.local:8443/" and "wss://my-mac.local:8443" all give
 * "wss://my-mac.local:8443". No port means the server's default, 8443. A typed
 * ws:// is kept, for local development.
 */
export function normalizeUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  let scheme = 'wss';
  const m = /^(wss?|https?):\/\//i.exec(s);
  if (m) {
    const given = m[1].toLowerCase();
    scheme = given === 'ws' || given === 'http' ? 'ws' : 'wss';
    s = s.slice(m[0].length);
  }
  s = s.replace(/\/+$/, '');
  if (!s || /[\s/]/.test(s)) return null;
  if (!/:\d+$/.test(s) && !s.endsWith(']')) s += ':8443';
  return `${scheme}://${s}`;
}

/** The address without "wss://", as it is shown in the dialog. */
export const displayUrl = (url: string) => url.replace(/^wss:\/\//, '');

/**
 * What the board should become when the server's answer to "hello" arrives,
 * as a change to apply to this device.
 *
 * - `ids` is every item the server holds; `items` are the ones this device lacked
 *   or held an older version of.
 * - `want` are this device's items the server has never seen: kept, and uploaded.
 * - `replay` are changes made here after the hello was sent. The server has not
 *   got them yet, so the result keeps them.
 */
export function reconcile(
  local: Item[],
  state: { ids: string[]; items: WireItem[]; want: string[] },
  replay: WireChange[],
): Change {
  const mine = new Map(local.map(i => [i.id, i]));
  const target = new Map<string, Item>();
  for (const id of state.ids) {
    const have = mine.get(id);
    if (have) target.set(id, have);
  }
  for (const w of state.items) target.set(w.id, decodeItem(w));
  for (const id of state.want) {
    const have = mine.get(id);
    if (have) target.set(id, have);
  }
  for (const c of replay) {
    for (const id of c.removed) target.delete(id);
    for (const w of c.added) target.set(w.id, mine.get(w.id) ?? decodeItem(w));
  }
  const removed = local.filter(i => target.get(i.id) !== i);
  const added = [...target.values()].filter(i => mine.get(i.id) !== i);
  return { removed, added };
}
