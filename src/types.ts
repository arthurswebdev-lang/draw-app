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
  /** Set when the eraser has cut this stroke: the points are an exact polyline, drawn without smoothing. */
  poly?: boolean;
};

/**
 * A placed icon. It keeps its identity rather than being flattened into pen
 * strokes at drop time, which is the whole reason it can be picked up and
 * resized or turned again a week later. Only `kind` is stored, not the drawing,
 * so correcting an icon in the library corrects every one already on the board.
 */
export type IconItem = {
  id: string;
  /** Key into the icon library. */
  kind: string;
  color: string;
  /** Outline width in world units. */
  size: number;
  /** Centre, in world units. Rotation turns about this point. */
  x: number;
  y: number;
  /** Side of the square drawing box, in world units. */
  box: number;
  /** Clockwise, radians. */
  rotation: number;
  bbox: BBox;
  createdAt: number;
};

export type ShapeKind = 'line' | 'rect' | 'ellipse' | 'polygon' | 'polyline';

/**
 * A drawn shape. Kept as its defining points, not as pixels or as a pen stroke,
 * so a square stays exactly square and a circle exactly round at any zoom.
 *
 * `pts` is [x1, y1, x2, y2] for a line, and for a rectangle or oval the two
 * opposite corners of its box. For a polygon or an open polyline it is every
 * vertex in turn: [x, y, x, y, ...].
 */
export type ShapeItem = {
  id: string;
  shape: ShapeKind;
  pts: number[];
  /** Outline colour. */
  color: string;
  /** Fill colour, or null for see-through. Only closed shapes use it. */
  fill: string | null;
  /** Outline width in world units. */
  size: number;
  bbox: BBox;
  createdAt: number;
};

/** Everything the board holds. Pen marks, icons and shapes live in one ordered list. */
export type Item = Stroke | IconItem | ShapeItem;

export const isIcon = (i: Item): i is IconItem => 'kind' in i;
export const isShape = (i: Item): i is ShapeItem => 'shape' in i;

export type Tool =
  | 'pen' | 'eraser' | 'stroke-eraser' | 'select'
  | 'line' | 'rect' | 'ellipse' | 'polygon';

/** Sizes are in screen pixels at the time of use. */
export type ToolSettings = {
  tool: Tool;
  color: string;
  size: number;
  eraserSize: number;
  /** Fill for new closed shapes; null leaves them see-through. */
  fill: string | null;
  /** Which eraser, and which shape, the toolbar's two grouped buttons show. */
  lastEraser: Tool;
  lastShape: Tool;
  /** Magnets for shapes: square, circle and 15 degree line snapping. Shift still forces them. */
  magnet: boolean;
  /**
   * Each tool's own size, so switching tools brings that tool's size back. `size`
   * and `eraserSize` above always hold the size of the tool in hand.
   */
  sizes: Partial<Record<Tool, number>>;
};

/**
 * One undoable action: items taken away and items put in.
 *
 * Deliberately `Item` and not `Stroke`: the pen and the eraser only ever hand it
 * strokes, which fit, while placing or transforming an icon uses the very same
 * machinery — so undo, redo and saving needed no second code path.
 */
export type Change = { removed: Item[]; added: Item[] };

export const STRIDE = 3;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
