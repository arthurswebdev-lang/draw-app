/**
 * The icon library: stroke-only vector drawings, grouped into spheres and tabs.
 *
 * Every icon is drawn inside a 0..100 box and is **outline only** — no fills, no
 * colours of its own. It is stroked with whatever colour and width the toolbar
 * is set to, so one definition serves every colour and every size, and nothing
 * in here has to know about either.
 *
 * `d` is SVG path data, handed straight to `new Path2D(d)`. That keeps an icon a
 * few hundred bytes of text rather than an image, and it stays sharp at any zoom
 * because it is re-stroked every frame rather than scaled from pixels.
 *
 * Adding one is a single entry. Keep to the 0..100 box, leave a little air at the
 * edges, and draw centred so rotation turns about the middle of the shape.
 */

export type IconDef = {
  /** Stable id. It is stored on every placed icon, so never rename one. */
  id: string;
  label: string;
  sphere: string;
  group: string;
  /**
   * One or more SVG subpaths, each stroked.
   *
   * Every icon draws its own proportions *inside* the square box — a pipe is a
   * wide thin pair of lines across it. The box stays square so scaling is always
   * uniform, which is what keeps the outline the same weight all the way round;
   * scaling the two axes apart would thin it one way and fatten it the other.
   */
  d: string[];
};

export type Sphere = { id: string; label: string; groups: string[] };

// ── Electronics ────────────────────────────────────────────────────────────
// A wall plate is the same rounded square throughout, so a row of switches and
// sockets reads as one family on the drawing.
const PLATE = 'M18 14h64a4 4 0 0 1 4 4v64a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z';

const ELECTRONICS: IconDef[] = [
  { id: 'switch-1', label: 'Switch', sphere: 'electronics', group: 'Home',
    d: [PLATE, 'M50 32v36', 'M36 50h28'] },
  { id: 'switch-2', label: '2-button switch', sphere: 'electronics', group: 'Home',
    d: [PLATE, 'M50 20v60', 'M26 50h18', 'M56 50h18'] },
  { id: 'switch-3', label: '3-button switch', sphere: 'electronics', group: 'Home',
    d: [PLATE, 'M38 20v60', 'M62 20v60', 'M22 50h10', 'M44 50h12', 'M68 50h10'] },
  { id: 'switch-rev-1', label: 'Reverse switch', sphere: 'electronics', group: 'Home',
    d: [PLATE, 'M50 32v36', 'M36 50h28', 'M30 40l-8 10 8 10', 'M70 40l8 10-8 10'] },
  { id: 'switch-rev-2', label: '2-button reverse switch', sphere: 'electronics', group: 'Home',
    d: [PLATE, 'M50 20v60', 'M26 50h18', 'M56 50h18', 'M34 34l-8 8 8 8', 'M66 34l8 8-8 8'] },
  { id: 'dimmer', label: 'Dimmer', sphere: 'electronics', group: 'Home',
    d: [PLATE, 'M50 50m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0', 'M50 50l11-11'] },
  { id: 'socket', label: 'Socket', sphere: 'electronics', group: 'Home',
    d: [PLATE, 'M40 50m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0', 'M60 50m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0',
        'M50 28v8', 'M50 64v8'] },
  { id: 'socket-2', label: 'Double socket', sphere: 'electronics', group: 'Home',
    d: ['M6 20h40a4 4 0 0 1 4 4v52a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z',
        'M54 20h40a4 4 0 0 1 4 4v52a4 4 0 0 1-4 4H54a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z',
        'M20 50m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M32 50m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
        'M68 50m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M80 50m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0'] },
  { id: 'lamp', label: 'Lamp', sphere: 'electronics', group: 'Home',
    d: ['M50 50m-26 0a26 26 0 1 0 52 0a26 26 0 1 0-52 0', 'M32 32l36 36', 'M68 32L32 68'] },
  { id: 'lamp-ceiling', label: 'Ceiling lamp', sphere: 'electronics', group: 'Home',
    d: ['M50 10v14', 'M26 56a24 24 0 0 1 48 0z', 'M20 56h60', 'M34 72l6 10', 'M50 74v12', 'M66 72l-6 10'] },
  { id: 'led-strip', label: 'LED strip', sphere: 'electronics', group: 'Home',
    d: ['M6 38h88a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V42a4 4 0 0 1 4-4z',
        'M16 50h12l6-8 6 16 6-16 6 16 6-8h12'] },
  { id: 'motion-sensor', label: 'Motion sensor', sphere: 'electronics', group: 'Home',
    d: ['M28 62a22 22 0 0 1 44 0z', 'M22 62h56', 'M38 76a14 14 0 0 0 24 0', 'M30 86a26 26 0 0 0 40 0'] },

  { id: 'breaker', label: 'Breaker', sphere: 'electronics', group: 'Panel',
    d: ['M30 12h40a4 4 0 0 1 4 4v68a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z',
        'M50 12V2', 'M50 88v10', 'M38 38l24-10', 'M38 38v24'] },
  { id: 'rcd', label: 'RCD', sphere: 'electronics', group: 'Panel',
    d: ['M26 12h48a4 4 0 0 1 4 4v68a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z',
        'M50 12V2', 'M50 88v10', 'M34 40l32-12', 'M34 40v20', 'M34 70h32'] },
  { id: 'meter-electric', label: 'Electricity meter', sphere: 'electronics', group: 'Panel',
    d: ['M12 20h76a4 4 0 0 1 4 4v52a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z',
        'M50 50m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0', 'M50 50l10-8'] },
  { id: 'busbar', label: 'Busbar', sphere: 'electronics', group: 'Panel',
    d: ['M4 44h92v12H4z', 'M20 44V28', 'M40 44V28', 'M60 44V28', 'M80 44V28'] },
  { id: 'battery', label: 'Battery', sphere: 'electronics', group: 'Panel',
    d: ['M30 26v48', 'M46 36v28', 'M58 26v48', 'M74 36v28', 'M4 50h26', 'M74 50h22'] },
  { id: 'ground', label: 'Ground', sphere: 'electronics', group: 'Panel',
    d: ['M50 10v40', 'M22 50h56', 'M32 66h36', 'M42 82h16'] },
  { id: 'junction-box', label: 'Junction box', sphere: 'electronics', group: 'Panel',
    d: ['M20 20h60v60H20z', 'M50 20V4', 'M50 80v16', 'M20 50H4', 'M80 50h16'] },
];

