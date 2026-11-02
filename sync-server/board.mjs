// The board as the sync server keeps it. Plain JavaScript with no dependencies, so
// the app (src/sync) and the tests can import it too: `sig` must be computed the
// same way on both sides.
//
// Items arrive in the wire format (see src/sync/wire.ts): JSON objects with at
// least `id` and `createdAt`. The server never looks inside them.

/**
 * A short fingerprint of an item's JSON, to tell "same item, same content" from
 * "same item, changed". FNV-1a, 32 bit. Not secure, only a quick comparison.
 */
export function sig(item) {
  const s = JSON.stringify(item);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Items by id, plus the ids of deleted items ("tombstones"). The tombstones stop a
 * device that was offline from bringing back something another device deleted.
 */
export function createBoard(data) {
  const items = new Map(Object.entries(data?.items ?? {}));
  const deleted = new Set(data?.deleted ?? []);
  return {
    get size() { return items.size; },
    /** One change from a device: removed ids, added (or replaced) items. */
    applyChange(change) {
      for (const id of change.removed ?? []) {
        items.delete(id);
        deleted.add(id);
      }
      for (const it of change.added ?? []) {
        items.set(it.id, it);
        // An explicit add wins over a tombstone: that is how undoing a delete works.
        deleted.delete(it.id);
      }
    },
    /**
     * Ids from a device's `have` list that the server should ask for: not known
     * here and not deleted here.
     */
    want(ids) {
      return ids.filter(id => !items.has(id) && !deleted.has(id));
    },
    /** What a device must download: every item it lacks or holds a different version of. */
    diffFor(have) {
      const out = [];
      for (const [id, it] of items) if (have[id] !== sig(it)) out.push(it);
      return out;
    },
    ids() { return [...items.keys()]; },
    list() { return [...items.values()].sort((a, b) => a.createdAt - b.createdAt); },
    toJSON() { return { items: Object.fromEntries(items), deleted: [...deleted] }; },
  };
}
