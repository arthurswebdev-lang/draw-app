import './style.css';
import { createStore } from './store/db';
import { Renderer } from './render/strokes';
import { createSurface } from './render/surface';
import { updateGrid } from './render/grid';
import { attachPen } from './input/pen';
import { attachNavigate } from './input/navigate';
import { attachEraser } from './input/eraser';
import { attachSelect } from './input/select';
import { attachShapes } from './input/shapes';
import { zoomAt } from './camera';
import { createToolbar } from './ui/toolbar';
import { createIconsPanel } from './ui/icons-panel';
import { exportPng, shareOrSave } from './export/png';
import { confirmNew } from './ui/modal';
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
  const settings: ToolSettings = {
    tool: 'pen', color: '#1e1e1e', size: 4, eraserSize: 24,
    fill: null, lastEraser: 'eraser', lastShape: 'rect', magnet: true, sizes: {},
  };
  const isEraserTool = (t: Tool) => t === 'eraser' || t === 'stroke-eraser';
  const defaultSize = (t: Tool) => (isEraserTool(t) ? 24 : 4);

  const store = await createStore();
  const savedCam = await store.getMeta<Camera>('camera');
  const savedSettings = await store.getMeta<ToolSettings>('pen');
  if (savedCam) renderer.camera = savedCam;
  if (savedSettings) Object.assign(settings, savedSettings, { sizes: { ...savedSettings.sizes } });
  // Settings saved before the shape tools existed can name a tool that is not here.
  if (!['pen', 'eraser', 'stroke-eraser', 'select', 'line', 'rect', 'ellipse', 'polygon'].includes(settings.tool)) settings.tool = 'pen';
  renderer.setItems(await store.getAllItems());
  navigator.storage?.persist?.().catch(() => {});

  const guard = (p: Promise<unknown>) =>
    p.then(() => { badge.hidden = true; }, err => { console.error(err); badge.hidden = false; });

  let metaTimer = 0;
  const saveMeta = () => {
    clearTimeout(metaTimer);
    metaTimer = window.setTimeout(() => {
      settings.sizes[settings.tool] = isEraserTool(settings.tool) ? settings.eraserSize : settings.size;
      guard(Promise.all([store.setMeta('camera', renderer.camera), store.setMeta('pen', { ...settings })]));
    }, 300);
  };

  const toolbar = createToolbar(document.getElementById('toolbar')!, {
    settings,
    onChange: () => { applyTool(); saveMeta(); },
    onUndo: () => undo(),
    onRedo: () => redo(),
    // Zoom about the middle of the screen, so what you are looking at stays put.
    onZoomBy: f => setCamera(zoomAt(renderer.camera, window.innerWidth / 2, window.innerHeight / 2, f)),
    onZoomReset: () => setCamera(zoomAt(renderer.camera, window.innerWidth / 2, window.innerHeight / 2, 1 / renderer.camera.zoom)),
    onIcons: () => { toolbar.setIconsOpen(panel.toggle()); },
    onShare: () => { void shareFlow(); },
    onNew: () => { void newFlow(); },
    // The colours and line size also restyle the selected icon.
    onRestyle: patch => {
      if (settings.tool !== 'select') return;
      select?.restyle(patch);
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
  let shapes: ReturnType<typeof attachShapes> | undefined;
  let prevTool = settings.tool;
  const applyTool = () => {
    if (settings.tool !== prevTool) {
      // Every tool keeps its own size: put away the one being left, bring back the
      // one being picked. (Icons use the select tool's size, so a thick pen never
      // makes thick icons, and picking an icon to resize never changes the pen.)
      settings.sizes[prevTool] = isEraserTool(prevTool) ? settings.eraserSize : settings.size;
      const size = settings.sizes[settings.tool] ?? defaultSize(settings.tool);
      if (isEraserTool(settings.tool)) settings.eraserSize = size; else settings.size = size;
      prevTool = settings.tool;
      shapes?.cancel();
      toolbar.sync();
    }
    document.body.dataset.tool = settings.tool;
    eraser?.refresh();
    // Leaving the select tool drops the handles: they would otherwise sit over
    // the drawing offering a grab that no longer does anything.
    if (settings.tool !== 'select') select?.clear();
    panel.refresh();
  };
  applyTool();
  let toastTimer = 0;
  const toast = (msg: string) => {
    hint.textContent = msg;
    hint.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { hint.hidden = true; }, 2000);
  };
  async function shareFlow() {
    if (renderer.items.length === 0) { toast('Nothing to share yet'); return; }
    try {
      const blob = await exportPng(renderer);
      if (!blob) { toast('Nothing to share yet'); return; }
      await shareOrSave(blob);
    } catch (err) {
      console.error(err);
      toast('Could not save the picture');
    }
  }
  async function newFlow() {
    shapes?.cancel();
    if (renderer.items.length === 0) { setCamera({ x: 0, y: 0, zoom: 1 }); return; }
    select?.flush();
    const ok = await confirmNew({ onSaveCopy: shareFlow });
    if (!ok) return;
    const change = { removed: [...renderer.items], added: [] as typeof renderer.items };
    select?.clear();
    shapes?.cancel();
    renderer.applyChange(change.removed, []);
    history.push(change);
    refreshHistory();
    guard(store.applyChange(change.removed, change.added));
    setCamera({ x: 0, y: 0, zoom: 1 });
  }
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
    // Selecting an icon deliberately leaves the toolbar alone: it must never
    // overwrite the colour or size you chose with those of an old icon.
    onSelect: () => {},
    onArmChange: kind => {
      panel.setArmed(kind);
      document.body.dataset.armed = kind ? '1' : '';
      hint.hidden = !kind;
      if (kind) hint.textContent = `Tap the board to place: ${iconDef(kind)?.label ?? 'icon'}`;
    },
  });

  // Lets the icon panel, hint and badge keep clear of the bars, however many rows they
  // wrap to. On a tablet there is one box (#toolbar). On a phone the box is gone and
  // there are two bars: --toolbar-h is the bottom one, --top-h the top one.
  const toolbarEl = document.getElementById('toolbar')!;
  const barMain = toolbarEl.querySelector<HTMLElement>('.bar-main')!;
  const barAux = toolbarEl.querySelector<HTMLElement>('.bar-aux')!;
  const measure = () => {
    const root = document.documentElement.style;
    root.setProperty('--toolbar-h', `${toolbarEl.offsetHeight || barMain.offsetHeight}px`);
    root.setProperty('--top-h', `${barAux.offsetHeight}px`);
  };
  const bars = new ResizeObserver(measure);
  for (const e of [toolbarEl, barMain, barAux]) bars.observe(e);
  window.addEventListener('resize', measure);

  shapes = attachShapes({ board, renderer, getSettings: () => settings, isNavigating: nav.isNavigating, onCommit: commit });

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
    else if (!mod && e.key.toLowerCase() === 'l') setTool('line');
    else if (!mod && e.key.toLowerCase() === 'r') setTool('rect');
    else if (!mod && e.key.toLowerCase() === 'o') setTool('ellipse');
    else if (!mod && e.key.toLowerCase() === 'g') setTool('polygon');
    else if (!mod && e.key.toLowerCase() === 'i') { toolbar.setIconsOpen(panel.toggle()); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); select?.deleteSelected(); }
    else if (e.key === 'Escape') select?.clear();
    else if (e.key === '[' || e.key === ']') {
      const d = e.key === '[' ? -1 : 1;
      if (isEraserTool(settings.tool)) settings.eraserSize = Math.min(120, Math.max(4, settings.eraserSize + d * 2));
      else settings.size = Math.min(40, Math.max(1, settings.size + d));
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
