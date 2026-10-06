# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal infinite-whiteboard drawing app (dot-grid board, pen, erasers, shapes, an icon library for electronics / programming / water-supply diagrams). Vanilla TypeScript + Vite, no framework, no backend: everything is saved in the browser's IndexedDB. It is a PWA meant to be added to an iPad/iPhone home screen.

## Commands

```
npm install
npm run dev                      # Vite dev server
npm test                         # vitest run (all tests)
npx vitest run tests/erase.test.ts           # one file
npx vitest run -t "snaps a nearly square"    # one test by name
npm run build                    # tsc --noEmit && vite build → dist/
```

`npm run build` is also the typecheck (`tsc --noEmit`, strict, `noUnusedLocals`). There is no linter.

Tests cover only pure logic (geometry, history, IndexedDB via `fake-indexeddb`). jsdom has no canvas or `Path2D`, so rendering, pointer input and the toolbar have no automated tests — check those in a real browser (Safari/WebKit matters: this is an iPad/iPhone app).

## Architecture

`src/main.ts` is the only wiring file. It builds the `settings` object (a `ToolSettings`, shared by reference with every module), loads items/camera/settings from IndexedDB, creates the `Renderer`, and attaches the input modules. Read it first.

### One list of items, one kind of change

- Everything on the board is an `Item = Stroke | IconItem | ShapeItem` (`src/types.ts`) in a single list, `renderer.items`, ordered by `createdAt` (that is the layering). The union has **no discriminator field**: use the guards `isIcon` (`'kind' in i`) and `isShape` (`'shape' in i`); anything else is a pen `Stroke`. `renderer.strokes/icons/shapes` are filtered views.
- All edits are a `Change = { removed: Item[]; added: Item[] }`. The same shape drives undo/redo (`state/history.ts`), persistence (`store.applyChange`) and drawing (`renderer.applyChange`). A replace (move/resize/restyle) is `removed:[old], added:[new with the same id]`. Interaction handlers apply changes to the renderer **live** while dragging and call `onCommit(change)` once on pointer-up, which pushes history and writes the DB. Selection drags use `renderer.replaceItem` (no history) and commit in `finish()`.
- Stacking order is just `createdAt`. The toolbar arrows ("bring forward / send backward", `state/zorder.ts`) give the one selected item a new `createdAt` strictly between its new neighbours, so it is a normal undoable one-item `Change`. Keep `createdAt` values unique when you reorder: ties come back from IndexedDB in random order.
- `renderer.replaceItem`/`applyChange` clear the per-id `Path2D` cache. If you mutate an item's geometry some other way, drop its cache entry or the old outline is drawn.

### Coordinates and sizes

- All geometry is in **world units**; `camera = {x, y, zoom}` (screen = (world − cam)·zoom). Pen, shape and icon line widths are world units, so the same pen size is the same thickness at any zoom. The eraser size and the selection handles are in **screen px** (divide by zoom).
- Each tool remembers its own size: `settings.sizes[tool]`; `settings.size` / `settings.eraserSize` hold the size of the tool in hand and `applyTool()` in `main.ts` swaps them on a tool change. Icons use the **select** tool's size.

### Rendering (`src/render/strokes.ts`)

Two stacked canvases plus a CSS dot grid (`render/grid.ts`, updated from the camera). `strokes` canvas: committed items, redrawn only on camera/resize/undo/etc. (one per animation frame), culled by `item.bbox`, with the selection chrome and the selected shape's measurement guides. `live` canvas: the stroke being drawn, the shape draft (`setDraft`: markers, polygon close ring, guides). Canvas size = CSS size × devicePixelRatio, capped for iPad's pixel limit (`render/surface.ts`). `exportCanvas()` renders all items to a fresh canvas for PNG export (8M pixel budget; iPhone Safari blanks huge canvases).

### Input modules (`src/input/*`)

`pen`, `eraser`, `shapes`, `select`, `navigate`, each attaching pointer listeners to `#board` and acting only when `settings.tool` matches. **`navigate` must be attached first**: it registers capture-phase listeners, tracks touch pointers for two-finger pan/pinch, does palm rejection while a Pencil is down, and dispatches a custom `abort-gesture` event that the other modules listen for to cancel a half-made mark when a second finger lands. It also handles Safari's `gesture*` events (trackpad pinch) and ctrl+wheel.

