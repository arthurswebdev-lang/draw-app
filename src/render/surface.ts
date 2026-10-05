/** Keeps both canvases sharp: backing size = CSS size * devicePixelRatio. */
export function createSurface(
  canvases: HTMLCanvasElement[],
  onResize: () => void,
) {
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    // Keep the backing store under ~16M pixels (iPad limit).
    const limit = Math.sqrt(16_000_000 / (w * h));
    const eff = Math.min(dpr, limit);
    for (const c of canvases) {
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.width = Math.round(w * eff);
      c.height = Math.round(h * eff);
    }
    onResize();
  };

  let mq: MediaQueryList | undefined;
  const watchDpr = () => {
    mq?.removeEventListener('change', onDprChange);
    mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', onDprChange);
  };
  const onDprChange = () => { watchDpr(); fit(); };

  new ResizeObserver(fit).observe(document.documentElement);
  watchDpr();
  fit();
  return {
    get dpr() { return canvases[0].width / window.innerWidth; },
  };
}
