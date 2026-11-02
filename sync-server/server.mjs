// Draw sync server: a tiny WebSocket relay for devices on the same Wi-Fi.
//
//   node server.mjs              wss:// with the certificate made by setup.mjs
//   node server.mjs --insecure   plain ws://, for local development only
//
// It keeps one board (data/board.json) and passes every change on to the other
// connected devices. See README.md in this folder for the setup.

import { createServer as createHttps } from 'node:https';
import { createServer as createHttp } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createBoard } from './board.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8443);
const insecure = process.argv.includes('--insecure');
const certFile = join(dir, 'certs', 'cert.pem');
const keyFile = join(dir, 'certs', 'key.pem');
const dataDir = process.env.SYNC_DATA_DIR ?? join(dir, 'data');
const dataFile = join(dataDir, 'board.json');

// Only pages from these addresses may connect, so a random website open in a
// browser on this Mac cannot read or change the board.
const ORIGINS = [
  'https://arthurswebdev-lang.github.io',
  ...(process.env.SYNC_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
];
const allowed = origin =>
  !origin || ORIGINS.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---- the board, saved to disk ----
mkdirSync(dataDir, { recursive: true });
let saved = {};
if (existsSync(dataFile)) {
  try { saved = JSON.parse(readFileSync(dataFile, 'utf8')); }
  catch (err) { log('Could not read', dataFile, '- starting empty.', err.message); }
}
const board = createBoard(saved);
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // Write a temporary file and rename it, so a crash never leaves half a file.
    const tmp = `${dataFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(board));
    renameSync(tmp, dataFile);
  }, 500);
}

// ---- HTTP: a page to check the certificate from a browser ----
function page(_req, res) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta name="viewport" content="width=device-width">
<title>Draw sync</title>
<body style="font:17px -apple-system,system-ui,sans-serif;padding:24px;max-width:520px">
<h2>Draw sync server is running</h2>
<p>This device trusts the certificate. You can close this page and connect from the Draw app.</p>
<p style="color:#666">${board.size} items on the board · ${ready().length} devices connected</p>`);
}

let server;
if (insecure) {
  server = createHttp(page);
} else {
  if (!existsSync(certFile) || !existsSync(keyFile)) {
    console.error('No certificate found. Run the setup first:  npm run sync-setup  (in the draw-app folder)');
    process.exit(1);
  }
  server = createHttps({ cert: readFileSync(certFile), key: readFileSync(keyFile) }, page);
}

// A device that reaches the Mac but does not trust the certificate fails here,
// before any WebSocket exists. Logged, because the app can only say "cannot reach".
server.on('tlsClientError', (err, socket) => {
  log('Certificate/TLS problem with', socket?.remoteAddress ?? 'a device', '-', err.message);
});
server.on('request', req => log('Page opened from', req.socket.remoteAddress));

// ---- WebSocket ----
const wss = new WebSocketServer({
  server,
  maxPayload: 256 * 1024 * 1024,
  verifyClient: ({ origin }) => {
    if (allowed(origin)) return true;
    log('Refused a connection from', origin);
    return false;
  },
});

/** Connections that finished their hello, and so receive changes. */
const clients = new Map();
const ready = () => [...clients.values()].filter(c => c.ready);
const send = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
const toOthers = (from, msg) => {
  const text = JSON.stringify(msg);
  for (const c of ready()) if (c.ws !== from && c.ws.readyState === c.ws.OPEN) c.ws.send(text);
};
const announcePeers = () => {
  const count = ready().length;
  for (const c of ready()) send(c.ws, { type: 'peers', count });
};

wss.on('connection', (ws, req) => {
  const ua = req.headers['user-agent'] ?? '';
  // Which device, for the log. iPadOS Safari says "Macintosh" too; only touch support tells.
  const name = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad'
    : /Macintosh/.test(ua) && !/^::1$|127\.0\.0\.1$/.test(req.socket.remoteAddress ?? '') ? 'iPad (or another Mac)'
    : /Macintosh/.test(ua) ? 'this Mac' : 'device';
  const me = { id: randomUUID(), ws, ready: false, alive: true, name };
  clients.set(ws, me);
  log(`${name} connected`, req.socket.remoteAddress);
  ws.on('pong', () => { me.alive = true; });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    switch (msg.type) {
      case 'hello': {
        // Changes this device made while it was away, in order.
        for (const c of msg.outbox ?? []) {
          board.applyChange(c);
          toOthers(ws, { type: 'change', change: c });
        }
        const have = msg.have ?? {};
        send(ws, {
          type: 'state',
          ids: board.ids(),
          items: board.diffFor(have),
          want: board.want(Object.keys(have)),
        });
        me.ready = true;
        log(`${name} synced: sent ${msg.outbox?.length ?? 0} waiting changes, has ${Object.keys(have).length} items, got ${board.diffFor(have).length} items`);
        if (msg.outbox?.length) save();
        announcePeers();
        break;
      }
      case 'ping':
        send(ws, { type: 'pong' });
        break;
      case 'change': {
        log(`Change from ${name}: +${msg.change?.added?.length ?? 0} -${msg.change?.removed?.length ?? 0}`);
        board.applyChange(msg.change);
        toOthers(ws, { type: 'change', change: msg.change });
        send(ws, { type: 'ack' });
        save();
        break;
      }
      case 'live': {
        // A stroke being drawn: passed on, never stored.
        toOthers(ws, { ...msg, from: me.id });
        break;
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (me.ready) {
      toOthers(ws, { type: 'live', from: me.id, end: true });
      announcePeers();
    }
    log(`${name} left`);
  });
  ws.on('error', err => log('Socket error', err.message));
});

// Drop connections that stopped answering (an iPad that went to sleep, for example).
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    c.ws.ping();
  }
}, 30_000);

server.listen(PORT, () => {
  log(`Draw sync server on ${insecure ? 'ws' : 'wss'}://0.0.0.0:${PORT} · ${board.size} items`);
});

const stop = () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    writeFileSync(dataFile, JSON.stringify(board));
  }
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
