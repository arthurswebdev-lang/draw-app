import './style.css';
import { createStore } from './store/db';
import { Renderer } from './render/strokes';
import { createSurface } from './render/surface';
import { updateGrid } from './render/grid';
import { attachPen } from './input/pen';
import { attachNavigate } from './input/navigate';
import { attachEraser } from './input/eraser';
import { attachSelect } from './input/select';
import { createToolbar } from './ui/toolbar';
import { createIconsPanel } from './ui/icons-panel';
import { History } from './state/history';
import { screenToWorld } from './camera';
import { Camera, Change, Tool, ToolSettings } from './types';

async function main() {
  const board = document.getElementById('board')!;
  const badge = document.getElementById('badge')!;
  const renderer = new Renderer(
    document.getElementById('strokes') as HTMLCanvasElement,
    document.getElementById('live') as HTMLCanvasElement,
  );
  const history = new History();
  const settings: ToolSettings = { tool: 'pen', color: '#1e1e1e', size: 4, eraserSize: 24 };

  const store = await createStore();
  const savedCam = await store.getMeta<Camera>('camera');
  const savedSettings = await store.getMeta<ToolSettings>('pen');
  if (savedCam) renderer.camera = savedCam;
  if (savedSettings) Object.assign(settings, savedSettings);
  renderer.setItems(await store.getAllItems());
  navigator.storage?.persist?.().catch(() => {});

  const guard = (p: Promise<unknown>) =>
    p.then(() => { badge.hidden = true; }, err => { console.error(err); badge.hidden = false; });

  let metaTimer = 0;
  const saveMeta = () => {
    clearTimeout(metaTimer);
    metaTimer = window.setTimeout(() => {
      guard(Promise.all([store.setMeta('camera', renderer.camera), store.setMeta('pen', { ...settings })]));
    }, 300);
  };

  const toolbar = createToolbar(document.getElementById('toolbar')!, {
    settings,
    onChange: () => { applyTool(); saveMeta(); },
    onUndo: () => undo(),
    onRedo: () => redo(),
    onZoomReset: () => setCamera({ ...renderer.camera, zoom: 1 }),
    onIcons: () => { toolbar.setIconsOpen(panel.toggle()); },
  });

  const panel = createIconsPanel(document.getElementById('icons-panel')!, {
    getColor: () => settings.color,
    onPick: kind => {
      // Placed at the middle of what is on screen and already selected, so the
      // next drag moves it. Tapping a tile and then having to aim at the board
      // is one gesture too many on a phone.
      const mid = screenToWorld(renderer.camera, window.innerWidth / 2, window.innerHeight / 2);
      setTool('select');
      select?.place(kind, mid.x, mid.y);
    },
  });
  // Declared before applyTool() first runs; assigned once the board is wired up.
  let eraser: ReturnType<typeof attachEraser> | undefined;
  let select: ReturnType<typeof attachSelect> | undefined;
  const applyTool = () => {
    document.body.dataset.tool = settings.tool;
    eraser?.refresh();
    // Leaving the select tool drops the handles: they would otherwise sit over
    // the drawing offering a grab that no longer does anything.
    if (settings.tool !== 'select') select?.clear();
    panel.refresh();
  };
  applyTool();
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
  const commit = (c: Change) => {
    history.push(c);
    refreshHistory();
    guard(store.applyChange(c.removed, c.added));
  };
  attachPen({ board, renderer, getSettings: () => settings, isNavigating: nav.isNavigating, onCommit: commit });
  eraser = attachEraser({ board, renderer, getSettings: () => settings, isNavigating: nav.isNavigating, onCommit: commit });
  select = attachSelect({
    board, renderer,
    getSettings: () => settings,
    isNavigating: nav.isNavigating,
    onCommit: commit,
    onSelect: () => {},
  });

  function undo() {
    const c = history.undo();
    if (!c) return;
    renderer.applyChange(c.added, c.removed);
    guard(store.applyChange(c.added, c.removed));
    refreshHistory();
  }
  function redo() {
    const c = history.redo();
    if (!c) return;
    renderer.applyChange(c.removed, c.added);
    guard(store.applyChange(c.removed, c.added));
    refreshHistory();
  }

  const setTool = (t: Tool) => { settings.tool = t; toolbar.sync(); applyTool(); saveMeta(); };

  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (!mod && e.key.toLowerCase() === 'p') setTool('pen');
    else if (!mod && e.key.toLowerCase() === 'e') setTool('eraser');
    else if (!mod && e.key.toLowerCase() === 'x') setTool('stroke-eraser');
    else if (!mod && e.key.toLowerCase() === 'v') setTool('select');
    else if (!mod && e.key.toLowerCase() === 'i') { toolbar.setIconsOpen(panel.toggle()); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); select?.deleteSelected(); }
    else if (e.key === 'Escape') select?.clear();
    else if (e.key === '[' || e.key === ']') {
      const d = e.key === '[' ? -1 : 1;
      if (settings.tool === 'pen') settings.size = Math.min(40, Math.max(1, settings.size + d));
      else settings.eraserSize = Math.min(120, Math.max(4, settings.eraserSize + d * 2));
      toolbar.sync(); saveMeta(); eraser?.refresh();
    }
  });

  refreshHistory();
}

main();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
