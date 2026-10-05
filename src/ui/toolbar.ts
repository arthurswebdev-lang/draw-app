import { Tool, ToolSettings } from '../types';

const SWATCHES = ['#1e1e1e', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#6741d9', '#c2255c', '#868e96'];

const ICONS: Record<Tool, string> = {
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>',
  'stroke-eraser': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-8 6-8 8-3s5 3 10-7"/><path d="m14 14 7 7M21 14l-7 7"/></svg>',
  select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4M16 4h4M4 20h4M16 20h4M4 4v4M20 4v4M4 16v4M20 16v4"/><path d="m10 10 5 2-2 1-1 2z"/></svg>',
};
const TITLES: Record<Tool, string> = {
  pen: 'Pen (P)',
  eraser: 'Eraser: erase parts of strokes (E)',
  'stroke-eraser': 'Stroke eraser: delete whole strokes it touches (X)',
  select: 'Select: move, resize and turn an icon (V)',
};

export function createToolbar(el: HTMLElement, opts: {
  settings: ToolSettings;
  onChange: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomReset: () => void;
  onIcons: () => void;
  /** The colour or line size was picked: restyle the selected icon, if any. */
  onRestyle?: (patch: { color?: string; size?: number }) => void;
}) {
  const { settings } = opts;
  // Four groups. When the bar is too narrow it wraps between groups, never inside one.
  el.innerHTML = `
    <div class="grp tools"></div>
    <div class="grp colors">
      <div class="swatches"></div>
      <input type="color" id="color" title="Custom color" />
    </div>
    <div class="grp sizing">
      <input type="range" id="size" title="Size ([ and ])" />
      <span class="preview"><i id="dot"></i></span>
    </div>
    <div class="grp actions">
      <button id="icons" title="Icon library (I)">Icons</button>
      <button id="undo" title="Undo (Cmd/Ctrl+Z)" aria-label="Undo">↶</button>
      <button id="redo" title="Redo (Shift+Cmd/Ctrl+Z)" aria-label="Redo">↷</button>
      <button id="zoom" title="Reset zoom">100%</button>
    </div>`;
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const toolBox = q('.tools');
  const swatchBox = q('.swatches');
  const color = q<HTMLInputElement>('#color');
  const size = q<HTMLInputElement>('#size');
  const dot = q('#dot');
  const undo = q<HTMLButtonElement>('#undo');
  const redo = q<HTMLButtonElement>('#redo');
  const zoom = q<HTMLButtonElement>('#zoom');
  const icons = q<HTMLButtonElement>('#icons');

  for (const t of Object.keys(ICONS) as Tool[]) {
    const b = document.createElement('button');
    b.className = 'tool';
    b.dataset.tool = t;
    b.title = TITLES[t];
    b.innerHTML = ICONS[t];
    b.onclick = () => { settings.tool = t; sync(); opts.onChange(); };
    toolBox.appendChild(b);
  }
  for (const c of SWATCHES) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.color = c;
    b.style.background = c;
    b.title = c;
    b.onclick = () => { pickColor(c); };
    swatchBox.appendChild(b);
  }
  const isEraser = () => settings.tool === 'eraser' || settings.tool === 'stroke-eraser';

  /**
   * The colours stay live whatever the tool. Picking one with an eraser in hand
   * means you want to draw, so it hands you the pen; with an icon selected it
   * recolours that icon and leaves the select tool alone.
   */
  function pickColor(c: string) {
    settings.color = c;
    if (isEraser()) settings.tool = 'pen';
    sync();
    opts.onChange();
    opts.onRestyle?.({ color: c });
  }

  color.oninput = () => pickColor(color.value);
  size.oninput = () => {
    const v = Number(size.value);
    if (isEraser()) settings.eraserSize = v; else settings.size = v;
    sync(); opts.onChange();
    if (!isEraser()) opts.onRestyle?.({ size: v });
  };
  icons.onclick = opts.onIcons;
  undo.onclick = opts.onUndo;
  redo.onclick = opts.onRedo;
  zoom.onclick = opts.onZoomReset;

  function sync() {
    const pen = !isEraser();
    icons.classList.toggle('active', settings.tool === 'select');
    color.value = /^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : '#000000';
    size.min = pen ? '1' : '4';
    size.max = pen ? '40' : '120';
    size.value = String(pen ? settings.size : settings.eraserSize);
    const px = Math.min(pen ? settings.size : settings.eraserSize, 40);
    dot.style.width = dot.style.height = `${px}px`;
    dot.style.background = pen ? settings.color : 'transparent';
    dot.style.border = pen ? 'none' : '1.5px solid #495057';
    swatchBox.querySelectorAll<HTMLElement>('.swatch').forEach(b =>
      b.classList.toggle('active', b.dataset.color === settings.color));
    toolBox.querySelectorAll<HTMLElement>('.tool').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === settings.tool));
  }
  sync();

  return {
    sync,
    setHistory(canUndo: boolean, canRedo: boolean) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
    setZoom(z: number) { zoom.textContent = `${Math.round(z * 100)}%`; },
    setIconsOpen(open: boolean) { icons.classList.toggle('open', open); },
  };
}
