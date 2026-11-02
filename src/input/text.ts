import { screenToWorld } from '../camera';
import { hitText, LINE_HEIGHT, measureText, retext, TEXT_FONT, textAnchor, textBBox } from '../geometry/text';
import { Renderer } from '../render/strokes';
import { Change, isText, TextItem, ToolSettings } from '../types';

/**
 * The text tool. A tap on the board opens a text box there; a tap on a text opens
 * that text. Typing happens in a real <textarea> laid over the board at the same
 * place, size and turn as the text, so the iPad keyboard, Pencil handwriting
 * (Scribble), autocorrect, copy and paste all work as everywhere else.
 *
 * Enter makes a new line. Escape, Cmd/Ctrl+Enter, or a tap anywhere else finishes.
 * A text left empty is removed.
 */
export function attachText(opts: {
  board: HTMLElement;
  renderer: Renderer;
  getSettings: () => ToolSettings;
  isNavigating: () => boolean;
  onCommit: (c: Change) => void;
}) {
  const { board, renderer } = opts;
  let editing: {
    el: HTMLTextAreaElement;
    item: TextItem;
    /** The text as it was before, or null for a new one. */
    original: TextItem | null;
  } | null = null;

  /** Puts the text box exactly over where the text is drawn. */
  function place() {
    if (!editing) return;
    const { el, item } = editing;
    const cam = renderer.camera;
    const a = textAnchor(item);
    const z = cam.zoom;
    el.style.left = `${(a.x - cam.x) * z}px`;
    el.style.top = `${(a.y - cam.y) * z}px`;
    el.style.fontSize = `${item.fontSize * z}px`;
    el.style.lineHeight = String(LINE_HEIGHT);
    el.style.color = item.color;
    // Room for the next letter, so the box never scrolls while typing.
    el.style.width = `${(item.w + item.fontSize) * z}px`;
    el.style.height = `${item.h * z}px`;
    el.style.transform = `rotate(${item.rotation}rad)`;
  }

  function open(item: TextItem, original: TextItem | null) {
    const el = document.createElement('textarea');
    el.className = 'text-editor';
    el.value = item.text;
    el.rows = 1;
    el.setAttribute('aria-label', 'Text');
    el.style.fontFamily = TEXT_FONT;
    editing = { el, item, original };
    renderer.editingId = item.id;
    renderer.requestRedraw();
    place();
    document.body.appendChild(el);

    el.addEventListener('input', () => {
      if (!editing) return;
      editing.item = retext(editing.item, el.value);
      place();
    });
    el.addEventListener('keydown', e => {
      // The board's shortcuts (P, E, Delete...) must not fire while typing.
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        finish();
      }
    });
    el.addEventListener('blur', () => finish());
    // Inside the press that opened it, so iOS shows the keyboard.
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }

  /** Ends typing: adds, changes or removes the text as one undoable step. */
  function finish() {
    if (!editing) return;
    const { el, item, original } = editing;
    editing = null;
    renderer.editingId = null;
    el.remove();
    const text = el.value.replace(/\s+$/, '');
    let change: Change | null = null;
    if (!text.trim()) {
      if (original) change = { removed: [original], added: [] };
    } else {
      const done = retext(item, text);
      if (!original) change = { removed: [], added: [done] };
      else if (original.text !== done.text) change = { removed: [original], added: [done] };
    }
    if (change) {
      renderer.applyChange(change.removed, change.added);
      opts.onCommit(change);
    }
    renderer.requestRedraw();
  }

  /** A new, empty text whose top-left corner is at world point p. */
  function make(p: { x: number; y: number }): TextItem {
    const s = opts.getSettings();
    // A fixed size on screen, like an icon: text arrives readable at any zoom.
    const fontSize = (s.size * 2) / renderer.camera.zoom;
    const { w, h } = measureText('', fontSize);
    const t: TextItem = {
      id: crypto.randomUUID(), text: '', color: s.color, fontSize,
      x: p.x + w / 2, y: p.y + h / 2, w, h, rotation: 0,
      bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, createdAt: Date.now(),
    };
    t.bbox = textBBox(t);
    return t;
  }

  board.addEventListener('pointerdown', e => {
    if (opts.getSettings().tool !== 'text' || e.button !== 0 || opts.isNavigating()) return;
    // Stops the browser moving the focus to the board, which would close the box at once.
    e.preventDefault();
    if (editing) { finish(); return; } // a tap elsewhere just finishes typing
    const p = screenToWorld(renderer.camera, e.clientX, e.clientY);
    const pad = 6 / renderer.camera.zoom;
    let hit: TextItem | null = null;
    for (let n = renderer.items.length - 1; n >= 0; n -= 1) {
      const i = renderer.items[n];
      if (isText(i) && hitText(i, p.x, p.y, pad)) { hit = i; break; }
    }
    if (hit) open(hit, hit);
    else open(make(p), null);
  });

  return {
    /** Opens an existing text for typing (a double tap with the select tool). */
    edit(t: TextItem) {
      finish();
      open(t, t);
    },
    /** The board moved or zoomed: keep the text box over the text. */
    refresh: place,
    finish,
    get editing() { return !!editing; },
  };
}
