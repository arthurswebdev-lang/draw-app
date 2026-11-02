import { BBox, TextItem } from '../types';

/**
 * Comic Sans where the system has it (Mac, Windows), else the closest simple,
 * friendly hand: Chalkboard SE ships with iPad and iPhone. Chosen for reading on
 * screen, not for print.
 */
export const TEXT_FONT = '"Comic Sans MS", "Comic Sans", "Chalkboard SE", "Comic Neue", "Marker Felt", cursive';
/** Line height, as a multiple of the font size. */
export const LINE_HEIGHT = 1.3;
/** Smallest font size a resize may reach, in world units. */
export const MIN_FONT = 4;

type Pt = { x: number; y: number };
const turn = (x: number, y: number, a: number): Pt => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** Width of one line at this font size. Estimated where there is no canvas (tests). */
function lineWidth(line: string, fontSize: number): number {
  if (measureCtx === undefined) {
    try { measureCtx = document.createElement('canvas').getContext('2d'); } catch { measureCtx = null; }
  }
  if (!measureCtx) return line.length * fontSize * 0.55;
  measureCtx.font = `${fontSize}px ${TEXT_FONT}`;
  return measureCtx.measureText(line).width;
}

/** The size of the text's box, in world units. An empty line still has height. */
export function measureText(text: string, fontSize: number): { w: number; h: number } {
  const lines = text.split('\n');
  const w = Math.max(fontSize * 0.5, ...lines.map(l => lineWidth(l, fontSize)));
  return { w, h: lines.length * fontSize * LINE_HEIGHT };
}

export function textBBox(t: Pick<TextItem, 'x' | 'y' | 'w' | 'h' | 'rotation'>): BBox {
  const c = Math.abs(Math.cos(t.rotation)), s = Math.abs(Math.sin(t.rotation));
  const rx = (t.w / 2) * c + (t.h / 2) * s, ry = (t.w / 2) * s + (t.h / 2) * c;
  return { minX: t.x - rx, minY: t.y - ry, maxX: t.x + rx, maxY: t.y + ry };
}

/** Is world point (wx, wy) inside the text's box? `pad` widens it on every side. */
export function hitText(t: TextItem, wx: number, wy: number, pad = 0): boolean {
  const l = turn(wx - t.x, wy - t.y, -t.rotation);
  return Math.abs(l.x) <= t.w / 2 + pad && Math.abs(l.y) <= t.h / 2 + pad;
}

/** Does the eraser, swept from a to b with this radius, touch the text's box? */
export function textTouches(t: TextItem, a: Pt, b: Pt, radius: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(radius * 0.5, 1e-3)));
  for (let n = 0; n <= steps; n++) {
    if (hitText(t, a.x + ((b.x - a.x) * n) / steps, a.y + ((b.y - a.y) * n) / steps, radius)) return true;
  }
  return false;
}

/** The box's top-left corner in world units (turned with the text). The text grows from here. */
export function textAnchor(t: Pick<TextItem, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Pt {
  const o = turn(-t.w / 2, -t.h / 2, t.rotation);
  return { x: t.x + o.x, y: t.y + o.y };
}

/**
 * A text item with new words (and font size), keeping its top-left corner where
 * it was, so typing grows the box to the right and down, as on paper.
 */
export function retext(t: TextItem, text: string, fontSize = t.fontSize, anchor = textAnchor(t)): TextItem {
  const { w, h } = measureText(text, fontSize);
  const c = turn(w / 2, h / 2, t.rotation);
  const next: TextItem = { ...t, text, fontSize, w, h, x: anchor.x + c.x, y: anchor.y + c.y };
  next.bbox = textBBox(next);
  return next;
}
