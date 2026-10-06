import { screenToWorld } from '../camera';
import { guidesFor } from '../geometry/guides';
import { shapeBBox, snapBox, snapLine } from '../geometry/shape';
import { Renderer } from '../render/strokes';
import { Change, ShapeItem, ShapeKind, Tool, ToolSettings } from '../types';

type Pt = { x: number; y: number };

const DRAG_TOOLS: Tool[] = ['line', 'rect', 'ellipse'];
/** Pointer this close (screen px) to the first vertex closes the polygon. */
const CLOSE_MOUSE = 14;
const CLOSE_TOUCH = 24;

/**
 * Drawing lines, rectangles, ovals and polygons.
 *
 * A line, rectangle or oval is dragged out from corner to corner. Near a square
 * or a circle, a rectangle or oval snaps to exactly that, and a line snaps to
 * the nearest 15 degrees; holding Shift forces it.
 *
 * A polygon is built vertex by vertex: press where each corner goes (and drag
 * to adjust before letting go). Bringing the pointer back to the first corner
 * shows a ring, and letting go there closes and fills the polygon. A double tap
 * on the last vertex, or Enter, ends an open path instead.
 */
export function attachShapes(opts: {
  board: HTMLElement;
  renderer: Renderer;
  getSettings: () => ToolSettings;
  isNavigating: () => boolean;
  onCommit: (c: Change) => void;
}) {
  const { board, renderer } = opts;
  const world = (e: PointerEvent): Pt => screenToWorld(renderer.camera, e.clientX, e.clientY);
  const zoom = () => renderer.camera.zoom;

  function make(shape: ShapeKind, pts: number[]): ShapeItem {
    const s = opts.getSettings();
    const size = s.size; // world units, like the pen: same setting, same thickness at any zoom
    const closed = shape === 'rect' || shape === 'ellipse' || shape === 'polygon';
    return {
      id: crypto.randomUUID(), shape, pts,
      color: s.color, fill: closed ? s.fill : null, size,
      bbox: shapeBBox(pts, size), createdAt: Date.now(),
    };
  }

  function commit(item: ShapeItem) {
    renderer.applyChange([], [item]);
    opts.onCommit({ removed: [], added: [item] });
  }

  // ---------- line, rectangle, oval: drag ----------
  let drag: { id: number; start: Pt; shape: ShapeKind; end: Pt } | null = null;

  function dragEnd(start: Pt, p: Pt, shape: ShapeKind, shift: boolean): Pt {
    // With the magnet switched off the drag is free; Shift still forces a snap.
    if (!opts.getSettings().magnet && !shift) return p;
    const [x, y] = shape === 'line'
      ? snapLine(start.x, start.y, p.x, p.y, shift)
      : snapBox(start.x, start.y, p.x, p.y, 10 / zoom(), shift);
    return { x, y };
  }

  const dragItem = () => make(drag!.shape, [drag!.start.x, drag!.start.y, drag!.end.x, drag!.end.y]);

  // ---------- polygon: click by click ----------
  let verts: Pt[] = [];
  let tentative: Pt | null = null;
  let hover: Pt | null = null;
  let downId: number | null = null;
  let closePx = CLOSE_MOUSE;

  const screenDist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) * zoom();
  const isClosing = (p: Pt | null) => !!p && verts.length >= 3 && p === verts[0];

  /** Pulls a point onto the first vertex when it is close enough to close the polygon. */
  const magnet = (p: Pt): Pt =>
    verts.length >= 3 && screenDist(p, verts[0]) <= closePx ? verts[0] : p;

  function showPolygon() {
    if (!verts.length && !tentative && !hover) { renderer.setDraft(null); return; }
    const tail = tentative ?? hover;
    const closing = isClosing(tail);
    const flat = verts.flatMap(v => [v.x, v.y]);
    if (tail && !closing) flat.push(tail.x, tail.y);
    let item: ShapeItem | null = null;
    if (closing) item = make('polygon', flat);
    else if (flat.length >= 4) item = make('polyline', flat);
    renderer.setDraft(item, verts, closing ? verts[0] : null);
  }

  function finishPolygon(closed: boolean) {
    if (closed && verts.length >= 3) commit(make('polygon', verts.flatMap(v => [v.x, v.y])));
    else if (verts.length >= 2) commit(make('polyline', verts.flatMap(v => [v.x, v.y])));
    reset();
  }

  function reset() {
    drag = null;
    verts = [];
    tentative = null;
    hover = null;
    downId = null;
    renderer.setDraft(null);
  }

  board.addEventListener('pointerdown', e => {
    const tool = opts.getSettings().tool;
    if (e.button !== 0 || opts.isNavigating()) return;

    if (DRAG_TOOLS.includes(tool) && !drag) {
      board.setPointerCapture(e.pointerId);
      const p = world(e);
      drag = { id: e.pointerId, start: p, end: p, shape: tool as ShapeKind };
      return;
    }

    if (tool === 'polygon' && downId === null) {
      board.setPointerCapture(e.pointerId);
      downId = e.pointerId;
      closePx = e.pointerType === 'touch' ? CLOSE_TOUCH : CLOSE_MOUSE;
      tentative = magnet(world(e));
      showPolygon();
    }
  });

  board.addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) {
      drag.end = dragEnd(drag.start, world(e), drag.shape, e.shiftKey);
      const item = dragItem();
      renderer.setDraft(item, [], null, guidesFor(drag.shape, item.pts, zoom()));
      return;
    }
    if (opts.getSettings().tool !== 'polygon') return;
    closePx = e.pointerType === 'touch' ? CLOSE_TOUCH : CLOSE_MOUSE;
    if (downId === e.pointerId) tentative = magnet(world(e));
    else if (downId === null && verts.length) hover = magnet(world(e));
    else return;
    showPolygon();
  });

  const up = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) {
      const item = dragItem();
      const big = item.bbox.maxX - item.bbox.minX - item.size + (item.bbox.maxY - item.bbox.minY - item.size);
      renderer.setDraft(null);
      drag = null;
      // A tap that never really dragged is not a shape.
      if (big * zoom() > 4) commit(item);
      return;
    }
    if (downId !== e.pointerId) return;
    downId = null;
    const p = tentative;
    tentative = null;
    if (!p) return;
    if (isClosing(p)) { finishPolygon(true); return; }
    // Pressing again on the last vertex means "that is the end".
    if (verts.length && screenDist(p, verts[verts.length - 1]) < 4) { finishPolygon(false); return; }
    verts.push(p);
    hover = null;
    showPolygon();
  };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', e => {
    if (drag && e.pointerId === drag.id) { renderer.setDraft(null); drag = null; }
    if (downId === e.pointerId) { downId = null; tentative = null; showPolygon(); }
  });
  board.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse' && downId === null && hover) { hover = null; showPolygon(); }
  });

  // A second finger means pinch or pan: drop the half-made mark, keep placed vertices.
  board.addEventListener('abort-gesture', () => {
    if (drag) { renderer.setDraft(null); drag = null; }
    if (downId !== null) { downId = null; tentative = null; showPolygon(); }
  });

  window.addEventListener('keydown', e => {
    if (opts.getSettings().tool !== 'polygon' || !verts.length) return;
    if (e.key === 'Enter') { e.preventDefault(); finishPolygon(false); }
    else if (e.key === 'Escape') reset();
    else if (e.key === 'Backspace') { e.preventDefault(); verts.pop(); showPolygon(); }
  });

  return {
    /** Throws away a half-drawn shape, e.g. when another tool is picked. */
    cancel: reset,
    get busy() { return !!drag || verts.length > 0; },
  };
}
