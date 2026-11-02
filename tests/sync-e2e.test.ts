// @ts-nocheck -- uses Node APIs (child_process, fs), and the project has no Node types.
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSync } from '../src/sync/client';
import { Change, Item, Stroke } from '../src/types';

const PORT = 18461;
let srv: ChildProcess | undefined;
// Needs the server's own packages (npm run sync-setup). Not installed in CI: skipped there.
const canRun = existsSync('sync-server/node_modules/ws');
// Never the real board: a throwaway folder.
const dataDir = mkdtempSync(join(tmpdir(), 'draw-sync-test-'));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const docEvents = new EventTarget();
const doc = Object.assign(docEvents, { hidden: false }); // never hidden here
const mem = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(new EventTarget(), { setTimeout, clearTimeout }),
  document: doc,
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) },
});

function device(name: string, start: Item[]) {
  let items = [...start];
  let view = { x: 0, y: 0, w: 1000, h: 700 };
  const seen: unknown[] = [];
  let outbox: unknown;
  const lives: unknown[] = [];
  const s = createSync({
    getItems: () => items,
    applyRemote: (c: Change) => {
      const gone = new Set(c.removed.map(i => i.id));
      items = [...items.filter(i => !gone.has(i.id)), ...c.added].sort((a, b) => a.createdAt - b.createdAt);
    },
    setRemoteLive: (_f, l) => lives.push(l),
    loadOutbox: async () => outbox as never,
    saveOutbox: async o => { outbox = o; },
    getView: () => view,
    onRemoteView: v => { seen.push(v); },
  });
  return {
    name, s, lives, seen,
    /** The user pans or zooms. */
    look(v: typeof view) { view = v; s.viewChanged(); },
    get items() { return items; },
    draw(c: Change) {
      const gone = new Set(c.removed.map(i => i.id));
      items = [...items.filter(i => !gone.has(i.id)), ...c.added];
      s.local(c);
    },
  };
}
const stroke = (id: string, t: number): Stroke => ({
  id, color: '#000', size: 2, createdAt: t, points: new Float32Array([t, 1.5, 0.5, t + 3, 4, 0.5]),
  bbox: { minX: t, minY: 1, maxX: t + 4, maxY: 5 },
});
const ids = (l: Item[]) => l.map(i => i.id).sort();

const startServer = () => {
  srv = spawn('node', ['sync-server/server.mjs', '--insecure'], { env: { ...process.env, PORT: String(PORT), SYNC_DATA_DIR: dataDir } });
};
beforeAll(async () => {
  if (!canRun) return;
  startServer();
  await wait(600);
});
afterAll(() => { srv?.kill(); rmSync(dataDir, { recursive: true, force: true }); });

describe.skipIf(!canRun)('sync end to end (real server)', () => {
  it('merges, syncs changes and live strokes, and catches up after being offline', async () => {
    const A = device('A', [stroke('a-old', 1)]);
    const B = device('B', [stroke('b-old', 2)]);
    await A.s.start(); await B.s.start();
    A.s.setUrl(`ws://localhost:${PORT}`);
    await wait(300);
    B.s.setUrl(`ws://localhost:${PORT}`);
    await wait(400);
    expect(A.s.status.state).toBe('synced');
    expect(B.s.status.peers).toBe(2);
    expect(ids(B.items)).toEqual(['a-old', 'b-old']); // merged
    await wait(200);
    expect(ids(A.items)).toEqual(['a-old', 'b-old']);

    // live stroke, then the commit
    const pts = [10, 10, 0.5];
    A.s.live(pts, '#f00', 3);
    pts.push(20, 20, 0.5);
    A.s.live(pts, '#f00', 3);
    await wait(150);
    A.draw({ removed: [], added: [stroke('a-new', 10)] });
    A.s.live(null);
    await wait(200);
    expect(ids(B.items)).toContain('a-new');
    expect((B.lives[0] as { points: Float32Array }).points.length).toBe(6);
    expect(B.lives.at(-1)).toBeNull();
    expect(A.s.status.pending).toBe(0);

    // B deletes, A sees it
    B.draw({ removed: [B.items.find(i => i.id === 'a-old')!], added: [] });
    await wait(200);
    expect(ids(A.items)).toEqual(['a-new', 'b-old']);

    // The server goes away (the Mac sleeps); both devices change things; it comes back.
    srv?.kill();
    await wait(300);
    expect(A.s.status.state).toBe('offline');
    A.draw({ removed: [], added: [stroke('a-offline', 30)] });
    B.draw({ removed: [B.items.find(i => i.id === 'b-old')!], added: [] });
    startServer();
    await wait(600);
    (globalThis.window as EventTarget).dispatchEvent(new Event('online'));
    await wait(600);
    expect(ids(A.items)).toEqual(ids(B.items));
    expect(ids(A.items)).toEqual(['a-new', 'a-offline']);
    expect(A.s.status.pending + B.s.status.pending).toBe(0);

    // Follow mode: B follows A. A's view arrives at once, and every move after it.
    B.s.setFollow(true);
    await wait(200);
    expect(B.seen.at(-1)).toEqual({ x: 0, y: 0, w: 1000, h: 700 });
    A.look({ x: 9600, y: 5500, w: 800, h: 600 });
    await wait(200);
    expect(B.seen.at(-1)).toEqual({ x: 9600, y: 5500, w: 800, h: 600 });
    // A follower never sends its own view, so A does not start moving with B.
    B.look({ x: 1, y: 1, w: 1, h: 1 });
    await wait(200);
    expect(A.seen).toEqual([]);
    B.s.setFollow(false);
    A.s.setUrl(null); B.s.setUrl(null);
  }, 10000);
});
