import { Camera, MAX_ZOOM, MIN_ZOOM } from './types';

export function worldToScreen(cam: Camera, wx: number, wy: number) {
  return { x: (wx - cam.x) * cam.zoom, y: (wy - cam.y) * cam.zoom };
}

export function screenToWorld(cam: Camera, sx: number, sy: number) {
  return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
}

export function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Zoom by `factor`, keeping the world point under screen point (sx, sy) fixed. */
export function zoomAt(cam: Camera, sx: number, sy: number, factor: number): Camera {
  const zoom = clampZoom(cam.zoom * factor);
  const w = screenToWorld(cam, sx, sy);
  return { zoom, x: w.x - sx / zoom, y: w.y - sy / zoom };
}

export function panBy(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  return { ...cam, x: cam.x - dxScreen / cam.zoom, y: cam.y - dyScreen / cam.zoom };
}
