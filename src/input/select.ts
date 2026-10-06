import { screenToWorld } from '../camera';
import { iconBBox, MIN_ICON, HANDLE_HIT, snapRotation } from '../geometry/icon';
import {
  handlesFor, moveVertex, resizeShape, rotateItem, sameGeometry, selectionBox, translateItem,
} from '../geometry/selection';
import { shapeItemBBox, snapLine } from '../geometry/shape';
import { Renderer } from '../render/strokes';
import { Change, IconItem, isIcon, Selectable, ShapeItem, ToolSettings } from '../types';

type Mode = 'move' | 'resize' | 'rotate' | 'vertex';

/** A finger is wider than a mouse pointer, so its handles are easier to hit. */
const TOUCH_HANDLE_HIT = 28;

const closedShape = (s: ShapeItem) => s.shape === 'rect' || s.shape === 'ellipse' || s.shape === 'polygon';
const fillOf = (i: Selectable) => (isIcon(i) ? undefined : i.fill);
const turnsByRotation = (i: Selectable) => isIcon(i) || i.shape === 'rect' || i.shape === 'ellipse';
const rotationOf = (i: Selectable) => (isIcon(i) ? i.rotation : i.rotation ?? 0);

/**
 * Placing an icon, then picking things up: moving, resizing, turning, and for a
 * line or polygon, dragging one vertex.
 *
 * Icons and drawn shapes (rectangles, ovals, lines, polygons) can be picked. Pen
 * strokes cannot: a stroke is a freehand scribble with no sensible centre to turn
 * about, and is edited with the eraser instead.
 *
 * Placing an icon is two steps. Choosing a tile in the panel only *arms* the
 * board; the icon is dropped where you next press, and stays selected so you can
 * drag it a little further, or grab a handle.
 *
 * Nothing is written to history until the finger lifts. A drag is one action, not
 * one per frame, so undo takes the item back to where it was picked up rather than
 * stepping it back pixel by pixel.
 */
