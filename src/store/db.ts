import { openDB, IDBPDatabase } from 'idb';
import { IconItem, isIcon, Item, Stroke } from '../types';

export type Store = ReturnType<typeof createStore> extends Promise<infer T> ? T : never;

export async function createStore(name = 'draw-app') {
  /**
   * Icons go in their own store rather than beside the strokes. A stroke row is a
   * Float32Array and an icon row is a dozen numbers, so keeping them apart means
   * loading one never has to walk past the other, and the eraser's reads stay
   * exactly the shape they were.
   */
  const db: IDBPDatabase = await openDB(name, 2, {
    upgrade(d, from) {
      if (from < 1) {
        const strokes = d.createObjectStore('strokes', { keyPath: 'id' });
        strokes.createIndex('createdAt', 'createdAt');
        d.createObjectStore('meta', { keyPath: 'key' });
      }
      // Runs for a fresh database and for one already holding strokes alike, so
      // an existing board gains icons without losing a line of it.
      if (from < 2) {
        const icons = d.createObjectStore('icons', { keyPath: 'id' });
        icons.createIndex('createdAt', 'createdAt');
      }
    },
  });
  return {
    addStroke: (s: Stroke) => db.put('strokes', s),
    deleteStroke: (id: string) => db.delete('strokes', id),
    getAllStrokes: () => db.getAllFromIndex('strokes', 'createdAt') as Promise<Stroke[]>,
    /** Both stores merged back into one drawing order. */
    async getAllItems(): Promise<Item[]> {
      const [strokes, icons] = await Promise.all([
        db.getAllFromIndex('strokes', 'createdAt') as Promise<Stroke[]>,
        db.getAllFromIndex('icons', 'createdAt') as Promise<IconItem[]>,
      ]);

      return [...strokes, ...icons].sort((a, b) => a.createdAt - b.createdAt);
    },
    async getMeta<T>(key: string): Promise<T | undefined> {
      const row = await db.get('meta', key);
      return row?.value as T | undefined;
    },
    setMeta: (key: string, value: unknown) => db.put('meta', { key, value }),
    /**
     * One transaction over both stores, so an action that touches a stroke and an
     * icon together cannot half-land.
     */
    async applyChange(removed: Item[], added: Item[]) {
      const tx = db.transaction(['strokes', 'icons'], 'readwrite');
      const pick = (i: Item) => tx.objectStore(isIcon(i) ? 'icons' : 'strokes');
      await Promise.all([
        ...removed.map(i => pick(i).delete(i.id)),
        ...added.map(i => pick(i).put(i)),
        tx.done,
      ]);
    },
    close: () => db.close(),
  };
}
