import { Camera, IconItem, isIcon, isShape, Item, Selectable, ShapeItem, Stroke, STRIDE } from '../types';
import { intersects } from '../geometry/bbox';
import { polyline, smooth, toPath2D } from '../geometry/smooth';
import { iconDef } from '../icons/library';
import { hitIcon } from '../geometry/icon';
import { buildShapePath, shapeTouches } from '../geometry/shape';
import { boxHandles, handlesFor, selectionBox } from '../geometry/selection';
import { Guide, guidesFor } from '../geometry/guides';

export class Renderer {
  /** Pen marks and icons in one list, ordered by `createdAt` so they layer as drawn. */
  items: Item[] = [];

  /**
   * The pen marks alone. The eraser works only on strokes and asks for them every
   * move, so this stays a view over `items` rather than a second array that would
   * have to be kept in step with it.
   */
  get strokes(): Stroke[] { return this.items.filter(i => !isIcon(i) && !isShape(i)) as Stroke[]; }

  get shapes(): ShapeItem[] { return this.items.filter(isShape); }

  get icons(): IconItem[] { return this.items.filter(isIcon); }
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  private cache = new Map<string, Path2D>();
  /** Keyed by icon *kind*: every lamp on the board shares one set of paths. */
  private iconCache = new Map<string, Path2D[]>();
  /** Drawn on top of everything, and owned by the select tool. */
  selection: Selectable | null = null;
  private raf = 0;
  private strokesCtx: CanvasRenderingContext2D;
  private liveCtx: CanvasRenderingContext2D;

  constructor(
    private strokesCanvas: HTMLCanvasElement,
    private liveCanvas: HTMLCanvasElement,
  ) {
    this.strokesCtx = strokesCanvas.getContext('2d')!;
    this.liveCtx = liveCanvas.getContext('2d', { desynchronized: true })!;
  }

  private get scale() { return this.strokesCanvas.width / window.innerWidth; }

