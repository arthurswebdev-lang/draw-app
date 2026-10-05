import './style.css';
import { createStore } from './store/db';
import { Renderer } from './render/strokes';
import { createSurface } from './render/surface';
import { updateGrid } from './render/grid';
import { attachPen } from './input/pen';
import { attachNavigate } from './input/navigate';
import { createToolbar } from './ui/toolbar';
import { History } from './state/history';
import { Camera, PenSettings, Stroke } from './types';

async function main() {
  const board = document.getElementById('board')!;
  const badge = document.getElementById('badge')!;
  const renderer = new Renderer(
    document.getElementById('strokes') as HTMLCanvasElement,
    document.getElementById('live') as HTMLCanvasElement,
  );
  const history = new History();
  const pen: PenSettings = { color: '#1e1e1e', size: 4 };

  const store = await createStore();
  const savedCam = await store.getMeta<Camera>('camera');
  const savedPen = await store.getMeta<PenSettings>('pen');
  if (savedCam) renderer.camera = savedCam;
  if (savedPen) Object.assign(pen, savedPen);
  renderer.setStrokes(await store.getAllStrokes());
  navigator.storage?.persist?.().catch(() => {});

  const guard = (p: Promise<unknown>) =>
    p.then(() => { badge.hidden = true; }, err => { console.error(err); badge.hidden = false; });

  let metaTimer = 0;
  const saveMeta = () => {
    clearTimeout(metaTimer);
    metaTimer = window.setTimeout(() => {
      guard(Promise.all([store.setMeta('camera', renderer.camera), store.setMeta('pen', { ...pen })]));
    }, 300);
  };

  const toolbar = createToolbar(document.getElementById('toolbar')!, {
    pen,
    onPenChange: saveMeta,
    onUndo: () => undo(),
    onRedo: () => redo(),
    onZoomReset: () => setCamera({ ...renderer.camera, zoom: 1 }),
  });
  const refreshHistory = () => toolbar.setHistory(history.canUndo, history.canRedo);

  const setCamera = (c: Camera) => {
    renderer.camera = c;
    updateGrid(board, c);
    toolbar.setZoom(c.zoom);
    renderer.requestRedraw();
    saveMeta();
  };

  createSurface(
    [document.getElementById('strokes') as HTMLCanvasElement, document.getElementById('live') as HTMLCanvasElement],
    () => renderer.requestRedraw(),
  );
  updateGrid(board, renderer.camera);
  toolbar.setZoom(renderer.camera.zoom);

  const nav = attachNavigate({ board, getCamera: () => renderer.camera, setCamera });
  attachPen({
    board, renderer,
    getPen: () => pen,
    isNavigating: nav.isNavigating,
    onCommit: (s: Stroke) => {
      history.push(s);
      refreshHistory();
      guard(store.addStroke(s));
    },
  });

  function undo() {
    const s = history.undo();
    if (!s) return;
    renderer.removeStroke(s.id);
    guard(store.deleteStroke(s.id));
    refreshHistory();
  }
  function redo() {
    const s = history.redo();
    if (!s) return;
    renderer.addStroke(s);
    guard(store.addStroke(s));
    refreshHistory();
  }

  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.key === '[') { pen.size = Math.max(1, pen.size - 1); toolbar.sync(); saveMeta(); }
    else if (e.key === ']') { pen.size = Math.min(40, pen.size + 1); toolbar.sync(); saveMeta(); }
  });

  refreshHistory();
}

main();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
