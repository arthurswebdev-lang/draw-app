import { Camera } from '../types';
import { panBy, zoomAt } from '../camera';

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

  return { isNavigating: () => space };
}
