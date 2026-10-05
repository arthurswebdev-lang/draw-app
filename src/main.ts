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
import { iconDef } from './icons/library';
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
    // The colours and line size also restyle the selected icon.
    onRestyle: patch => {
      if (settings.tool !== 'select') return;
      select?.restyle(patch.size === undefined ? patch : { size: patch.size / renderer.camera.zoom });
    },
  });

  const panel = createIconsPanel(document.getElementById('icons-panel')!, {
    getColor: () => settings.color,
    onPick: kind => {
      // Choosing a tile only arms the board: the icon lands where you press next,
      // then stays selected so you can move, resize or turn it.
      setTool('select');
      select?.arm(kind);
      // On a narrow screen the panel would cover the spot you want to tap.
      if (window.innerWidth < 900) { panel.close(); toolbar.setIconsOpen(false); }
    },
  });
  const hint = document.getElementById('hint')!;
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
    onSelect: i => {
      // Show the icon's own colour and line size in the toolbar, so touching
      // either one edits what is selected rather than something unseen.
      if (!i) return;
      settings.color = i.color;
      settings.size = Math.min(40, Math.max(1, Math.round(i.size * renderer.camera.zoom)));
      toolbar.sync();
    },
    onArmChange: kind => {
      panel.setArmed(kind);
      document.body.dataset.armed = kind ? '1' : '';
      hint.hidden = !kind;
      if (kind) hint.textContent = `Tap the board to place: ${iconDef(kind)?.label ?? 'icon'}`;
    },
  });

  // Lets the icon panel sit just under the toolbar, however many rows it wraps to.
  const toolbarEl = document.getElementById('toolbar')!;
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--toolbar-h', `${toolbarEl.offsetHeight}px`);
  }).observe(toolbarEl);

  function undo() {
    select?.flush();
    const c = history.undo();
    if (!c) return;
    select?.clear();
    renderer.applyChange(c.added, c.removed);
    guard(store.applyChange(c.added, c.removed));
    refreshHistory();
  }
  function redo() {
    select?.flush();
    const c = history.redo();
    if (!c) return;
    select?.clear();
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
