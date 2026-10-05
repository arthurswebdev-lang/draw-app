import { openDB, IDBPDatabase } from 'idb';
import { Stroke } from '../types';

export type Store = ReturnType<typeof createStore> extends Promise<infer T> ? T : never;

export async function createStore(name = 'draw-app') {
  const db: IDBPDatabase = await openDB(name, 1, {
    upgrade(d) {
      const strokes = d.createObjectStore('strokes', { keyPath: 'id' });
      strokes.createIndex('createdAt', 'createdAt');
      d.createObjectStore('meta', { keyPath: 'key' });
    },
  });
  return {
    addStroke: (s: Stroke) => db.put('strokes', s),
    deleteStroke: (id: string) => db.delete('strokes', id),
    getAllStrokes: () => db.getAllFromIndex('strokes', 'createdAt') as Promise<Stroke[]>,
    async getMeta<T>(key: string): Promise<T | undefined> {
      const row = await db.get('meta', key);
      return row?.value as T | undefined;
    },
    setMeta: (key: string, value: unknown) => db.put('meta', { key, value }),
    close: () => db.close(),
  };
}