// ── Programming ────────────────────────────────────────────────────────────
// The cylinder is the shared shape for anything that stores, the way the plate
// is for anything on a wall.
const CYL = ['M24 26c0-6 12-11 26-11s26 5 26 11v48c0 6-12 11-26 11s-26-5-26-11z',
             'M24 26c0 6 12 11 26 11s26-5 26-11'];

const PROGRAMMING: IconDef[] = [
  { id: 'db', label: 'Database', sphere: 'programming', group: 'Storage',
    d: [...CYL, 'M24 50c0 6 12 11 26 11s26-5 26-11'] },
  { id: 'cache', label: 'Cache', sphere: 'programming', group: 'Storage',
    d: [...CYL, 'M54 44l-12 16h8l-4 14 14-18h-8z'] },
  { id: 'redis', label: 'Redis', sphere: 'programming', group: 'Storage',
    d: ['M22 32l28-12 28 12-28 12z', 'M22 50l28 12 28-12', 'M22 68l28 12 28-12',
        'M22 32v36', 'M78 32v36'] },
  { id: 'object-store', label: 'Object store', sphere: 'programming', group: 'Storage',
    d: ['M18 26h64l-8 58a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4z', 'M18 26l6-12h52l6 12'] },
  { id: 'queue', label: 'Queue', sphere: 'programming', group: 'Storage',
    d: ['M14 34h22v32H14z', 'M39 34h22v32H39z', 'M64 34h22v32H64z', 'M50 76v12', 'M44 82l6 6 6-6'] },

  { id: 'server', label: 'Server', sphere: 'programming', group: 'Servers',
    d: ['M16 16h68v26H16z', 'M16 58h68v26H16z', 'M26 29h18', 'M26 71h18',
        'M70 29m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M70 71m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0'] },
  { id: 'load-balancer', label: 'Load balancer', sphere: 'programming', group: 'Servers',
    d: ['M50 18L74 42 50 66 26 42z', 'M50 66v20', 'M20 86h60', 'M20 86V74', 'M50 86V74', 'M80 86V74'] },
  { id: 'api', label: 'API gateway', sphere: 'programming', group: 'Servers',
    d: ['M22 26h56a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6z',
        'M36 42l-8 8 8 8', 'M64 42l8 8-8 8', 'M56 38l-12 24'] },
  { id: 'worker', label: 'Worker', sphere: 'programming', group: 'Servers',
    d: ['M50 50m-14 0a14 14 0 1 0 28 0a14 14 0 1 0-28 0',
        'M50 22v12', 'M50 66v12', 'M22 50h12', 'M66 50h12',
        'M30 30l9 9', 'M70 30l-9 9', 'M30 70l9-9', 'M70 70l-9-9'] },
  { id: 'cdn', label: 'CDN', sphere: 'programming', group: 'Servers',
    d: ['M50 50m-32 0a32 32 0 1 0 64 0a32 32 0 1 0-64 0', 'M18 50h64',
        'M50 18c10 10 10 54 0 64', 'M50 18c-10 10-10 54 0 64'] },

  { id: 'client-browser', label: 'Browser', sphere: 'programming', group: 'Clients',
    d: ['M12 20h76a4 4 0 0 1 4 4v52a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z',
        'M8 36h84', 'M20 28m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M30 28m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0'] },
  { id: 'client-mobile', label: 'Mobile', sphere: 'programming', group: 'Clients',
    d: ['M30 8h40a6 6 0 0 1 6 6v72a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z',
        'M42 16h16', 'M50 80m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0'] },
  { id: 'client-user', label: 'User', sphere: 'programming', group: 'Clients',
    d: ['M50 34m-16 0a16 16 0 1 0 32 0a16 16 0 1 0-32 0', 'M18 90a32 32 0 0 1 64 0'] },
];

