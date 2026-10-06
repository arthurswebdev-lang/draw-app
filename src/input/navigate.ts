import { Camera } from '../types';
import { panBy, zoomAt } from '../camera';

/**
 * Moving around the board: wheel, trackpad, space + drag, middle mouse, and on a
 * touch screen two fingers to pan and pinch.
 *
 * It listens first (capture phase), so it can keep the drawing tools out of a
 * gesture: it tells them to stop with an `abort-gesture` event and swallows the
 * second finger and any palm that lands while a pencil is in use.
 */
export function attachNavigate(opts: {
  board: HTMLElement;
  getCamera: () => Camera;
  setCamera: (c: Camera) => void;
}) {
  const { board, getCamera, setCamera } = opts;
  let space = false;
  let panning: { id: number; x: number; y: number } | null = null;

  board.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey) {
      setCamera(zoomAt(getCamera(), e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01)));
    } else {
      setCamera(panBy(getCamera(), -e.deltaX, -e.deltaY));
    }
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
      space = true;
      board.style.cursor = 'grab';
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') { space = false; board.style.cursor = ''; }
  });

  const touches = new Map<number, { x: number; y: number }>();

  // Safari on a Mac reports a trackpad pinch as gesture events, not as a ctrl+wheel
  // like Chrome does, and would otherwise zoom the whole page. Use them to zoom the
  // board around the pointer. (On a touch screen the two-finger code below does the
  // work, and Safari sends these too, so they are skipped while two fingers are down.)
  type PinchEvent = Event & { scale: number; clientX: number; clientY: number };
  let lastScale = 1;
  document.addEventListener('gesturestart', e => {
    e.preventDefault();
    lastScale = (e as PinchEvent).scale || 1;
  });
  document.addEventListener('gesturechange', e => {
    e.preventDefault();
    const g = e as PinchEvent;
    if (touches.size >= 2 || !g.scale) return;
    setCamera(zoomAt(getCamera(), g.clientX, g.clientY, g.scale / lastScale));
    lastScale = g.scale;
  });
  document.addEventListener('gestureend', e => e.preventDefault());

  // ---- touch: two fingers pan and zoom ----
  let gesture: { cx: number; cy: number; dist: number } | null = null;
  let penDown = 0;
  const abort = () => board.dispatchEvent(new Event('abort-gesture'));

  const pair = () => {
    const [a, b] = [...touches.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };

  board.addEventListener('pointerdown', e => {
    if (e.pointerType === 'pen') {
      penDown += 1;
      // A palm that landed first may already be drawing. The pencil wins.
      if (touches.size) { touches.clear(); gesture = null; abort(); }
      return;
    }
    if (e.pointerType !== 'touch') return;
    if (penDown > 0) { e.stopImmediatePropagation(); return; } // palm rejection
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) {
      gesture = pair();
      abort();
      e.stopImmediatePropagation();
    }
  }, { capture: true });

  board.addEventListener('pointermove', e => {
    if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture || touches.size < 2) return;
    const now = pair();
    let cam = panBy(getCamera(), now.cx - gesture.cx, now.cy - gesture.cy);
    cam = zoomAt(cam, now.cx, now.cy, now.dist / gesture.dist);
    setCamera(cam);
    gesture = now;
  }, { capture: true });

  const lift = (e: PointerEvent) => {
    if (e.pointerType === 'pen') penDown = Math.max(0, penDown - 1);
    if (e.pointerType !== 'touch') return;
    touches.delete(e.pointerId);
    if (touches.size < 2) gesture = null;
  };
  board.addEventListener('pointerup', lift, { capture: true });
  board.addEventListener('pointercancel', lift, { capture: true });

  // ---- space + drag, middle mouse ----
  board.addEventListener('pointerdown', e => {
    if (e.button === 1 || (e.button === 0 && space)) {
      panning = { id: e.pointerId, x: e.clientX, y: e.clientY };
      board.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  board.addEventListener('pointermove', e => {
    if (!panning || e.pointerId !== panning.id) return;
    setCamera(panBy(getCamera(), e.clientX - panning.x, e.clientY - panning.y));
    panning.x = e.clientX;
    panning.y = e.clientY;
  });
  const stop = (e: PointerEvent) => { if (panning && e.pointerId === panning.id) panning = null; };
  board.addEventListener('pointerup', stop);
  board.addEventListener('pointercancel', stop);

  return { isNavigating: () => space || touches.size >= 2 };
}
