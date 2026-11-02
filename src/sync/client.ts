import { sig } from '../../sync-server/board.mjs';
import { Change, Item } from '../types';
import { decodeItem, encodeChange, encodeItem, reconcile, View, WireChange, WireItem } from './wire';

/**
 * - off: no server address set.
 * - connecting: trying to reach the server, or waiting for its first answer.
 * - synced: connected, changes flow both ways.
 * - offline: the server cannot be reached (Mac asleep, other Wi-Fi, app in the
 *   background). Changes wait in the outbox and are sent on reconnect.
 */
export type SyncState = 'off' | 'connecting' | 'synced' | 'offline';
export type SyncStatus = { state: SyncState; peers: number; pending: number; url: string | null; follow: boolean };
export type RemoteLive = { points: Float32Array; color: string; size: number };

const URL_KEY = 'draw-sync-url';
const readUrl = () => { try { return localStorage.getItem(URL_KEY) || null; } catch { return null; } };
const writeUrl = (u: string | null) => {
  try { if (u) localStorage.setItem(URL_KEY, u); else localStorage.removeItem(URL_KEY); } catch { /* private mode */ }
};
const FOLLOW_KEY = 'draw-sync-follow';
const readFollow = () => { try { return localStorage.getItem(FOLLOW_KEY) === '1'; } catch { return false; } };
const writeFollow = (on: boolean) => {
  try { if (on) localStorage.setItem(FOLLOW_KEY, '1'); else localStorage.removeItem(FOLLOW_KEY); } catch { /* private mode */ }
};
const round = (v: number) => Math.round(v * 100) / 100;

type ServerMsg =
  | { type: 'state'; ids: string[]; items: WireItem[]; want: string[] }
  | { type: 'change'; change: WireChange }
  | { type: 'ack' }
  | { type: 'peers'; count: number }
  | { type: 'pong' }
  | ({ type: 'view'; from: string } & View)
  | { type: 'view-request'; from: string }
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
  /** The part of the board this device shows now. */
  getView: () => View;
  /** Another device's view, while this device follows. */
  onRemoteView: (v: View) => void;
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
  /**
   * Follow mode: this device shows whatever area another device is looking at.
   * A device that follows never sends its own view, so two devices can never
   * chase each other.
   */
  let following = readFollow();
  let state: SyncState = url ? 'offline' : 'off';
  let retry = 0;
  let retryTimer = 0;
  const listeners = new Set<(s: SyncStatus) => void>();
  const remoteStrokes = new Map<string, number[]>();

  const status = (): SyncStatus => ({ state, peers, pending: outbox.length, url, follow: following });
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
    if (!url || ws) return;
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

  /** Asks the server for a pong; no answer soon means the socket is dead: reconnect. */
  let pingTimer = 0;
  function check() {
    const sock = ws;
    if (!sock || sock.readyState !== WebSocket.OPEN) {
      if (sock && sock.readyState !== WebSocket.CONNECTING) { disconnect(); connect(); }
      return;
    }
    send({ type: 'ping' });
    clearTimeout(pingTimer);
    pingTimer = window.setTimeout(() => {
      pingTimer = 0;
      if (ws !== sock) return;
      disconnect();
      setState('offline');
      connect();
    }, 3000);
  }

  function disconnect() {
    clearTimeout(pingTimer);
    pingTimer = 0;
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
        if (following) send({ type: 'view-request' });
        else sendView();
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
      case 'pong':
        clearTimeout(pingTimer);
        pingTimer = 0;
        break;
      case 'peers':
        // Someone new may want to follow this device: tell them where it is.
        if (msg.count > peers && !following) sendView();
        peers = msg.count;
        emit();
        break;
      case 'view':
        if (following) opts.onRemoteView({ x: msg.x, y: msg.y, w: msg.w, h: msg.h });
        break;
      case 'view-request':
        if (!following) sendView();
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

  // ---- this device's view, for devices that follow it ----
  let viewTimer = 0;
  function sendView() {
    clearTimeout(viewTimer);
    viewTimer = 0;
    if (!synced || following) return;
    const v = opts.getView();
    send({ type: 'view', x: round(v.x), y: round(v.y), w: round(v.w), h: round(v.h) });
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
      // Stay connected while hidden: on a Mac, Safari calls a window "hidden" when
      // another window covers it, and that window is the one watching the iPad draw.
      // iOS suspends a background app instead, which can leave a dead socket that
      // still looks open, so on the way back the connection is checked.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        retry = 0;
        if (!ws) connect(); else check();
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
    /** This device's view moved (pan, zoom, resize). Sent at most every 60 ms. */
    viewChanged() {
      if (!synced || following || viewTimer) return;
      viewTimer = window.setTimeout(sendView, 60);
    },
    get following() { return following; },
    setFollow(on: boolean) {
      if (following === on) return;
      following = on;
      writeFollow(on);
      if (on) send({ type: 'view-request' });
      else sendView();
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