// ── Water supply ───────────────────────────────────────────────────────────
const WATER: IconDef[] = [
  { id: 'pipe', label: 'Pipe', sphere: 'water', group: 'Pipes',
    d: ['M2 42h96', 'M2 58h96'] },
  { id: 'pipe-elbow', label: 'Elbow', sphere: 'water', group: 'Pipes',
    d: ['M2 42h40a16 16 0 0 1 16 16v40', 'M2 58h24a32 32 0 0 1 16 16v24'] },
  { id: 'pipe-tee', label: 'Tee', sphere: 'water', group: 'Pipes',
    d: ['M2 42h96', 'M2 58h40', 'M58 58h40', 'M42 58v40', 'M58 58v40'] },
  { id: 'pipe-cross', label: 'Cross', sphere: 'water', group: 'Pipes',
    d: ['M2 42h40', 'M58 42h40', 'M2 58h40', 'M58 58h40',
        'M42 2v40', 'M58 2v40', 'M42 58v40', 'M58 58v40'] },
  { id: 'manifold', label: 'Manifold', sphere: 'water', group: 'Pipes',
    d: ['M8 38h84v24H8z', 'M2 50H8', 'M22 38V18', 'M42 38V18', 'M62 38V18', 'M82 38V18'] },
  { id: 'reducer', label: 'Reducer', sphere: 'water', group: 'Pipes',
    d: ['M2 34h30l36 12v8L32 66H2', 'M68 46h30', 'M68 54h30', 'M2 66h30'] },

  { id: 'valve', label: 'Valve', sphere: 'water', group: 'Fittings',
    d: ['M26 30l48 40V30L26 70z', 'M2 50h24', 'M74 50h24', 'M50 50V26', 'M34 26h32'] },
  { id: 'valve-ball', label: 'Ball valve', sphere: 'water', group: 'Fittings',
    d: ['M50 54m-20 0a20 20 0 1 0 40 0a20 20 0 1 0-40 0', 'M2 54h28', 'M70 54h28',
        'M50 34V14', 'M32 14h36'] },
  { id: 'tap', label: 'Tap', sphere: 'water', group: 'Fittings',
    d: ['M26 86h48', 'M44 86V50h12v36', 'M44 50a26 26 0 0 1 44-18', 'M30 34h28', 'M44 34V22'] },
  { id: 'mixer', label: 'Mixer', sphere: 'water', group: 'Fittings',
    d: ['M50 54v40', 'M30 90h40', 'M50 54L22 26', 'M50 54l28-28', 'M12 16h20v20', 'M68 16h20v20'] },
  { id: 'pump', label: 'Pump', sphere: 'water', group: 'Fittings',
    d: ['M50 50m-26 0a26 26 0 1 0 52 0a26 26 0 1 0-52 0', 'M40 34l24 16-24 16z',
        'M2 50h22', 'M76 50h22'] },
  { id: 'meter-water', label: 'Water meter', sphere: 'water', group: 'Fittings',
    d: ['M50 50m-22 0a22 22 0 1 0 44 0a22 22 0 1 0-44 0', 'M50 50m-12 0a12 12 0 1 0 24 0a12 12 0 1 0-24 0',
        'M2 50h26', 'M72 50h26'] },

  { id: 'filter-coarse', label: 'Coarse filter', sphere: 'water', group: 'Filters',
    d: ['M30 18h40v52a20 20 0 0 1-40 0z', 'M2 30h28', 'M70 30h28',
        'M36 40h28', 'M36 52h28', 'M36 64h28'] },
  { id: 'filter-fine', label: 'Fine filter', sphere: 'water', group: 'Filters',
    d: ['M32 14h36v56a18 18 0 0 1-36 0z', 'M2 26h30', 'M68 26h30',
        'M44 30v50', 'M56 30v50', 'M26 14h48'] },
  { id: 'filter-carbon', label: 'Carbon filter', sphere: 'water', group: 'Filters',
    d: ['M30 16h40v54a20 20 0 0 1-40 0z', 'M2 28h28', 'M70 28h28',
        'M44 36m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M58 50m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
        'M44 64m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0'] },
  { id: 'softener', label: 'Softener', sphere: 'water', group: 'Filters',
    d: ['M28 24h44v62a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4z', 'M28 24a22 8 0 0 1 44 0',
        'M2 36h26', 'M72 36h26', 'M40 48c6 6 14 6 20 0', 'M40 64c6 6 14 6 20 0'] },
  { id: 'boiler', label: 'Water heater', sphere: 'water', group: 'Filters',
    d: ['M26 10h48a6 6 0 0 1 6 6v68a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z',
        'M34 70c6-8 12 8 18 0s12 8 14 0', 'M20 30h60', 'M40 44v12', 'M60 44v12'] },
  { id: 'tank', label: 'Pressure tank', sphere: 'water', group: 'Filters',
    d: ['M30 20a20 10 0 0 1 40 0v56a20 10 0 0 1-40 0z', 'M30 20v56',
        'M50 86v12', 'M34 98h32', 'M30 48h40'] },
];

export const ICON_DEFS: IconDef[] = [...ELECTRONICS, ...PROGRAMMING, ...WATER];

const byId = new Map(ICON_DEFS.map(d => [d.id, d]));

/** An icon stores only its id, so an unknown one must not throw a frame away. */
export const iconDef = (id: string): IconDef | undefined => byId.get(id);

/** Tabs in the order they were declared, not alphabetical: shape families group. */
function groupsOf(sphere: string): string[] {
  const seen: string[] = [];
  for (const d of ICON_DEFS) {
    if (d.sphere === sphere && !seen.includes(d.group)) seen.push(d.group);
  }
  return seen;
}

export const SPHERES: Sphere[] = [
  { id: 'electronics', label: 'Electronics', groups: groupsOf('electronics') },
  { id: 'programming', label: 'Programming', groups: groupsOf('programming') },
  { id: 'water', label: 'Water supply', groups: groupsOf('water') },
];

export const iconsIn = (sphere: string, group: string): IconDef[] =>
  ICON_DEFS.filter(d => d.sphere === sphere && d.group === group);
