import { PenSettings } from '../types';

const SWATCHES = ['#1e1e1e', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#6741d9', '#c2255c', '#868e96'];

export function createToolbar(el: HTMLElement, opts: {
  pen: PenSettings;
  onPenChange: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomReset: () => void;
}) {
  const { pen } = opts;
  el.innerHTML = `
    <div class="swatches"></div>
    <input type="color" id="color" title="Custom color" />
    <span class="sep"></span>
    <input type="range" id="size" min="1" max="40" step="1" title="Pen size ([ and ])" />
    <span class="preview"><i id="dot"></i></span>
    <span class="sep"></span>
    <button id="undo" title="Undo (Cmd/Ctrl+Z)">↶</button>
    <button id="redo" title="Redo (Shift+Cmd/Ctrl+Z)">↷</button>
    <span class="sep"></span>
    <button id="zoom" title="Reset zoom">100%</button>`;
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const swatchBox = q('.swatches');
  const color = q<HTMLInputElement>('#color');
  const size = q<HTMLInputElement>('#size');
  const dot = q('#dot');
  const undo = q<HTMLButtonElement>('#undo');
  const redo = q<HTMLButtonElement>('#redo');
  const zoom = q<HTMLButtonElement>('#zoom');

  for (const c of SWATCHES) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.color = c;
    b.style.background = c;
    b.title = c;
    b.onclick = () => { pen.color = c; sync(); opts.onPenChange(); };
    swatchBox.appendChild(b);
  }
  color.oninput = () => { pen.color = color.value; sync(); opts.onPenChange(); };
  size.oninput = () => { pen.size = Number(size.value); sync(); opts.onPenChange(); };
  undo.onclick = opts.onUndo;
  redo.onclick = opts.onRedo;
  zoom.onclick = opts.onZoomReset;

  function sync() {
    color.value = /^#[0-9a-f]{6}$/i.test(pen.color) ? pen.color : '#000000';
    size.value = String(pen.size);
    dot.style.width = dot.style.height = `${pen.size}px`;
    dot.style.background = pen.color;
    swatchBox.querySelectorAll<HTMLElement>('.swatch').forEach(b =>
      b.classList.toggle('active', b.dataset.color === pen.color));
  }
  sync();

  return {
    sync,
    setHistory(canUndo: boolean, canRedo: boolean) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
    setZoom(z: number) { zoom.textContent = `${Math.round(z * 100)}%`; },
  };
}
