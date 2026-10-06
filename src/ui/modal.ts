/** Asks before clearing the board. Resolves true only for "Start new". */
export function confirmNew(opts: { onSaveCopy: () => Promise<void> }): Promise<boolean> {
  return new Promise(resolve => {
    const previous = document.activeElement as HTMLElement | null;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-text">
        <h2 id="modal-title">Start a new drawing?</h2>
        <p id="modal-text">This clears the board. You can undo it right away, but save a copy first if you want to keep this drawing.</p>
        <div class="modal-actions">
          <button type="button" class="m-secondary" data-act="save">Save a copy</button>
          <button type="button" class="m-danger" data-act="new">Start new</button>
          <button type="button" class="m-cancel" data-act="cancel">Cancel</button>
        </div>
      </div>`;
    const card = backdrop.querySelector<HTMLElement>('.modal')!;
    const saveBtn = backdrop.querySelector<HTMLButtonElement>('[data-act="save"]')!;
    const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>('button')];

    const close = (result: boolean) => {
      window.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      previous?.focus?.();
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
        e.preventDefault();
        buttons[next].focus();
      } else e.stopPropagation(); // Keys such as Delete or Ctrl+Z must not reach the board.
    };
    window.addEventListener('keydown', onKey, true);

    backdrop.addEventListener('pointerdown', e => { if (e.target === backdrop) close(false); });
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      try { await opts.onSaveCopy(); } catch (err) { console.error(err); }
      saveBtn.disabled = false;
    };
    backdrop.querySelector<HTMLButtonElement>('[data-act="new"]')!.onclick = () => close(true);
    backdrop.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.onclick = () => close(false);

    document.body.appendChild(backdrop);
    card.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.focus();
  });
}

/**
 * Asks which background the PNG should have, then hands back the finished picture.
 *
 * Both versions start rendering as soon as the dialog opens, so the picture is ready
 * the moment a button is pressed. That matters on iOS, which only allows the share
 * sheet to open shortly after a tap: nothing slow may sit between the tap and the
 * share call. Resolves null if the dialog is cancelled or the picture fails.
 */
export function chooseBackground(opts: {
  initial: 'white' | 'transparent';
  render: (bg: 'white' | 'transparent') => Promise<Blob | null>;
}): Promise<{ bg: 'white' | 'transparent'; blob: Blob } | null> {
  return new Promise(resolve => {
    const previous = document.activeElement as HTMLElement | null;
    const ready = { white: opts.render('white'), transparent: opts.render('transparent') };
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const mark = (bg: string) => (bg === opts.initial ? ' m-secondary' : '');
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bg-title">
        <h2 id="bg-title">Share as PNG</h2>
        <p>Choose the background of the picture.</p>
        <div class="modal-actions">
          <button type="button" class="m-bg${mark('white')}" data-bg="white"><span class="bg-chip"></span>White background</button>
          <button type="button" class="m-bg${mark('transparent')}" data-bg="transparent"><span class="bg-chip clear"></span>Transparent background</button>
          <button type="button" class="m-cancel" data-act="cancel">Cancel</button>
        </div>
      </div>`;
    const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>('button')];

    const close = (result: { bg: 'white' | 'transparent'; blob: Blob } | null) => {
      window.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      previous?.focus?.();
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      else if (e.key === 'Tab') {
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
        e.preventDefault();
        buttons[next].focus();
      } else e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('pointerdown', e => { if (e.target === backdrop) close(null); });

    for (const b of backdrop.querySelectorAll<HTMLButtonElement>('[data-bg]')) {
      b.onclick = async () => {
        const bg = b.dataset.bg as 'white' | 'transparent';
        const blob = await ready[bg];
        close(blob ? { bg, blob } : null);
      };
    }
    backdrop.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.onclick = () => close(null);

    document.body.appendChild(backdrop);
    backdrop.querySelector<HTMLButtonElement>(`[data-bg="${opts.initial}"]`)!.focus();
  });
}
