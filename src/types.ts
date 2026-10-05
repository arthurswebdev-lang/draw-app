export type Camera = { x: number; y: number; zoom: number };

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export type Stroke = {
  id: string;
  color: string;
  /** Width in world units. */
  size: number;
  /** Flat array: [x, y, pressure, x, y, pressure, ...] in world units. */
  points: Float32Array;
  bbox: BBox;
  createdAt: number;
};

/** Size is in screen pixels at the time of drawing. */
export type PenSettings = { color: string; size: number };

export const STRIDE = 3;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
