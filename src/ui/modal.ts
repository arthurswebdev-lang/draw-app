import type { SyncStatus } from '../sync/client';
import { displayUrl, normalizeUrl } from '../sync/wire';

/** Asks before clearing the board. Resolves true only for "Start new". */
export function confirmNew(opts: { onSaveCopy: () => Promise<void>; synced?: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    const previous = document.activeElement as HTMLElement | null;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-text">
        <h2 id="modal-title">Start a new drawing?</h2>
        <p id="modal-text">This clears the board${opts.synced ? ' on this device and on your other synced devices' : ''}. You can undo it right away, but save a copy first if you want to keep this drawing.</p>
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
        <div class="modal-actions stack">
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

const escapeHtml = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * The sync dialog: the server address, the live connection state, and buttons to
 * connect or turn sync off. It stays open and updates while connecting.
 */
export function openSyncDialog(opts: {
  subscribe: (fn: (s: SyncStatus) => void) => () => void;
  onConnect: (url: string) => void;
  onTurnOff: () => void;
  onFollow: (on: boolean) => void;
}) {
  const previous = document.activeElement as HTMLElement | null;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sync-title">
      <h2 id="sync-title">Sync</h2>
      <p>Draw on one device and see it on the others. Every device needs the same address: the sync server on your Mac.</p>
      <label class="m-field" for="sync-url">Server address</label>
      <input class="m-input" id="sync-url" type="text" inputmode="url" autocapitalize="off" autocorrect="off"
        spellcheck="false" placeholder="your-mac.local:8443" />
      <div class="m-status" data-state="off" role="status"><i></i><span></span></div>
      <p class="m-help" hidden></p>
      <label class="m-toggle">
        <input type="checkbox" id="sync-follow" />
        <span><b>Follow the other device</b><br />
        Show the area the other device is looking at, and move with it. Moving or zooming here turns it off.</span>
      </label>
      <div class="modal-actions">
        <button type="button" class="m-danger" data-act="off" hidden>Turn off sync</button>
        <button type="button" class="m-secondary" data-act="connect">Connect</button>
        <button type="button" class="m-cancel" data-act="close">Close</button>
      </div>
    </div>`;
  const input = backdrop.querySelector<HTMLInputElement>('#sync-url')!;
  const statusEl = backdrop.querySelector<HTMLElement>('.m-status')!;
  const statusText = statusEl.querySelector('span')!;
  const help = backdrop.querySelector<HTMLElement>('.m-help')!;
  const connectBtn = backdrop.querySelector<HTMLButtonElement>('[data-act="connect"]')!;
  const offBtn = backdrop.querySelector<HTMLButtonElement>('[data-act="off"]')!;
  const follow = backdrop.querySelector<HTMLInputElement>('#sync-follow')!;
  const focusables = () => [input, follow, ...backdrop.querySelectorAll<HTMLButtonElement>('button:not([hidden])')];

  let current: SyncStatus | null = null;
  const render = (s: SyncStatus) => {
    const first = current === null;
    current = s;
    if (first && s.url) input.value = displayUrl(s.url);
    statusEl.dataset.state = s.state;
    follow.checked = s.follow;
    const waiting = s.pending ? ` · ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : '';
    statusText.textContent = {
      off: 'Sync is off',
      connecting: 'Connecting…',
      synced: `Connected · ${s.peers} device${s.peers === 1 ? '' : 's'}${waiting}`,
      offline: `Cannot reach the server${waiting}`,
    }[s.state];
    offBtn.hidden = s.state === 'off';
    connectBtn.textContent = s.state === 'off' ? 'Connect' : 'Reconnect';
    if (s.state === 'offline' && s.url) {
      // Opening the server's page in the browser is the quickest check: it fails
      // with a certificate warning if this device does not trust the certificate yet.
      const page = s.url.replace(/^ws/, 'http');
      help.innerHTML = `Check that the server is running on the Mac and that both devices are on the same Wi-Fi.
        Then <a href="${escapeHtml(page)}" target="_blank" rel="noopener">open the server page</a>:
        it should say “Draw sync server is running”. A certificate warning means this device
        does not trust the certificate yet.`;
      help.hidden = false;
    } else help.hidden = true;
  };
  const unsubscribe = opts.subscribe(render);

  const close = () => {
    unsubscribe();
    window.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    previous?.focus?.();
  };
  const connect = () => {
    const url = normalizeUrl(input.value);
    if (!url) { input.focus(); input.select(); return; }
    input.value = displayUrl(url);
    opts.onConnect(url);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); connect(); }
    else if (e.key === ' ' && document.activeElement === follow) { /* let the checkbox toggle */ }
    else if (e.key === 'Tab') {
      const list = focusables();
      const i = list.indexOf(document.activeElement as HTMLInputElement);
      const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i + 1) % list.length;
      e.preventDefault();
      list[next].focus();
    } else e.stopPropagation(); // typing must not reach the board's shortcuts
  };
  window.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('pointerdown', e => { if (e.target === backdrop) close(); });
  connectBtn.onclick = connect;
  follow.onchange = () => opts.onFollow(follow.checked);
  offBtn.onclick = () => { opts.onTurnOff(); };
  backdrop.querySelector<HTMLButtonElement>('[data-act="close"]')!.onclick = close;

  document.body.appendChild(backdrop);
  if (!input.value) input.focus();
  else connectBtn.focus();
}
