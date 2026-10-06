import type { Renderer } from '../render/strokes';

export function exportPng(renderer: Renderer): Promise<Blob | null> {
  const canvas = renderer.exportCanvas();
  if (!canvas) return Promise.resolve(null);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}

/** Opens the share sheet where there is one (iPad), otherwise downloads the file. */
export async function shareOrSave(blob: Blob): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], 'drawing.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Drawing' });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drawing.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