  private applyTransform(ctx: CanvasRenderingContext2D) {
    const k = this.scale * this.camera.zoom;
    ctx.setTransform(k, 0, 0, k, -this.camera.x * k, -this.camera.y * k);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  private drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, path: Path2D) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    if (s.points.length / STRIDE === 1) ctx.fill(path);
    else ctx.stroke(path);
  }

  private iconPaths(kind: string): Path2D[] | undefined {
    let paths = this.iconCache.get(kind);
    if (!paths) {
      const def = iconDef(kind);
      // An id no longer in the library draws nothing rather than throwing the
      // whole frame away — one bad row must not take the board down.
      if (!def) return undefined;
      paths = def.d.map(d => new Path2D(d));
      this.iconCache.set(kind, paths);
    }
    return paths;
  }

  /**
   * Draws an icon from its square 0..100 definition.
   *
   * The scale is uniform, so the outline keeps one weight all the way round, and
   * `lineWidth` is divided by that scale to cancel it — asked for in world units,
   * the outline must not thicken just because the icon was made bigger.
   */
  private drawIcon(ctx: CanvasRenderingContext2D, i: IconItem) {
    const paths = this.iconPaths(i.kind);
    if (!paths) return;
    const k = i.box / 100;

    ctx.save();
    ctx.translate(i.x, i.y);
    ctx.rotate(i.rotation);
    ctx.scale(k, k);
    ctx.translate(-50, -50);
    ctx.strokeStyle = i.color;
    ctx.lineWidth = i.size / k;
    for (const p of paths) ctx.stroke(p);
    ctx.restore();
  }

  /**
   * Does an eraser sweeping from a to b (a disc of `radius`) touch the icon's
   * drawn outline? Uses the real paths, not the box, so an eraser passing through
   * the empty middle of a lamp, or close beside it, leaves it alone.
   *
   * The icon's outline is stroked fat enough to reach the eraser's edge, then the
   * eraser's centre line is sampled against it. The samples are closer together
   * than the fat stroke is wide, so a thin crossing cannot slip between two.
   */
  iconTouches(i: IconItem, a: { x: number; y: number }, b: { x: number; y: number }, radius: number): boolean {
    const paths = this.iconPaths(i.kind);
    if (!paths) return false;
    const ctx = (this.hitCtx ??= document.createElement('canvas').getContext('2d')!);
    const k = i.box / 100;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(i.x, i.y);
    ctx.rotate(i.rotation);
    ctx.scale(k, k);
    ctx.translate(-50, -50);
    ctx.lineWidth = (2 * radius + i.size) / k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(radius * 0.5, 1e-3)));
    for (let n = 0; n <= steps; n++) {
      const x = a.x + ((b.x - a.x) * n) / steps, y = a.y + ((b.y - a.y) * n) / steps;
      for (const p of paths) if (ctx.isPointInStroke(p, x, y)) return true;
    }
    return false;
  }

  private hitCtx?: CanvasRenderingContext2D;

  /** Fill first, then the outline over it, so the line is never half hidden. */
  private drawShape(ctx: CanvasRenderingContext2D, s: ShapeItem, cached = true) {
    let path = cached ? this.cache.get(s.id) : undefined;
    if (!path) {
      path = buildShapePath(s);
      if (cached) this.cache.set(s.id, path);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = s.size;
    const turned = !!s.rotation && (s.shape === 'rect' || s.shape === 'ellipse');
    if (turned) {
      // Built upright, then turned about its own centre.
      ctx.save();
      ctx.translate((s.pts[0] + s.pts[2]) / 2, (s.pts[1] + s.pts[3]) / 2);
      ctx.rotate(s.rotation!);
      ctx.translate(-(s.pts[0] + s.pts[2]) / 2, -(s.pts[1] + s.pts[3]) / 2);
    }
    if (s.fill && s.shape !== 'line' && s.shape !== 'polyline') {
      ctx.fillStyle = s.fill;
      ctx.fill(path);
    }
    ctx.strokeStyle = s.color;
    ctx.stroke(path);
    if (turned) ctx.restore();
  }

  private drawItem(ctx: CanvasRenderingContext2D, i: Item) {
    if (isIcon(i)) this.drawIcon(ctx, i);
    else if (isShape(i)) this.drawShape(ctx, i);
    else this.drawStroke(ctx, i, this.pathFor(i));
  }

  private pathFor(s: Stroke): Path2D {
    let p = this.cache.get(s.id);
    if (!p) {
      p = toPath2D(s.poly ? polyline(s.points) : smooth(s.points), s.size);
      this.cache.set(s.id, p);
    }
    return p;
  }

  /**
   * Draws every committed item onto a new white canvas, fitted to the drawing.
   * No selection, no live draft, and the on-screen camera is not touched.
   */
  exportCanvas(opts: { scale?: number; pad?: number; maxSide?: number; maxPixels?: number; background?: 'white' | 'transparent' } = {}): HTMLCanvasElement | null {
    if (this.items.length === 0) return null;
    const pad = opts.pad ?? 32;
    const maxSide = opts.maxSide ?? 4096;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const i of this.items) {
      minX = Math.min(minX, i.bbox.minX); minY = Math.min(minY, i.bbox.minY);
      maxX = Math.max(maxX, i.bbox.maxX); maxY = Math.max(maxY, i.bbox.maxY);
    }
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
    const w = maxX - minX + 2 * pad, h = maxY - minY + 2 * pad;
    // iPhone Safari refuses (or silently blanks) canvases of more than about 16 million
    // pixels, so stay well inside that as well as inside a side limit.
    const maxPixels = opts.maxPixels ?? 8_000_000;
    const k = Math.min(opts.scale ?? 2, maxSide / Math.max(w, h), Math.sqrt(maxPixels / (w * h)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * k));
    canvas.height = Math.max(1, Math.round(h * k));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if ((opts.background ?? 'white') === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(k, 0, 0, k, (-minX + pad) * k, (-minY + pad) * k);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const i of this.items) this.drawItem(ctx, i);
    return canvas;
  }

  /** Request a full redraw of committed strokes (one per frame). */
  requestRedraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.redraw(); });
  }

  redraw() {
    const ctx = this.strokesCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.strokesCanvas.width, this.strokesCanvas.height);
    this.applyTransform(ctx);
    const c = this.camera;
    const view = {
      minX: c.x, minY: c.y,
      maxX: c.x + window.innerWidth / c.zoom, maxY: c.y + window.innerHeight / c.zoom,
    };
    for (const i of this.items) {
      if (!intersects(i.bbox, view)) continue;
      this.drawItem(ctx, i);
    }
    if (this.selection) {
      this.drawSelection(ctx, this.selection);
      this.drawSelectionGuide(ctx, this.selection);
    }
    this.redrawLive();
  }

  /**
   * The box and handles around the selected icon.
   *
   * Every length is divided by the zoom, so the outline stays hairline-thin and
   * the handles stay thumb-sized however far in or out the board is. Drawn after
   * the items and never cached — it is chrome, not part of the drawing, and it
   * must not end up in an export or under another icon.
   */
  /**
   * The angles and sizes of a selected shape, so they can be read after it has been
   * drawn and while it is resized, turned or reshaped. Icons have none.
   */
  private drawSelectionGuide(ctx: CanvasRenderingContext2D, i: Selectable) {
    if (isIcon(i)) return;
    const c = this.camera;
    const g = guidesFor(i.shape, i.pts, c.zoom, i.rotation ?? 0);
    if (!g) return;
    const s = this.scale;
    ctx.save();
    ctx.setTransform(s, 0, 0, s, 0, 0);
    this.drawGuide(ctx, g, p => ({ x: (p.x - c.x) * c.zoom, y: (p.y - c.y) * c.zoom }));
    ctx.restore();
  }

  private drawSelection(ctx: CanvasRenderingContext2D, i: Selectable) {
    const z = this.camera.zoom;
    const { corners, anchor, rotate, vertices, box } = handlesFor(i, z);

    ctx.save();
    ctx.strokeStyle = '#1971c2';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5 / z;
    ctx.setLineDash([5 / z, 4 / z]);
    if (box) {
      // The dashed frame. A bare line has none: its two end dots are the handles.
      const [c0, ...rest] = boxHandles(selectionBox(i), z).corners;
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      for (const c of rest) ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(rotate.x, rotate.y);
    ctx.stroke();

    // Bigger handles for a finger than for a mouse.
    const r = (window.matchMedia('(pointer: coarse)').matches ? 9 : 5) / z;
    for (const c of corners) {
      ctx.beginPath();
      ctx.rect(c.x - r, c.y - r, r * 2, r * 2);
      ctx.fill();
      ctx.stroke();
    }
    // A dot on each vertex of a line, polygon or open path: drag one to reshape it.
    for (const v of vertices) {
      ctx.beginPath();
      ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(rotate.x, rotate.y, r + 1 / z, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Take `remove` out and put `add` in. Draw order follows createdAt. */
  applyChange(remove: Item[], add: Item[]) {
    const last = this.items[this.items.length - 1];
    // The fast path only holds while nothing is selected: a selected icon draws a
    // box and handles over the top, and those have to be repainted with it.
    if (!remove.length && !this.selection && add.every(s => !last || s.createdAt >= last.createdAt)) {
      this.applyTransform(this.strokesCtx);
      for (const i of add) {
        this.items.push(i);
        this.drawItem(this.strokesCtx, i);
      }
      return;
    }
    const ids = new Set(remove.map(s => s.id));
    this.items = this.items.filter(s => !ids.has(s.id));
    for (const id of ids) this.cache.delete(id);
    this.items.push(...add);
    this.items.sort((a, b) => a.createdAt - b.createdAt);
    this.requestRedraw();
  }

  setItems(list: Item[]) {
    this.items = list;
    this.cache.clear();
    this.requestRedraw();
  }

  /** Replaces an icon in place, for a drag in progress. No history, no store. */
  replaceItem(next: Selectable) {
    // The saved outline belongs to the old geometry; drawing from it would show the
    // shape where it used to be.
    this.cache.delete(next.id);
    const at = this.items.findIndex(i => i.id === next.id);
    if (at !== -1) this.items[at] = next;
    this.selection = next;
    this.requestRedraw();
  }

  select(i: Selectable | null) {
    this.selection = i;
    this.requestRedraw();
  }

  /** The topmost icon under a world point, so a tap picks what is visibly on top. */
  /**
   * The topmost icon or shape under a world point. A shape counts where it is
   * drawn: on its outline, and inside it only when it is filled, so an empty
   * rectangle can be picked by its edge and drawn inside without grabbing it.
   */
  selectableAt(wx: number, wy: number, pad = 0): Selectable | null {
    const p = { x: wx, y: wy };
    for (let n = this.items.length - 1; n >= 0; n -= 1) {
      const i = this.items[n];
      if (isIcon(i) && hitIcon(i, wx, wy, pad)) return i;
      if (isShape(i) && shapeTouches(i, p, p, pad)) return i;
    }
    return null;
  }

  iconAt(wx: number, wy: number, pad = 0): IconItem | null {
    for (let n = this.items.length - 1; n >= 0; n -= 1) {
      const i = this.items[n];
      if (isIcon(i) && hitIcon(i, wx, wy, pad)) return i;
    }
    return null;
  }

  // ---- live stroke ----
  private live: { points: Float32Array; color: string; size: number } | null = null;
  private liveRaf = 0;

  setLive(points: Float32Array | null, color = '#000', size = 1) {
    this.live = points ? { points, color, size } : null;
    if (!this.liveRaf) {
      this.liveRaf = requestAnimationFrame(() => { this.liveRaf = 0; this.redrawLive(); });
    }
  }

  // ---- shape being drawn ----
  private draft: { item: ShapeItem | null; markers: { x: number; y: number }[]; ring: { x: number; y: number } | null; guide: Guide | null } | null = null;

  /**
   * The shape under construction. `markers` are dots at placed polygon vertices;
   * `ring` is the circle that shows the next click will close the polygon.
   */
  setDraft(
    item: ShapeItem | null,
    markers: { x: number; y: number }[] = [],
    ring: { x: number; y: number } | null = null,
    guide: Guide | null = null,
  ) {
    this.draft = item || markers.length || ring || guide ? { item, markers, ring, guide } : null;
    if (!this.liveRaf) {
      this.liveRaf = requestAnimationFrame(() => { this.liveRaf = 0; this.redrawLive(); });
    }
  }

  private drawDraft(ctx: CanvasRenderingContext2D) {
    const d = this.draft;
    if (!d) return;
    if (d.item) {
      this.applyTransform(ctx);
      this.drawShape(ctx, d.item, false);
    }
    // Markers and ring are chrome: fixed size on screen, whatever the zoom.
    const s = this.scale, c = this.camera;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const at = (p: { x: number; y: number }) => ({ x: (p.x - c.x) * c.zoom, y: (p.y - c.y) * c.zoom });
    ctx.fillStyle = '#1971c2';
    for (const m of d.markers) {
      const p = at(m);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (d.guide) this.drawGuide(ctx, d.guide, at);
    if (d.ring) {
      const p = at(d.ring);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(25, 113, 194, 0.18)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1971c2';
      ctx.stroke();
    }
  }

  /**
   * Measuring guides: thin cyan lines, angle arcs and small labels, all in screen
   * pixels so they stay readable at any zoom. They turn green when the shape is
   * exactly square, round, or on a 15 degree step, so a snap is easy to see.
   */
  private drawGuide(ctx: CanvasRenderingContext2D, g: Guide, at: (p: { x: number; y: number }) => { x: number; y: number }) {
    const line = g.exact ? 'rgba(18, 184, 134, 0.9)' : 'rgba(21, 170, 191, 0.85)';
    const ink = g.exact ? '#087f5b' : '#0b7285';
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = line;
    ctx.setLineDash([]);
    for (const [x1, y1, x2, y2] of g.solid) {
      const a = at({ x: x1, y: y1 }), b = at({ x: x2, y: y2 });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([4, 3]);
    ctx.globalAlpha = 0.7;
    for (const [x1, y1, x2, y2] of g.dashed) {
      const a = at({ x: x1, y: y1 }), b = at({ x: x2, y: y2 });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineWidth = 1.75;
    for (const a of g.arcs) {
      const p = at(a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, a.r, a.a0, a.a0 + a.sweep, a.sweep < 0);
      ctx.stroke();
    }
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of g.labels) {
      const p = at(l);
      const x = p.x + l.dx, y = p.y + l.dy;
      const w = ctx.measureText(l.text).width + 10, h = 16;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 5, y - h / 2);
      ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, 5);
      ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, 5);
      ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, 5);
      ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, 5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fillText(l.text, x, y + 0.5);
    }
  }

  private redrawLive() {
    const ctx = this.liveCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.liveCanvas.width, this.liveCanvas.height);
    this.drawDraft(ctx);
    if (!this.live) return;
    this.applyTransform(ctx);
    const { points, color, size } = this.live;
    const path = toPath2D(smooth(points), size);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    if (points.length / STRIDE === 1) ctx.fill(path);
    else ctx.stroke(path);
  }
}
