import { screenToWorld } from '../camera';
import { HANDLE_HIT, iconBBox, iconHandles, MIN_ICON } from '../geometry/icon';
import { Renderer } from '../render/strokes';
import { Change, IconItem, ToolSettings } from '../types';

type Mode = 'move' | 'resize' | 'rotate';

/** A finger is wider than a mouse pointer, so its handles are easier to hit. */
const TOUCH_HANDLE_HIT = 28;

/**
 * Placing an icon, then picking it up: moving it, scaling it, turning it.
 *
 * Placing is two steps. Choosing a tile in the panel only *arms* the board; the
 * icon is dropped where you next press, and stays selected so you can drag it
 * a little further, or grab a handle to resize or turn it.
 *
 * Only icons are selectable. A pen mark is a shape someone drew by hand and has
 * no sensible centre to turn about; it is edited with the eraser instead.
 *
 * Nothing is written to history until the finger lifts. A drag is one action, not
 * one per frame, so undo takes the icon back to where it was picked up rather than
 * stepping it back pixel by pixel.
 */
export function attachSelect(opts: {
  board: HTMLElement;
  renderer: Renderer;
  getSettings: () => ToolSettings;
  isNavigating: () => boolean;
  onCommit: (c: Change) => void;
  onSelect: (i: IconItem | null) => void;
  /** Called when an icon becomes armed for placing, or stops being. */
  onArmChange?: (kind: string | null) => void;
}) {
  const { board, renderer } = opts;
  let mode: Mode | null = null;
  /** The icon as it was when the drag began, for history and for scale maths. */
  let original: IconItem | null = null;
  /** True while the icon under the finger was dropped by this very press. */
  let placing = false;
  let armed: string | null = null;
  let grabbed = { x: 0, y: 0 };
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

  // ---- colour and line width of the selected icon ----
  let restyleFrom: IconItem | null = null;
  let restyleTimer = 0;

  /** Writes a finished restyle to history as one action, however many nudges it took. */
  function flush() {
    clearTimeout(restyleTimer);
    const before = restyleFrom;
    restyleFrom = null;
    const now = renderer.selection;
    if (!before || !now || now.id !== before.id) return;
    if (now.color === before.color && now.size === before.size) return;
    opts.onCommit({ removed: [before], added: [now] });
  }

  /** Which part of the selected icon a point lands on, handles winning over body. */
  function partAt(i: IconItem, p: { x: number; y: number }, touch: boolean): Mode | null {
    const within = (touch ? TOUCH_HANDLE_HIT : HANDLE_HIT) / renderer.camera.zoom;
    const { corners, rotate } = iconHandles(i, renderer.camera.zoom);
    if (near(p, rotate, within)) return 'rotate';
    if (corners.some(c => near(p, c, within))) return 'resize';

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
      grabbed = { x: 0, y: 0 };
      board.setPointerCapture(e.pointerId);
      return;
    }

    const current = renderer.selection;
    // Handles are tested before anything else, because they sit outside the box
    // and would otherwise be swallowed by whatever is behind them.
    const part = current ? partAt(current, p, e.pointerType === 'touch') : null;

    if (current && part) {
      mode = part;
      original = { ...current };
      startAngle = Math.atan2(p.y - current.y, p.x - current.x);
      startDist = Math.hypot(p.x - current.x, p.y - current.y);
      board.setPointerCapture(e.pointerId);
      return;
    }

    // A tap pad makes a thin icon — a pipe is two hairlines — catchable by thumb.
    const hit = renderer.iconAt(p.x, p.y, 6 / renderer.camera.zoom);
    renderer.select(hit);
    opts.onSelect(hit);
    if (!hit) return;

    mode = 'move';
    original = { ...hit };
    grabbed = { x: p.x - hit.x, y: p.y - hit.y };
    board.setPointerCapture(e.pointerId);
  });

  board.addEventListener('pointermove', e => {
    if (!mode || !original) return;
    const p = world(e);
    let next: IconItem;

    if (mode === 'move') {
      next = { ...original, x: p.x - grabbed.x, y: p.y - grabbed.y };
    } else if (mode === 'rotate') {
      next = { ...original, rotation: original.rotation + (Math.atan2(p.y - original.y, p.x - original.x) - startAngle) };
    } else {
      // Scaled by how much further the finger is from the centre than the corner
      // it grabbed, so the corner stays under the finger whatever the rotation.
      const factor = startDist === 0 ? 1 : Math.hypot(p.x - original.x, p.y - original.y) / startDist;
      next = { ...original, box: Math.max(MIN_ICON, original.box * factor) };
    }

    next.bbox = iconBBox(next);
    renderer.replaceIcon(next);
  });

  const finish = () => {
    if (!mode || !original) return;
    const next = renderer.selection;
    mode = null;
    const before = original;
    original = null;
    if (!next || next.id !== before.id) { placing = false; return; }

    if (placing) {
      // One history step for the whole drop, wherever the finger ended up.
      placing = false;
      opts.onCommit({ removed: [], added: [next] });
      return;
    }

    // A tap that selected without moving is not an action worth undoing.
    const still = next.x === before.x && next.y === before.y
      && next.box === before.box && next.rotation === before.rotation;
    if (still) return;

    opts.onCommit({ removed: [before], added: [next] });
  };

  board.addEventListener('pointerup', finish);
  board.addEventListener('pointercancel', finish);

  // A second finger means pinch or pan: undo whatever this finger had started.
  board.addEventListener('abort-gesture', () => {
    if (!mode || !original) return;
    const before = original;
    mode = null;
    original = null;
    if (placing) {
      placing = false;
      renderer.applyChange([renderer.selection ?? before], []);
      renderer.select(null);
      opts.onSelect(null);
    } else {
      renderer.replaceIcon(before);
    }
  });

  function make(kind: string, x: number, y: number): IconItem {
    const s = opts.getSettings();
    const icon: IconItem = {
      id: crypto.randomUUID(),
      kind,
      color: s.color,
      size: s.size / renderer.camera.zoom,
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
     * Changes the colour or outline of the selected icon. Shows at once, and is
     * written to history once the changes stop coming. Returns false if nothing
     * is selected.
     */
    restyle(patch: { color?: string; size?: number }): boolean {
      const cur = renderer.selection;
      if (!cur) return false;
      restyleFrom ??= cur;
      const next = { ...cur, ...patch };
      next.bbox = iconBBox(next);
      renderer.replaceIcon(next);
      clearTimeout(restyleTimer);
      restyleTimer = window.setTimeout(flush, 400);

      return true;
    },
    /** Settles any restyle still waiting, before something else reads history. */
    flush,
    /** Removes the selected icon, if there is one. */
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
