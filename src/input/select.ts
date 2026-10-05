import { screenToWorld } from '../camera';
import { HANDLE_HIT, iconBBox, iconHandles, MIN_ICON } from '../geometry/icon';
import { Renderer } from '../render/strokes';
import { Change, IconItem, ToolSettings } from '../types';

type Mode = 'move' | 'resize' | 'rotate';

/**
 * Picking an icon up: moving it, scaling it, turning it.
 *
 * Only icons are selectable. A pen mark is a shape someone drew by hand and has
 * no sensible centre to turn about; it is edited with the eraser instead.
 *
 * Nothing is written to history until the finger lifts. A drag is one action, not
 * one per frame, so undo takes the icon back to where it was picked up rather
 * than stepping it back pixel by pixel.
 */
export function attachSelect(opts: {
  board: HTMLElement;
  renderer: Renderer;
  getSettings: () => ToolSettings;
  isNavigating: () => boolean;
  onCommit: (c: Change) => void;
  onSelect: (i: IconItem | null) => void;
}) {
  const { board, renderer } = opts;
  let mode: Mode | null = null;
  /** The icon as it was when the drag began, for history and for scale maths. */
  let original: IconItem | null = null;
  let grabbed = { x: 0, y: 0 };
  let startAngle = 0;
  let startDist = 0;

  const world = (e: PointerEvent) => screenToWorld(renderer.camera, e.clientX, e.clientY);
  const near = (a: { x: number; y: number }, b: { x: number; y: number }, within: number) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= within;

  /** Which part of the selected icon a point lands on, handles winning over body. */
  function partAt(i: IconItem, p: { x: number; y: number }): Mode | null {
    const within = HANDLE_HIT / renderer.camera.zoom;
    const { corners, rotate } = iconHandles(i, renderer.camera.zoom);
    if (near(p, rotate, within)) return 'rotate';
    if (corners.some(c => near(p, c, within))) return 'resize';

    return null;
  }

  board.addEventListener('pointerdown', e => {
    if (opts.getSettings().tool !== 'select' || opts.isNavigating()) return;

    const p = world(e);
    const current = renderer.selection;
    // Handles are tested before anything else, because they sit outside the box
    // and would otherwise be swallowed by whatever is behind them.
    const part = current ? partAt(current, p) : null;

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
    if (!next || next.id !== before.id) return;
    // A tap that selected without moving is not an action worth undoing.
    const still = next.x === before.x && next.y === before.y
      && next.box === before.box && next.rotation === before.rotation;
    if (still) return;

    opts.onCommit({ removed: [before], added: [next] });
  };

  board.addEventListener('pointerup', finish);
  board.addEventListener('pointercancel', finish);

  return {
    /** Puts an icon on the board at a world point, selected and ready to drag. */
    place(kind: string, x: number, y: number): IconItem {
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
      opts.onCommit({ removed: [], added: [icon] });
      renderer.select(icon);
      opts.onSelect(icon);

      return icon;
    },
    /** Removes the selected icon, if there is one. */
    deleteSelected() {
      const i = renderer.selection;
      if (!i) return;
      renderer.select(null);
      opts.onSelect(null);
      opts.onCommit({ removed: [i], added: [] });
    },
    clear() {
      renderer.select(null);
      opts.onSelect(null);
    },
  };
}