export function attachSelect(opts: {
  board: HTMLElement;
  renderer: Renderer;
  getSettings: () => ToolSettings;
  isNavigating: () => boolean;
  onCommit: (c: Change) => void;
  onSelect: (i: Selectable | null) => void;
  /** Called when an icon becomes armed for placing, or stops being. */
  onArmChange?: (kind: string | null) => void;
}) {
  const { board, renderer } = opts;
  let mode: Mode | null = null;
  /** Which corner or vertex is being dragged. */
  let partIndex = 0;
  /** The item as it was when the drag began, for history and for the maths. */
  let original: Selectable | null = null;
  /** True while the icon under the finger was dropped by this very press. */
  let placing = false;
  let armed: string | null = null;
  let grab = { x: 0, y: 0 };
  let startAngle = 0;
  let startDist = 0;

  const world = (e: PointerEvent) => screenToWorld(renderer.camera, e.clientX, e.clientY);
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, within: number) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= within;

  const setArmed = (kind: string | null) => {
    if (armed === kind) return;
    armed = kind;
    opts.onArmChange?.(kind);
  };

  // ---- colour, fill and line width of the selection ----
  let restyleFrom: Selectable | null = null;
  let restyleTimer = 0;

  /** Writes a finished restyle to history as one action, however many nudges it took. */
  function flush() {
    clearTimeout(restyleTimer);
    const before = restyleFrom;
    restyleFrom = null;
    const now = renderer.selection;
    if (!before || !now || now.id !== before.id) return;
    if (now.color === before.color && now.size === before.size && fillOf(now) === fillOf(before)) return;
    opts.onCommit({ removed: [before], added: [now] });
  }

  /** Which part of the selection a point lands on. Handles win over the body. */
  function partAt(i: Selectable, p: { x: number; y: number }, touch: boolean): { mode: Mode; index: number } | null {
    const within = (touch ? TOUCH_HANDLE_HIT : HANDLE_HIT) / renderer.camera.zoom;
    const h = handlesFor(i, renderer.camera.zoom);
    if (near(p, h.rotate, within)) return { mode: 'rotate', index: 0 };
    const v = h.vertices.findIndex(c => near(p, c, within));
    if (v >= 0) return { mode: 'vertex', index: v };
    const k = h.corners.findIndex(c => near(p, c, within));
    if (k >= 0) return { mode: 'resize', index: k };

    return null;
  }

  board.addEventListener('pointerdown', e => {
    if (opts.getSettings().tool !== 'select' || opts.isNavigating()) return;
    flush();

    const p = world(e);

    if (armed) {
      // Dropped here and picked up at once, so the same press can nudge it.
      const icon = make(armed, p.x, p.y);
      renderer.applyChange([], [icon]);
      renderer.select(icon);
      opts.onSelect(icon);
      setArmed(null);
      placing = true;
      mode = 'move';
      original = { ...icon };
      grab = p;
      board.setPointerCapture(e.pointerId);
      return;
    }

    const current = renderer.selection;
    // Handles are tested before anything else, because they sit outside the box
    // and would otherwise be swallowed by whatever is behind them.
    const part = current ? partAt(current, p, e.pointerType === 'touch') : null;

    if (current && part) {
      mode = part.mode;
      partIndex = part.index;
      original = { ...current };
      const c = selectionBox(current);
      startAngle = Math.atan2(p.y - c.y, p.x - c.x);
      startDist = Math.hypot(p.x - c.x, p.y - c.y);
      board.setPointerCapture(e.pointerId);
      return;
    }

    // A tap pad makes a thin icon or line catchable by thumb.
    const hit = renderer.selectableAt(p.x, p.y, 6 / renderer.camera.zoom);
    renderer.select(hit);
    opts.onSelect(hit);
    if (!hit) return;

    mode = 'move';
    original = { ...hit };
    grab = p;
    board.setPointerCapture(e.pointerId);
  });

  board.addEventListener('pointermove', e => {
    if (!mode || !original) return;
    const p = world(e);
    const magnet = opts.getSettings().magnet;
    let next: Selectable;
    let angleNow = { snapped: false, degrees: 0 };

    if (mode === 'move') {
      next = translateItem(original, p.x - grab.x, p.y - grab.y);
    } else if (mode === 'rotate') {
      const c = selectionBox(original);
      const raw = Math.atan2(p.y - c.y, p.x - c.x) - startAngle;
      // An icon, rectangle or oval keeps its angle; a line or polygon is turned by
      // its points, so only the turn made in this drag is snapped.
      const base = turnsByRotation(original) ? rotationOf(original) : 0;
      const force = e.shiftKey;
      const snap = snapRotation(base + raw, force);
      const use = magnet || force;
      angleNow = use ? snap : { ...snap, snapped: false };
      next = rotateItem(original, (use ? snap.rotation : base + raw) - base);
    } else if (mode === 'vertex') {
      const s = original as ShapeItem;
      let q = p;
      if (s.shape === 'line' && (magnet || e.shiftKey)) {
        // The other end stays put; the angle of the line snaps like when drawing it.
        const o = partIndex === 0 ? 1 : 0;
        const [x, y] = snapLine(s.pts[2 * o], s.pts[2 * o + 1], p.x, p.y, e.shiftKey);
        q = { x, y };
      }
      next = moveVertex(s, partIndex, q);
    } else if (isIcon(original)) {
      // Scaled by how much further the finger is from the centre than the corner
      // it grabbed, so the corner stays under the finger whatever the rotation.
      const c = selectionBox(original);
      const factor = startDist === 0 ? 1 : Math.hypot(p.x - c.x, p.y - c.y) / startDist;
      const box = Math.max(MIN_ICON, original.box * factor);
      // The line scales with the icon, as resizing a picture would, so a resized
      // icon keeps exactly the look it had. (The size controls still set the line
      // width directly.)
      next = { ...original, box, size: original.size * (box / original.box) };
      (next as IconItem).bbox = iconBBox(next as IconItem);
    } else {
      next = resizeShape(original, partIndex, p, { uniform: e.shiftKey, square: magnet, zoom: renderer.camera.zoom });
    }

    renderer.replaceItem(next);

    if (mode === 'rotate') {
      const handle = handlesFor(next, renderer.camera.zoom).rotate;
      renderer.setDraft(null, [], null, {
        solid: [], dashed: [], arcs: [],
        // Green on any exact step, whether the magnet just pulled it there or not.
        exact: angleNow.snapped || Math.abs(angleNow.degrees / 15 - Math.round(angleNow.degrees / 15)) < 1e-6,
        labels: [{ x: handle.x, y: handle.y, dx: 34, dy: 0, text: `${angleNow.degrees}°` }],
      });
    }
  });

  const finish = () => {
    if (!mode || !original) return;
    const next = renderer.selection;
    if (mode === 'rotate' || mode === 'vertex') renderer.setDraft(null);
    mode = null;
    const before = original;
    original = null;
    if (!next || next.id !== before.id) { placing = false; return; }

    if (placing && isIcon(next)) {
      // One history step for the whole drop, wherever the finger ended up.
      placing = false;
      opts.onCommit({ removed: [], added: [next] });
      return;
    }

    // A tap that selected without moving is not an action worth undoing.
    if (sameGeometry(next, before)) return;

    opts.onCommit({ removed: [before], added: [next] });
  };

  board.addEventListener('pointerup', finish);
  board.addEventListener('pointercancel', finish);

  // A second finger means pinch or pan: undo whatever this finger had started.
  board.addEventListener('abort-gesture', () => {
    if (!mode || !original) return;
    const before = original;
    if (mode === 'rotate' || mode === 'vertex') renderer.setDraft(null);
    mode = null;
    original = null;
    if (placing) {
      placing = false;
      renderer.applyChange([renderer.selection ?? before], []);
      renderer.select(null);
      opts.onSelect(null);
    } else {
      renderer.replaceItem(before);
    }
  });

  function make(kind: string, x: number, y: number): IconItem {
    const s = opts.getSettings();
    const icon: IconItem = {
      id: crypto.randomUUID(),
      kind,
      color: s.color,
      size: s.size, // world units, like the pen
      x, y,
      // A fixed size on screen, so an icon arrives the size it looks in the
      // panel however far the board is zoomed.
      box: 96 / renderer.camera.zoom,
      rotation: 0,
      bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      createdAt: Date.now(),
    };
    icon.bbox = iconBBox(icon);

    return icon;
  }

  return {
    /** The next press on the board drops this icon there. */
    arm(kind: string) {
      flush();
      renderer.select(null);
      opts.onSelect(null);
      setArmed(kind);
    },
    get armed() { return armed; },
    /**
     * Changes the colour, line width or fill of the selection. Shows at once, and
     * is written to history once the changes stop coming. Fill applies to closed
     * shapes only. Returns false if nothing is selected.
     */
    restyle(patch: { color?: string; size?: number; fill?: string | null }): boolean {
      const cur = renderer.selection;
      if (!cur) return false;
      restyleFrom ??= cur;
      let next: Selectable;
      if (isIcon(cur)) {
        next = { ...cur };
        if (patch.color !== undefined) next.color = patch.color;
        if (patch.size !== undefined) next.size = patch.size;
        next.bbox = iconBBox(next);
      } else {
        next = { ...cur };
        if (patch.color !== undefined) next.color = patch.color;
        if (patch.size !== undefined) next.size = patch.size;
        if (patch.fill !== undefined && closedShape(next)) next.fill = patch.fill;
        next.bbox = shapeItemBBox(next);
      }
      renderer.replaceItem(next);
      clearTimeout(restyleTimer);
      restyleTimer = window.setTimeout(flush, 400);

      return true;
    },
    /** Settles any restyle still waiting, before something else reads history. */
    flush,
    /** Removes the selection, if there is one. */
    deleteSelected() {
      flush();
      const i = renderer.selection;
      if (!i) return;
      renderer.select(null);
      renderer.applyChange([i], []);
      opts.onSelect(null);
      opts.onCommit({ removed: [i], added: [] });
    },
    clear() {
      flush();
      setArmed(null);
      renderer.select(null);
      opts.onSelect(null);
    },
  };
}
