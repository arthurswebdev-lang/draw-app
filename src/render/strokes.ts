import { Camera, IconItem, isIcon, Item, Stroke, STRIDE } from '../types';
import { intersects } from '../geometry/bbox';
import { smooth, toPath2D } from '../geometry/smooth';
import { iconDef } from '../icons/library';
import { hitIcon, iconHandles } from '../geometry/icon';

export class Renderer {
  /** Pen marks and icons in one list, ordered by `createdAt` so they layer as drawn. */
  items: Item[] = [];

  /**
   * The pen marks alone. The eraser works only on strokes and asks for them every
   * move, so this stays a view over `items` rather than a second array that would
   * have to be kept in step with it.
   */
  get strokes(): Stroke[] { return this.items.filter(i => !isIcon(i)) as Stroke[]; }

  get icons(): IconItem[] { return this.items.filter(isIcon); }
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  private cache = new Map<string, Path2D>();
  /** Keyed by icon *kind*: every lamp on the board shares one set of paths. */
  private iconCache = new Map<string, Path2D[]>();
  /** Drawn on top of everything, and owned by the select tool. */
  selection: IconItem | null = null;
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

  private drawItem(ctx: CanvasRenderingContext2D, i: Item) {
    if (isIcon(i)) this.drawIcon(ctx, i);
    else this.drawStroke(ctx, i, this.pathFor(i));
  }

  private pathFor(s: Stroke): Path2D {
    let p = this.cache.get(s.id);
    if (!p) {
      p = toPath2D(smooth(s.points), s.size);
      this.cache.set(s.id, p);
    }
    return p;
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
    if (this.selection) this.drawSelection(ctx, this.selection);
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
  private drawSelection(ctx: CanvasRenderingContext2D, i: IconItem) {
    const z = this.camera.zoom;
    const { corners, anchor, rotate } = iconHandles(i, z);

    ctx.save();
    ctx.strokeStyle = '#1971c2';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5 / z;
    ctx.setLineDash([5 / z, 4 / z]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(rotate.x, rotate.y);
    ctx.stroke();

    const r = 5 / z;
    for (const c of corners) {
      ctx.beginPath();
      ctx.rect(c.x - r, c.y - r, r * 2, r * 2);
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
  replaceIcon(next: IconItem) {
    const at = this.items.findIndex(i => i.id === next.id);
    if (at !== -1) this.items[at] = next;
    this.selection = next;
    this.requestRedraw();
  }

  select(i: IconItem | null) {
    this.selection = i;
    this.requestRedraw();
  }

  /** The topmost icon under a world point, so a tap picks what is visibly on top. */
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

  private redrawLive() {
    const ctx = this.liveCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.liveCanvas.width, this.liveCanvas.height);
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
