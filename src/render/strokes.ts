import { Camera, Stroke, STRIDE } from '../types';
import { intersects } from '../geometry/bbox';
import { smooth, toPath2D } from '../geometry/smooth';

export class Renderer {
  strokes: Stroke[] = [];
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  private cache = new Map<string, Path2D>();
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
    for (const s of this.strokes) {
      if (!intersects(s.bbox, view)) continue;
      this.drawStroke(ctx, s, this.pathFor(s));
    }
    this.redrawLive();
  }

  addStroke(s: Stroke) {
    this.strokes.push(s);
    this.applyTransform(this.strokesCtx);
    this.drawStroke(this.strokesCtx, s, this.pathFor(s));
  }

  removeStroke(id: string) {
    this.strokes = this.strokes.filter(s => s.id !== id);
    this.cache.delete(id);
    this.requestRedraw();
  }

  setStrokes(list: Stroke[]) {
    this.strokes = list;
    this.cache.clear();
    this.requestRedraw();
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
