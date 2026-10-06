import type { Renderer } from '../render/strokes';

export type PngBackground = 'white' | 'transparent';

const BG_KEY = 'draw.pngBackground';

/** The background chosen last time, so the dialog can highlight it. */
export function lastBackground(): PngBackground {
  try { return localStorage.getItem(BG_KEY) === 'transparent' ? 'transparent' : 'white'; } catch { return 'white'; }
}
export function rememberBackground(bg: PngBackground) {
  try { localStorage.setItem(BG_KEY, bg); } catch { /* private mode: the choice just is not remembered */ }
}

export function exportPng(renderer: Renderer, background: PngBackground = 'white'): Promise<Blob | null> {
  const canvas = renderer.exportCanvas({ background });
  if (!canvas) return Promise.resolve(null);
  return new Promise(resolve => canvas.toBlob(b => resolve(b && b.size > 0 ? b : null), 'image/png'));
}

/**
 * Opens the share sheet where there is one (iPad, iPhone), otherwise downloads the file.
 *
 * Only the file is handed over, with no title or text. Some places in the iOS share
 * sheet (Messages, Notes) send a title as the message and drop the image beside it,
 * which is how a share ended up as just the word "Drawing". If the share sheet
 * cannot be used for any reason other than the user closing it, the picture is
 * saved as a download instead of being lost.
 */
export async function shareOrSave(blob: Blob): Promise<'shared' | 'saved' | 'cancelled'> {
  if (blob.size === 0) throw new Error('The picture is empty');
  const file = new File([blob], 'drawing.png', { type: 'image/png', lastModified: Date.now() });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      console.warn('Sharing failed, saving instead', err);
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
