# Draw sync server

A tiny server that runs on your Mac and keeps the Draw app in sync between your
devices on the same Wi-Fi (for example: draw on the iPad, see it on the MacBook).
No cloud: the drawings go only between your devices and this Mac.

## One-time setup

On the Mac, in the `draw-app` folder:

```sh
brew install mkcert          # once, if you do not have it
npm run sync-setup           # makes the certificate, prints the server address
npm run sync-autostart       # starts the server now and at every login
```

`sync-setup` prints an address like `arturs-macbook.local:8443` and shows
`sync-server/rootCA.pem` in Finder.

On the iPad:

1. AirDrop `rootCA.pem` to the iPad and open it.
2. Settings → **Profile Downloaded** → Install.
3. Settings → General → About → **Certificate Trust Settings** → turn it on.
4. In Safari, open `https://arturs-macbook.local:8443`. It should say
   "Draw sync server is running".

In the Draw app, on every device: tap the **sync button** (two round arrows),
type the address, tap **Connect**. The dot on the button shows the state:
green = connected, orange = connecting, grey = cannot reach the server.

## Commands

| Command (in `draw-app`) | What it does |
|---|---|
| `npm run sync-server` | Runs the server in this terminal (stop with Ctrl+C) |
| `npm run sync-autostart` | Runs it in the background now and at every login |
| `npm run sync-autostart -- --remove` | Stops that |

Log (autostart): `sync-server/data/server.log`. The board copy: `sync-server/data/board.json`
(also a backup of your drawings).

## How it works

- Every change on a device goes into an outbox and is sent to the server, which
  saves it and passes it on to the other devices. A stroke is also shown on the
  other devices while it is being drawn.
- When a device connects (or comes back from the background) it sends what it did
  while offline, and gets what it missed. The first connect merges both boards.
- Deleted items are remembered ("tombstones") so an offline device cannot bring
  them back. If two devices change the same item, the last change wins.
- Undo only undoes your own actions on that device.
- Only pages from `https://arthurswebdev-lang.github.io` and `localhost` may
  connect. Add more with `SYNC_ORIGINS=https://a.example,https://b.example`.
- Settings: `PORT` (default 8443), `SYNC_DATA_DIR` (default `sync-server/data`).
- `node server.mjs --insecure` runs plain `ws://` without a certificate, for
  local development with `npm run dev` (connect to `ws://localhost:8443`).

## Problems

- **Grey dot on the iPad:** is the Mac awake and on the same Wi-Fi? Does the
  test page from step 4 open without a certificate warning?
- **Chrome on the Mac asks about "local network" devices:** allow it.
- **The Mac got a new name:** run `npm run sync-setup` again.
- Guest Wi-Fi networks often block devices from seeing each other; use a normal one.
