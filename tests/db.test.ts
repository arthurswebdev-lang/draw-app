import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createStore } from '../src/store/db';
import { Stroke } from '../src/types';

const mk = (id: string, createdAt: number): Stroke => ({
  id, color: '#000', size: 2, createdAt,
  points: new Float32Array([1, 2, 0.5, 3, 4, 0.5]),
  bbox: { minX: 0, minY: 0, maxX: 5, maxY: 5 },
});

describe('db', () => {
  it('stores strokes ordered by createdAt, deletes, keeps Float32Array', async () => {
    const db = await createStore('t1');
    await db.addStroke(mk('b', 2));
    await db.addStroke(mk('a', 1));
    const all = await db.getAllStrokes();
    expect(all.map(s => s.id)).toEqual(['a', 'b']);
    expect(Array.from(all[0].points)).toEqual([1, 2, 0.5, 3, 4, 0.5]);
    await db.deleteStroke('a');
    expect((await db.getAllStrokes()).length).toBe(1);
  });
  it('meta get/set', async () => {
    const db = await createStore('t2');
    expect(await db.getMeta('camera')).toBeUndefined();
    await db.setMeta('camera', { x: 1, y: 2, zoom: 3 });
    expect(await db.getMeta('camera')).toEqual({ x: 1, y: 2, zoom: 3 });
  });
});
