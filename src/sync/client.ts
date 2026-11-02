import { sig } from '../../sync-server/board.mjs';
import { Change, Item } from '../types';
import { decodeItem, encodeChange, encodeItem, reconcile, WireChange, WireItem } from './wire';

/**
 * - off: no server address set.
 * - connecting: trying to reach the server, or waiting for its first answer.
 * - synced: connected, changes flow both ways.
 * - offline: the server cannot be reached (Mac asleep, other Wi-Fi, app in the
 *   background). Changes wait in the outbox and are sent on reconnect.
 */
export type SyncState = 'off' | 'connecting' | 'synced' | 'offline';
export type SyncStatus = { state: SyncState; peers: number; pending: number; url: string | null };
export type RemoteLive = { points: Float32Array; color: string; size: number };

const URL_KEY = 'draw-sync-url';
const readUrl = () => { try { return localStorage.getItem(URL_KEY) || null; } catch { return null; } };
const writeUrl = (u: string | null) => {
  try { if (u) localStorage.setItem(URL_KEY, u); else localStorage.removeItem(URL_KEY); } catch { /* private mode */ }
};
const round = (v: number) => Math.round(v * 100) / 100;

type ServerMsg =
  | { type: 'state'; ids: string[]; items: WireItem[]; want: string[] }
  | { type: 'change'; change: WireChange }
  | { type: 'ack' }
  | { type: 'peers'; count: number }
  | { type: 'live'; from: string; end?: boolean; start?: number; pts?: number[]; color?: string; size?: number };

/**
 * Keeps this device's board in step with the sync server on the Mac.
 *
 * Every local change goes into an outbox (saved, so it survives a reload) and is
 * sent when connected; the server's "ack" takes it out. On (re)connect the device
 * says hello with the outbox and a fingerprint of every item it holds, and the
 * server answers with what this device is missing. So a device that was offline
 * catches up, and its own offline work reaches the others.
 */
