import { Camera } from '../types';

const BASE = 24;

export function updateGrid(board: HTMLElement, cam: Camera) {
  let step = BASE * cam.zoom;
  while (step < 10) step *= 2;
  const ox = -((cam.x * cam.zoom) % step);
  const oy = -((cam.y * cam.zoom) % step);
  board.style.backgroundSize = `${step}px ${step}px`;
  board.style.backgroundPosition = `${ox}px ${oy}px`;
}
