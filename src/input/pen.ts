import { Renderer } from '../render/strokes';
import { screenToWorld } from '../camera';
import { Change, ToolSettings, Stroke, STRIDE } from '../types';
import { simplify } from '../geometry/simplify';
import { computeBBox } from '../geometry/bbox';

export function attachPen(opts: {
  board: HTMLElement;
  renderer: Renderer;
  getSettings: () => ToolSettings;
  isNavigating: () => boolean;
  onCommit: (c: Change) => void;
}) {
  const { board, renderer, getSettings, isNavigating, onCommit } = opts;
  let activeId: number | null = null;
  let pts: number[] = [];
  let color = '#000';
  let size = 1;

  const pushEvent = (e: PointerEvent) => {
    const w = screenToWorld(renderer.camera, e.clientX, e.clientY);
    const n = pts.length;
    if (n >= STRIDE) {
      const dx = w.x - pts[n - 3], dy = w.y - pts[n - 2];
      const min = 0.5 / renderer.camera.zoom;
      if (dx * dx + dy * dy < min * min) return;
    }
    pts.push(w.x, w.y, e.pressure > 0 ? e.pressure : 0.5);
  };

  board.addEventListener('pointerdown', e => {
    if (e.button !== 0 || activeId !== null || isNavigating() || getSettings().tool !== 'pen') return;
    activeId = e.pointerId;
    board.setPointerCapture(e.pointerId);
    const pen = getSettings();
    color = pen.color;
    size = pen.size / renderer.camera.zoom;
    pts = [];
    pushEvent(e);
    renderer.setLive(new Float32Array(pts), color, size);
  });

  board.addEventListener('pointermove', e => {
    if (e.pointerId !== activeId) return;
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events.length ? events : [e]) pushEvent(ev);
    renderer.setLive(new Float32Array(pts), color, size);
  });

  const end = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    if (!pts.length) return;
    const eps = 0.25 / renderer.camera.zoom;
    const points = simplify(new Float32Array(pts), eps);
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      color, size, points,
      bbox: computeBBox(points, size),
      createdAt: Date.now(),
    };
    pts = [];
    renderer.applyChange([], [stroke]);
    renderer.setLive(null);
    onCommit({ removed: [], added: [stroke] });
  };
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', end);
  board.addEventListener('lostpointercapture', end);
  board.addEventListener('contextmenu', e => e.preventDefault());
}
