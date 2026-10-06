import { Renderer } from '../render/strokes';
import { screenToWorld } from '../camera';
import { Change, Item, Stroke, STRIDE, ToolSettings } from '../types';
import { computeBBox } from '../geometry/bbox';
import { eraseSegment, Pt, strokeTouches } from '../geometry/erase';
import { shapeCenterline, shapeTouches } from '../geometry/shape';

const isEraser = (t: string) => t === 'eraser' || t === 'stroke-eraser';

export function attachEraser(opts: {
  board: HTMLElement;
  renderer: Renderer;
  getSettings: () => ToolSettings;
  isNavigating: () => boolean;
  onCommit: (c: Change) => void;
}) {
  const { board, renderer, getSettings, isNavigating, onCommit } = opts;

  const ring = document.createElement('div');
  ring.id = 'eraser-ring';
  ring.hidden = true;
  document.body.appendChild(ring);
  let lastScreen: { x: number; y: number } | null = null;

  const placeRing = () => {
    const s = getSettings();
    if (!isEraser(s.tool) || !lastScreen) { ring.hidden = true; return; }
    ring.hidden = false;
    ring.style.width = ring.style.height = `${s.eraserSize}px`;
    ring.style.transform = `translate(${lastScreen.x - s.eraserSize / 2}px, ${lastScreen.y - s.eraserSize / 2}px)`;
  };

  // originals: strokes that existed before this gesture and are now gone.
  // added: pieces created during this gesture and still present.
  let session: {
    id: number; last: Pt;
    originals: Map<string, Item>;
    added: Map<string, Stroke>;
  } | null = null;

  const worldPoint = (e: PointerEvent): Pt => screenToWorld(renderer.camera, e.clientX, e.clientY);

  function process(a: Pt, b: Pt) {
    const s = getSettings();
    const zoom = renderer.camera.zoom;
    const radius = s.eraserSize / 2 / zoom;
    const sweep = {
      minX: Math.min(a.x, b.x) - radius, maxX: Math.max(a.x, b.x) + radius,
      minY: Math.min(a.y, b.y) - radius, maxY: Math.max(a.y, b.y) + radius,
    };
    const remove: Item[] = [];
    const add: Stroke[] = [];
    for (const st of renderer.strokes) {
      const bb = st.bbox;
      if (bb.maxX < sweep.minX || bb.minX > sweep.maxX || bb.maxY < sweep.minY || bb.minY > sweep.maxY) continue;
      if (s.tool === 'stroke-eraser') {
        if (strokeTouches(st.points, st.size, a, b, radius)) remove.push(st);
      } else {
        const pieces = eraseSegment(st.points, st.size, a, b, radius, st.poly);
        if (!pieces) continue;
        remove.push(st);
        for (const p of pieces) {
          add.push({
            id: crypto.randomUUID(), color: st.color, size: st.size,
            points: p, bbox: computeBBox(p, st.size), createdAt: st.createdAt, poly: true,
          });
        }
      }
    }
    // A shape without fill is just an outline, so the eraser cuts it like a pen line:
    // it becomes plain strokes and the part you touch is gone. A filled shape, like
    // an icon, is one object and goes whole. The object eraser always takes it whole.
    for (const sh of renderer.shapes) {
      const bb = sh.bbox;
      if (bb.maxX < sweep.minX || bb.minX > sweep.maxX || bb.maxY < sweep.minY || bb.minY > sweep.maxY) continue;
      if (!shapeTouches(sh, a, b, radius)) continue;
      if (s.tool === 'stroke-eraser' || sh.fill) { remove.push(sh); continue; }
      const xy = shapeCenterline(sh);
      const pts = new Float32Array((xy.length / 2) * STRIDE);
      for (let i = 0, j = 0; i < xy.length; i += 2, j += STRIDE) { pts[j] = xy[i]; pts[j + 1] = xy[i + 1]; pts[j + 2] = 0.5; }
      const pieces = eraseSegment(pts, sh.size, a, b, radius, true);
      if (!pieces) continue;
      remove.push(sh);
      for (const p of pieces) {
        add.push({
          id: crypto.randomUUID(), color: sh.color, size: sh.size,
          points: p, bbox: computeBBox(p, sh.size), createdAt: sh.createdAt, poly: true,
        });
      }
    }
    // An icon is one object: either eraser takes the whole thing if it touches
    // the drawn outline. (Cutting a piece out of an icon would leave a broken one.)
    for (const ic of renderer.icons) {
      const bb = ic.bbox;
      if (bb.maxX < sweep.minX || bb.minX > sweep.maxX || bb.maxY < sweep.minY || bb.minY > sweep.maxY) continue;
      if (renderer.iconTouches(ic, a, b, radius)) remove.push(ic);
    }
    if (!remove.length && !add.length) return;
    for (const r of remove) {
      if (session!.added.has(r.id)) session!.added.delete(r.id);
      else session!.originals.set(r.id, r);
    }
    for (const n of add) session!.added.set(n.id, n);
    renderer.applyChange(remove, add);
  }

  board.addEventListener('pointerdown', e => {
    if (e.button !== 0 || session || isNavigating() || !isEraser(getSettings().tool)) return;
    board.setPointerCapture(e.pointerId);
    const p = worldPoint(e);
    session = { id: e.pointerId, last: p, originals: new Map(), added: new Map() };
    lastScreen = { x: e.clientX, y: e.clientY };
    placeRing();
    process(p, p);
  });

  board.addEventListener('pointermove', e => {
    lastScreen = { x: e.clientX, y: e.clientY };
    placeRing();
    if (!session || e.pointerId !== session.id) return;
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events.length ? events : [e]) {
      const p = worldPoint(ev);
      process(session.last, p);
      session.last = p;
    }
  });

  const finish = () => {
    if (!session) return;
    const change: Change = {
      removed: [...session.originals.values()],
      added: [...session.added.values()],
    };
    session = null;
    if (change.removed.length || change.added.length) onCommit(change);
  };
  const end = (e: PointerEvent) => {
    if (session && e.pointerId === session.id) finish();
  };
  // A second finger starts a pinch: keep what was erased so far and stop.
  board.addEventListener('abort-gesture', finish);
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', end);
  board.addEventListener('lostpointercapture', end);
  board.addEventListener('pointerleave', e => {
    if (!session && e.pointerType === 'mouse') { lastScreen = null; placeRing(); }
  });

  return { refresh: placeRing };
}