export function createSync(opts: {
  getItems: () => Item[];
  /** Puts a change from another device on the board and in the database. Not in history. */
  applyRemote: (c: Change) => void;
  setRemoteLive: (from: string, live: RemoteLive | null) => void;
  loadOutbox: () => Promise<WireChange[] | undefined>;
  saveOutbox: (o: WireChange[]) => Promise<unknown>;
}) {
  let url = readUrl();
  let outbox: WireChange[] = [];
  let ws: WebSocket | null = null;
  let synced = false;
  /** How many outbox entries went with the hello on this connection. */
  let helloCount = 0;
  /** How many outbox entries were sent on this connection and wait for an ack. */
  let sentCount = 0;
  let peers = 0;
  let state: SyncState = url ? 'offline' : 'off';
  let retry = 0;
  let retryTimer = 0;
  const listeners = new Set<(s: SyncStatus) => void>();
  const remoteStrokes = new Map<string, number[]>();

  const status = (): SyncStatus => ({ state, peers, pending: outbox.length, url });
  const emit = () => { const s = status(); for (const l of listeners) l(s); };
  const setState = (s: SyncState) => { state = s; emit(); };

  let saveTimer = 0;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { opts.saveOutbox(outbox).catch(err => console.error(err)); }, 300);
  };

  const send = (msg: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const flush = () => {
    while (synced && sentCount < outbox.length) send({ type: 'change', change: outbox[sentCount++] });
  };
  const clearRemoteLive = () => {
    for (const from of remoteStrokes.keys()) opts.setRemoteLive(from, null);
    remoteStrokes.clear();
  };

  function scheduleRetry() {
    clearTimeout(retryTimer);
    if (!url) return;
    const delay = Math.min(15000, 1000 * 2 ** retry);
    retry += 1;
    retryTimer = window.setTimeout(connect, delay);
  }

  function connect() {
    clearTimeout(retryTimer);
    // iOS stops a page in the background anyway; a fresh connection on return is cleaner.
    if (!url || ws || document.hidden) return;
    setState('connecting');
    let sock: WebSocket;
    try { sock = new WebSocket(url); }
    catch (err) { console.error(err); setState('offline'); scheduleRetry(); return; }
    ws = sock;
    sock.onopen = () => {
      const have: Record<string, string> = {};
      for (const i of opts.getItems()) have[i.id] = sig(encodeItem(i));
      helloCount = outbox.length;
      sock.send(JSON.stringify({ type: 'hello', outbox, have }));
    };
    sock.onmessage = e => {
      if (ws !== sock) return;
      try { onMessage(JSON.parse(e.data as string) as ServerMsg); }
      catch (err) { console.error('sync: bad message', err); }
    };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      synced = false;
      sentCount = 0;
      peers = 0;
      clearRemoteLive();
      setState(url ? 'offline' : 'off');
      scheduleRetry();
    };
  }

  function disconnect() {
    const sock = ws;
    ws = null;
    synced = false;
    sentCount = 0;
    peers = 0;
    clearRemoteLive();
    sock?.close();
  }

  function onMessage(msg: ServerMsg) {
    switch (msg.type) {
      case 'state': {
        const replay = outbox.slice(helloCount);
        const c = reconcile(opts.getItems(), msg, replay);
        if (c.removed.length || c.added.length) opts.applyRemote(c);
        // The hello's changes are on the server now. Items it has never seen go up
        // first, then whatever was drawn while waiting for this answer.
        outbox = outbox.slice(helloCount);
        if (msg.want.length) {
          const mine = new Map(opts.getItems().map(i => [i.id, i]));
          const added = msg.want.map(id => mine.get(id)).filter((i): i is Item => !!i).map(encodeItem);
          if (added.length) outbox.unshift({ removed: [], added });
        }
        synced = true;
        retry = 0;
        sentCount = 0;
        flush();
        persist();
        setState('synced');
        break;
      }
      case 'change': {
        const mine = new Map(opts.getItems().map(i => [i.id, i]));
        const added = msg.change.added.map(decodeItem);
        // A replaced item must come out first, or the board would hold it twice.
        const ids = new Set([...msg.change.removed, ...added.map(i => i.id)]);
        const removed = [...ids].map(id => mine.get(id)).filter((i): i is Item => !!i);
        opts.applyRemote({ removed, added });
        break;
      }
      case 'ack':
        if (outbox.length) outbox.shift();
        sentCount = Math.max(0, sentCount - 1);
        persist();
        emit();
        break;
      case 'peers':
        peers = msg.count;
        emit();
        break;
      case 'live': {
        if (msg.end) {
          remoteStrokes.delete(msg.from);
          opts.setRemoteLive(msg.from, null);
          break;
        }
        let pts = msg.start ? remoteStrokes.get(msg.from) ?? [] : [];
        pts = pts.concat(msg.pts ?? []);
        remoteStrokes.set(msg.from, pts);
        opts.setRemoteLive(msg.from, { points: new Float32Array(pts), color: msg.color ?? '#000', size: msg.size ?? 1 });
        break;
      }
    }
  }

  // ---- the stroke being drawn here, shown live on the other devices ----
  let livePts: number[] | null = null;
  let liveStyle = { color: '#000', size: 1 };
  let liveSent = 0;
  let liveTimer = 0;
  const sendLive = () => {
    liveTimer = 0;
    if (!livePts || !synced) return;
    const pts = livePts.slice(liveSent).map(round);
    if (!pts.length) return;
    send({ type: 'live', start: liveSent, pts, ...liveStyle });
    liveSent = livePts.length;
  };

  return {
    get status() { return status(); },
    subscribe(fn: (s: SyncStatus) => void) {
      listeners.add(fn);
      fn(status());
      return () => { listeners.delete(fn); };
    },
    async start() {
      outbox = (await opts.loadOutbox()) ?? [];
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { disconnect(); if (url) setState('offline'); }
        else { retry = 0; connect(); }
      });
      window.addEventListener('online', () => { retry = 0; connect(); });
      emit();
      connect();
    },
    /** Sets the server address and connects, or with null turns sync off. */
    setUrl(next: string | null) {
      disconnect();
      clearTimeout(retryTimer);
      url = next;
      writeUrl(next);
      retry = 0;
      if (!next) {
        outbox = [];
        persist();
        setState('off');
      } else connect();
    },
    /** A change made on this device: queued, and sent when connected. */
    local(c: Change) {
      if (!url) return;
      outbox.push(encodeChange(c));
      persist();
      flush();
      emit();
    },
    /** The pen's points while drawing, or null when the stroke ends or is thrown away. */
    live(pts: number[] | null, color = '#000', size = 1) {
      if (!pts) {
        clearTimeout(liveTimer);
        liveTimer = 0;
        if (livePts && liveSent > 0) send({ type: 'live', end: true });
        livePts = null;
        liveSent = 0;
        return;
      }
      if (!synced) return;
      if (pts !== livePts) { livePts = pts; liveSent = 0; }
      liveStyle = { color, size };
      if (!liveTimer) liveTimer = window.setTimeout(sendLive, 40);
    },
  };
}
