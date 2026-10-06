import { Tool, ToolSettings } from '../types';

const SWATCHES = ['#1e1e1e', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#6741d9', '#c2255c', '#868e96'];

const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICONS: Record<Tool, string> = {
  pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  eraser: svg('<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'),
  'stroke-eraser': svg('<path d="M3 17c3-8 6-8 8-3s5 3 10-7"/><path d="m14 14 7 7M21 14l-7 7"/>'),
  select: svg('<path d="M4 4h4M16 4h4M4 20h4M16 20h4M4 4v4M20 4v4M4 16v4M20 16v4"/><path d="m10 10 5 2-2 1-1 2z"/>'),
  rect: svg('<rect x="3.5" y="6" width="17" height="12" rx="1.5"/>'),
  ellipse: svg('<ellipse cx="12" cy="12" rx="9" ry="6.5"/>'),
  line: svg('<path d="M5 19 19 5"/>'),
  polygon: svg('<path d="M12 3.5 20 9.5 17 19.5H7L4 9.5z"/>'),
};
const TITLES: Record<Tool, string> = {
  pen: 'Pen (P)',
  eraser: 'Eraser: rubs out the part you touch (E)',
  'stroke-eraser': 'Object eraser: deletes a whole line or icon at once (X)',
  select: 'Select: move, resize and turn an icon (V)',
  rect: 'Rectangle: near a square it snaps to a square (R)',
  ellipse: 'Oval: near a circle it snaps to a circle (O)',
  line: 'Line (L)',
  polygon: 'Polygon: click each corner, return to the first to close (G)',
};
// Under each tool, because a finger has no tooltip to read.
const CAPTIONS: Record<Tool, string> = {
  pen: 'Pen', eraser: 'Eraser', 'stroke-eraser': 'Object', select: 'Select',
  rect: 'Rect', ellipse: 'Oval', line: 'Line', polygon: 'Polygon',
};

const MAGNET_ICON = svg('<path d="M6 3v10a6 6 0 0 0 12 0V3"/><path d="M6 8h4M14 8h4"/><path class="slash" d="M3 3l18 18"/>');
const SHARE_ICON = svg('<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>');
const NEW_ICON = svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6M9 14h6"/>');
const LIBRARY_ICON = svg('<rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17.5" cy="6.5" r="3.5"/><path d="M3 21l3.5-7L10 21z"/><rect x="14" y="14" width="7" height="7" rx="1"/>');

/** A toolbar button that stands for several tools, and shows the one in use. */
type SlotDef = { id: string; tools: Tool[]; remember: 'lastEraser' | 'lastShape' };
const SLOTS: SlotDef[] = [
  { id: 'erasers', tools: ['eraser', 'stroke-eraser'], remember: 'lastEraser' },
  { id: 'shapes', tools: ['rect', 'ellipse', 'line', 'polygon'], remember: 'lastShape' },
];

export function createToolbar(el: HTMLElement, opts: {
  settings: ToolSettings;
  onChange: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomReset: () => void;
  /** Zoom in or out by this factor, about the middle of the screen. */
  onZoomBy: (factor: number) => void;
  onIcons: () => void;
  onShare: () => void;
  onNew: () => void;
  /** The colour or line size was picked: restyle the selected icon, if any. */
  onRestyle?: (patch: { color?: string; size?: number; fill?: string | null }) => void;
}) {
  const { settings } = opts;
  // Four groups. When the bar is too narrow it wraps between groups, never inside one.
  el.innerHTML = `
    <div class="grp tools"></div>
    <div class="grp colors">
      <div class="swatches"></div>
      <label class="colorwell" title="Custom color"><input type="color" id="color" /></label>
      <div class="slot fillslot">
        <button id="fill" class="tool fillbtn" title="Fill colour for new shapes" aria-label="Fill colour">
          <span class="fillchip"></span><span class="cap">Fill</span>
        </button>
        <div class="flyout fills" hidden></div>
      </div>
    </div>
    <div class="grp sizing">
      <input type="range" id="size" title="Size ([ and ])" />
      <span class="preview"><i id="dot"></i></span>
    </div>
    <div class="grp actions">
      <button id="icons" title="Icon library (I)" aria-label="Icon library">${LIBRARY_ICON}</button>
      <button id="share" title="Share or save as PNG" aria-label="Share or save as PNG">${SHARE_ICON}</button>
      <button id="new" title="New drawing" aria-label="New drawing">${NEW_ICON}</button>
      <button id="undo" title="Undo (Cmd/Ctrl+Z)" aria-label="Undo">↶</button>
      <button id="redo" title="Redo (Shift+Cmd/Ctrl+Z)" aria-label="Redo">↷</button>
      <button id="zoomout" title="Zoom out" aria-label="Zoom out">−</button>
      <button id="zoom" title="Reset zoom to 100%">100%</button>
      <button id="zoomin" title="Zoom in" aria-label="Zoom in">+</button>
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
  const fillBtn = q<HTMLButtonElement>('#fill');
  const fillFly = q('.fills');
  const fillSlot = q('.fillslot');

  const isEraser = () => settings.tool === 'eraser' || settings.tool === 'stroke-eraser';

  // ---- flyouts: one open at a time, kept on screen ----
  const flyouts = [...el.querySelectorAll<HTMLElement>('.flyout')];
  const timers = new WeakMap<HTMLElement, number>();
  function closeAll(except?: HTMLElement) {
    for (const f of flyouts) if (f !== except) f.hidden = true;
  }
  function open(fly: HTMLElement) {
    closeAll(fly);
    fly.hidden = false;
    fly.style.setProperty('--shift', '0px');
    const r = fly.getBoundingClientRect();
    const margin = 8;
    let shift = 0;
    if (r.left < margin) shift = margin - r.left;
    else if (r.right > window.innerWidth - margin) shift = window.innerWidth - margin - r.right;
    fly.style.setProperty('--shift', `${shift}px`);
  }
  /** Hovering a mouse over the slot opens its flyout; leaving closes it after a short grace. */
  function hoverable(slot: HTMLElement, fly: HTMLElement) {
    slot.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timers.get(fly));
      timers.set(fly, window.setTimeout(() => open(fly), 80));
    });
    slot.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timers.get(fly));
      timers.set(fly, window.setTimeout(() => { fly.hidden = true; }, 250));
    });
  }
  // A press anywhere outside an open flyout closes it.
  document.addEventListener('pointerdown', e => {
    for (const f of flyouts) {
      if (!f.hidden && !f.parentElement!.contains(e.target as Node)) f.hidden = true;
    }
  }, true);

  // ---- tools: pen | erasers | shapes | select ----
  const toolButton = (t: Tool, cls = 'tool') => {
    const b = document.createElement('button');
    b.className = cls;
    b.dataset.tool = t;
    b.title = TITLES[t];
    b.innerHTML = `${ICONS[t]}<span class="cap">${CAPTIONS[t]}</span>`;
    return b;
  };
  const plain = (t: Tool) => {
    const b = toolButton(t);
    b.onclick = () => { settings.tool = t; closeAll(); sync(); opts.onChange(); };
    return b;
  };

  const magnetBtn = document.createElement('button');
  magnetBtn.className = 'magnetbtn';
  magnetBtn.innerHTML = `${MAGNET_ICON}<span class="cap">Magnet</span><span class="pill"></span>`;
  const magnetPill = magnetBtn.querySelector<HTMLElement>('.pill')!;

  const slotEls = new Map<string, { def: SlotDef; main: HTMLButtonElement; fly: HTMLElement }>();
  toolBox.appendChild(plain('pen'));
  for (const def of SLOTS) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const main = document.createElement('button');
    main.className = 'tool slot-main';
    const fly = document.createElement('div');
    fly.className = 'flyout';
    fly.hidden = true;
    const row = def.id === 'shapes' ? document.createElement('div') : fly;
    if (row !== fly) { row.className = 'flyrow'; fly.classList.add('tworow'); fly.appendChild(row); }
    for (const t of def.tools) {
      const b = toolButton(t);
      b.onclick = () => {
        settings.tool = t;
        settings[def.remember] = t;
        fly.hidden = true;
        sync();
        opts.onChange();
      };
      row.appendChild(b);
    }
    if (def.id === 'shapes') {
      // Stays open on click, so the change is visible; never touches the active tool.
      magnetBtn.onclick = () => { settings.magnet = !settings.magnet; sync(); opts.onChange(); };
      fly.appendChild(magnetBtn);
    }
    main.onclick = () => {
      if (def.tools.includes(settings.tool)) {
        // Already using one of these: this tap asks for the others.
        if (fly.hidden) open(fly); else fly.hidden = true;
      } else {
        settings.tool = settings[def.remember] ?? def.tools[0];
        closeAll();
        sync();
        opts.onChange();
      }
    };
    slot.append(main, fly);
    hoverable(slot, fly);
    toolBox.appendChild(slot);
    slotEls.set(def.id, { def, main, fly });
  }
  toolBox.appendChild(plain('select'));

  // ---- colours ----
  for (const c of SWATCHES) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.color = c;
    b.style.background = c;
    b.title = c;
    b.onclick = () => { pickColor(c); };
    swatchBox.appendChild(b);
  }

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

  // ---- fill for closed shapes: none, or one of the colours ----
  const noneChip = document.createElement('button');
  noneChip.className = 'swatch none';
  noneChip.title = 'No fill (see-through)';
  noneChip.setAttribute('aria-label', 'No fill');
  noneChip.onclick = () => pickFill(null);
  fillFly.appendChild(noneChip);
  for (const c of SWATCHES) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.fill = c;
    b.style.background = c;
    b.title = `Fill ${c}`;
    b.onclick = () => pickFill(c);
    fillFly.appendChild(b);
  }
  function pickFill(c: string | null) {
    settings.fill = c;
    fillFly.hidden = true;
    sync();
    opts.onChange();
    opts.onRestyle?.({ fill: c }); // fills the selected shape too
  }
  fillBtn.onclick = () => { if (fillFly.hidden) open(fillFly); else fillFly.hidden = true; };
  hoverable(fillSlot, fillFly);

  color.oninput = () => pickColor(color.value);
  size.oninput = () => {
    const v = Number(size.value);
    if (isEraser()) settings.eraserSize = v; else settings.size = v;
    sync(); opts.onChange();
    if (!isEraser()) opts.onRestyle?.({ size: v });
  };
  icons.onclick = opts.onIcons;
  q('#share').onclick = () => opts.onShare();
  q('#new').onclick = () => opts.onNew();
  let zoomNow = 1;
  undo.onclick = opts.onUndo;
  redo.onclick = opts.onRedo;
  zoom.onclick = opts.onZoomReset;
  q('#zoomout').onclick = () => opts.onZoomBy(1 / 1.25);
  q('#zoomin').onclick = () => opts.onZoomBy(1.25);

  function sync() {
    const pen = !isEraser();
    icons.classList.toggle('active', settings.tool === 'select');
    color.value = /^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : '#000000';
    color.parentElement!.style.setProperty('--c', settings.color);
    size.min = pen ? '1' : '4';
    size.max = pen ? '40' : '120';
    size.value = String(pen ? settings.size : settings.eraserSize);
    // Line sizes are world units, so the chip shows them as they look at this zoom.
    const px = pen ? Math.min(40, Math.max(2, settings.size * zoomNow)) : Math.min(settings.eraserSize, 40);
    dot.style.width = dot.style.height = `${px}px`;
    dot.style.background = pen ? settings.color : 'transparent';
    dot.style.border = pen ? 'none' : '1.5px solid #495057';
    swatchBox.querySelectorAll<HTMLElement>('.swatch').forEach(b =>
      b.classList.toggle('active', b.dataset.color === settings.color));

    // Each grouped button shows the tool it will use: the one in hand, else the last used.
    for (const { def, main } of slotEls.values()) {
      if (def.tools.includes(settings.tool)) settings[def.remember] = settings.tool;
      const cur = def.tools.includes(settings[def.remember]) ? settings[def.remember] : def.tools[0];
      main.dataset.shows = cur;
      main.title = TITLES[cur];
      main.innerHTML = `${ICONS[cur]}<span class="cap">${CAPTIONS[cur]}</span>`;
      main.classList.toggle('active', def.tools.includes(settings.tool));
    }
    el.querySelectorAll<HTMLElement>('.tool[data-tool]').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === settings.tool));

    magnetBtn.classList.toggle('on', settings.magnet);
    magnetBtn.setAttribute('aria-pressed', String(settings.magnet));
    magnetBtn.title = `Magnet: snaps squares, circles and angles (${settings.magnet ? 'on' : 'off'})`;
    magnetPill.textContent = settings.magnet ? 'ON' : 'OFF';

    fillBtn.style.setProperty('--fill', settings.fill ?? '#fff');
    fillBtn.classList.toggle('nofill', settings.fill === null);
    fillFly.querySelectorAll<HTMLElement>('.swatch').forEach(b =>
      b.classList.toggle('active', settings.fill === (b.dataset.fill ?? null)));
  }
  sync();

  return {
    sync,
    setHistory(canUndo: boolean, canRedo: boolean) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
    setZoom(z: number) { zoomNow = z; zoom.textContent = `${Math.round(z * 100)}%`; sync(); },
    setIconsOpen(open: boolean) { icons.classList.toggle('open', open); },
  };
}
