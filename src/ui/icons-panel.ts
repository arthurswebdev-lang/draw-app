import { iconsIn, SPHERES } from '../icons/library';

/**
 * The icon drawer: a sphere down the top, its groups as tabs, then the grid.
 *
 * Each tile is the real icon definition rendered as an inline SVG, not a picture
 * of it — the same path data the board strokes. So a tile can never drift out of
 * step with what it places, and it inherits the chosen colour for free.
 */
export function createIconsPanel(el: HTMLElement, opts: {
  getColor: () => string;
  onPick: (kind: string) => void;
}) {
  let armedKind: string | null = null;
  let sphere = SPHERES[0].id;
  let group = SPHERES[0].groups[0];

  el.innerHTML = `
    <div class="panel__head">
      <div class="panel__spheres"></div>
      <button class="panel__close" title="Close">✕</button>
    </div>
    <div class="panel__tabs"></div>
    <div class="panel__grid"></div>`;
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const spheresBox = q('.panel__spheres');
  const tabsBox = q('.panel__tabs');
  const grid = q('.panel__grid');

  for (const s of SPHERES) {
    const b = document.createElement('button');
    b.className = 'panel__sphere';
    b.dataset.sphere = s.id;
    b.textContent = s.label;
    b.onclick = () => {
      sphere = s.id;
      // Back to the first tab: the old one almost never exists in a new sphere,
      // and an empty grid reads as a broken panel.
      group = s.groups[0];
      render();
    };
    spheresBox.appendChild(b);
  }

  q<HTMLButtonElement>('.panel__close').onclick = () => { el.hidden = true; };

  function render() {
    const current = SPHERES.find(s => s.id === sphere)!;

    spheresBox.querySelectorAll<HTMLElement>('.panel__sphere').forEach(b =>
      b.classList.toggle('active', b.dataset.sphere === sphere));

    tabsBox.replaceChildren(...current.groups.map(g => {
      const b = document.createElement('button');
      b.className = 'panel__tab';
      b.textContent = g;
      b.classList.toggle('active', g === group);
      b.onclick = () => { group = g; render(); };

      return b;
    }));

    const color = opts.getColor();
    grid.replaceChildren(...iconsIn(sphere, group).map(def => {
      const b = document.createElement('button');
      b.className = 'panel__icon';
      b.title = def.label;
      b.classList.toggle('armed', def.id === armedKind);
      b.innerHTML = `<svg viewBox="-6 -6 112 112" fill="none" stroke="${color}"
        stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        ${def.d.map(d => `<path d="${d}"/>`).join('')}
      </svg><span>${def.label}</span>`;
      b.onclick = () => opts.onPick(def.id);

      return b;
    }));
  }

  render();

  return {
    /** Marks the tile that will be dropped on the board next. */
    setArmed(kind: string | null) {
      armedKind = kind;
      grid.querySelectorAll<HTMLElement>('.panel__icon').forEach((b, i) => {
        b.classList.toggle('armed', iconsIn(sphere, group)[i]?.id === kind);
      });
    },
    /** Redraws the tiles in the current colour. */
    refresh: render,
    close() { el.hidden = true; },
    toggle() {
      el.hidden = !el.hidden;
      if (!el.hidden) render();

      return !el.hidden;
    },
    get open() { return !el.hidden; },
  };
}