- **Smoothing:** a pen `Stroke` stores sampled points and is drawn with quadratic midpoint smoothing (`geometry/smooth.ts`). A stroke with `poly: true` is an exact polyline drawn without smoothing.
- **Eraser (`geometry/erase.ts`):** subtracts an exact capsule (the swept eraser disc) from the stroke's centerline (`capsuleSpan`/`eraseSegment`), cutting at the true crossing points and copying every other point untouched. The first cut flattens a smooth stroke into `poly: true` pieces; later cuts never move survivors (do not re-simplify or re-smooth pieces — that was an earlier bug where untouched parts drifted). Unfilled shapes are converted to poly strokes when partly erased; icons and filled shapes are removed whole; the "object" eraser always removes whole items.
- **Shapes:** `ShapeItem.pts` is `[x1,y1,x2,y2]` for line/rect/ellipse (corners) and vertex pairs for polygon/polyline. `rotation` exists only for rect/ellipse (`pts` stay the upright box); lines/polygons are rotated by moving points. Magnets (`settings.magnet`, Shift forces): square/circle snap, 15° line snap, 45°/15° rotation snap, polygon close ring.
- **Select (`geometry/selection.ts` + `input/select.ts`):** works on icons and shapes (`Selectable`), not pen strokes. Pure functions compute handles, move, resize, rotate, vertex edits. Armed placement: picking a library tile only *arms* the board; the icon drops where you next press.

### Persistence

`store/db.ts`, IndexedDB `draw-app` v2: `strokes` store (holds pen strokes **and shapes**), `icons` store, `meta` store (keys `camera`, and `pen` = the whole `ToolSettings`). Keep upgrades additive: existing users have data. Saved settings are merged over defaults at load, so new settings fields need defaults in `main.ts`.

### UI

`ui/toolbar.ts` builds the toolbar into `#toolbar` as two `.bar`s (`.bar-main`: tools, colour, fill; `.bar-aux`: size, undo/redo, library/share/new, zoom). On tablet/desktop the bars are `display: contents` and flow as one box; at `(max-width: 640px), (max-height: 500px)` (phones, short windows) they become a bottom and a top bar, menus open upward, and zoom buttons are hidden (a small tappable percentage label toggles 100% ↔ previous view). `main.ts` publishes the bar heights as `--toolbar-h` / `--top-h` for the icon panel, hint and badge. Grouped buttons (eraser, shapes) are "slots" with a flyout. `ui/icons-panel.ts` is the library sheet; `ui/modal.ts` has the New and Share dialogs. A global `[hidden] { display: none !important }` is needed because author `display` rules otherwise override the attribute. Dialog buttons that are long must use the `stack` class or they overflow on wide screens.

The icon library is `src/icons/library.ts` (SVG path data in a 0..100 box, grouped by sphere → group). `src/icons/catalog.ts` is an unused alternative 48-box set; it is not imported anywhere.

### Sharing

`export/png.ts`: asks white vs transparent background (remembered in localStorage), then `navigator.share({ files })`. Pass **only the file** — adding `title`/`text` makes some iOS share targets send just the text and drop the image. Falls back to a download if sharing is unavailable.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml` (npm ci → test → build → GitHub Pages). The app is a project site at `https://arthurswebdev-lang.github.io/draw-app/` (Vite `base: './'`, so keep asset and manifest URLs relative; the manifest `id`/`scope`/`start_url` are the absolute `/draw-app/`). `public/sw.js` is a network-first service worker.

Known issue: the same GitHub address root serves a different PWA (a Tasks app) whose manifest scope covers the whole origin, so on a device with it installed, draw-app links/icons can open Tasks. Code cannot fix this; it needs draw-app on its own origin (e.g. a separate GitHub organization or another host). If the Pages workflow sits queued or is cancelled (GitHub Actions incidents have caused this), an empty commit re-triggers it.
