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

/** A circle as path data: centre and radius. */
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
/** A rounded rectangle as path data. */
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
  `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
/** A page with a folded corner, shared by the file-like icons. */
const PAGE = ['M26 10h32l18 18v62H26z', 'M58 10v18h18'];

const P = (id: string, label: string, group: string, d: string[]): IconDef => ({ id, label, sphere: 'programming', group, d });

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

  // Storage
  P('file', 'File', 'Storage', [...PAGE, 'M36 50h30', 'M36 62h30', 'M36 74h20']),
  P('json', 'JSON document', 'Storage', [...PAGE,
    'M44 44c-6 0-6 3-6 8s0 7-5 7c5 0 5 2 5 7s0 8 6 8', 'M58 44c6 0 6 3 6 8s0 7 5 7c-5 0-5 2-5 7s0 8-6 8']),
  P('folder', 'Folder', 'Storage', ['M10 24h28l8 9h44v49H10z', 'M10 42h80']),
  P('table', 'Table', 'Storage', [rr(10, 20, 80, 60, 5), 'M10 38h80', 'M10 59h80', 'M37 20v60', 'M63 20v60']),
  P('search-index', 'Search index', 'Storage', [circ(42, 42, 24), 'M59 59l25 25', 'M30 36h24', 'M30 48h16']),
  P('event-stream', 'Event stream', 'Storage', ['M10 36h14v28H10z', 'M30 36h14v28H30z', 'M50 36h14v28H50z',
    'M70 50h18', 'M80 42l8 8-8 8']),

  // Servers
  P('cloud', 'Cloud', 'Servers', ['M28 74h46a15 15 0 0 0 1-30a22 22 0 0 0-42-4a17 17 0 0 0-5 34z']),
  P('container', 'Container', 'Servers', ['M50 12l36 17v42L50 88 14 71V29z', 'M14 29l36 17 36-17', 'M50 46v42']),
  P('function', 'Function', 'Servers', [rr(12, 12, 76, 76, 12), 'M36 26h8l22 48', 'M54 50L38 74']),
  P('scheduler', 'Scheduler', 'Servers', [circ(50, 52, 34), 'M50 30v22l15 10', 'M30 12l-12 10', 'M70 12l12 10']),
  P('microservice', 'Microservice', 'Servers', ['M50 12l33 19v38L50 88 17 69V31z', circ(50, 50, 11)]),
  P('vm', 'Virtual machine', 'Servers', [rr(12, 14, 76, 56, 5), 'M24 26h52v32H24z', 'M42 70l-4 12', 'M58 70l4 12', 'M30 84h40']),
  P('cluster', 'Cluster', 'Servers', [circ(50, 22, 10), circ(24, 74, 10), circ(76, 74, 10),
    'M45 31L29 65', 'M55 31l16 34', 'M34 74h32']),

  // Clients
  P('desktop', 'Desktop', 'Clients', [rr(10, 14, 80, 54, 5), 'M42 68l-4 14', 'M58 68l4 14', 'M30 84h40']),
  P('laptop', 'Laptop', 'Clients', [rr(20, 20, 60, 42, 4), 'M8 70h84l-6 10H14z']),
  P('tablet', 'Tablet', 'Clients', [rr(18, 8, 64, 84, 8), circ(50, 82, 3)]),
  P('users', 'Team', 'Clients', [circ(36, 36, 13), 'M10 84a26 26 0 0 1 52 0', circ(68, 32, 10), 'M62 56a22 22 0 0 1 28 22']),
  P('bot', 'Bot', 'Clients', [rr(20, 32, 60, 46, 12), circ(38, 54, 6), circ(62, 54, 6), 'M40 68h20',
    'M50 32V22', circ(50, 16, 5), 'M20 52h-8', 'M80 52h8']),
  P('chip', 'Device', 'Clients', [rr(28, 28, 44, 44, 4), 'M38 28V16', 'M50 28V16', 'M62 28V16', 'M38 72v12',
    'M50 72v12', 'M62 72v12', 'M28 38H16', 'M28 50H16', 'M28 62H16', 'M72 38h12', 'M72 50h12', 'M72 62h12']),

  // Network
  P('internet', 'Internet', 'Network', [circ(50, 50, 36), 'M14 50h72', 'M18 32h64', 'M18 68h64',
    'M50 14c14 12 14 60 0 72', 'M50 14c-14 12-14 60 0 72']),
  P('dns', 'DNS', 'Network', ['M50 12v76', 'M50 20h28l8 9-8 9H50', 'M50 46H22l-8 9 8 9h28', 'M34 88h32']),
  P('router', 'Router', 'Network', [rr(10, 50, 80, 28, 6), 'M30 50L22 22', 'M70 50l8-28', circ(26, 64, 3), circ(40, 64, 3), 'M58 64h18']),
  P('net-switch', 'Network switch', 'Network', [rr(8, 34, 84, 32, 5), 'M18 50h8', 'M34 50h8', 'M50 50h8', 'M66 50h8', 'M80 50h4']),
  P('request', 'Request / response', 'Network', ['M14 36h66', 'M68 24l12 12-12 12', 'M86 64H20', 'M32 52L20 64l12 12']),
  P('email', 'Email', 'Network', [rr(10, 22, 80, 56, 5), 'M12 26l38 30 38-30']),
  P('notification', 'Notification', 'Network', ['M28 66V46a22 22 0 0 1 44 0v20l8 10H20z', 'M42 80a8 8 0 0 0 16 0', 'M50 16v8']),

  // Security
  P('lock', 'Lock', 'Security', [rr(22, 44, 56, 44, 6), 'M34 44V32a16 16 0 0 1 32 0v12', circ(50, 62, 5), 'M50 67v9']),
  P('key', 'Key', 'Security', [circ(28, 50, 16), 'M44 50h44', 'M78 50v12', 'M66 50v10']),
  P('shield', 'Shield', 'Security', ['M50 10l34 12v26c0 22-14 34-34 42-20-8-34-20-34-42V22z', 'M36 50l10 10 18-20']),
  P('firewall', 'Firewall', 'Security', ['M10 22h80v56H10z', 'M10 41h80', 'M10 60h80', 'M36 22v19', 'M64 22v19',
    'M22 41v19', 'M50 41v19', 'M78 41v19', 'M36 60v18', 'M64 60v18']),
  P('identity', 'Login / identity', 'Security', [rr(8, 22, 84, 56, 6), circ(32, 44, 9), 'M18 68a14 14 0 0 1 28 0',
    'M56 40h24', 'M56 52h24', 'M56 64h14']),
  P('secret', 'Secret', 'Security', [rr(14, 30, 72, 40, 8), circ(32, 50, 4), circ(50, 50, 4), circ(68, 50, 4)]),

  // Code
  P('code', 'Code', 'Code', ['M34 28L12 50l22 22', 'M66 28l22 22-22 22', 'M57 20L43 80']),
  P('terminal', 'Terminal', 'Code', [rr(8, 16, 84, 68, 6), 'M22 38l14 12-14 12', 'M44 64h22']),
  P('bug', 'Bug', 'Code', ['M50 32c12 0 19 10 19 26s-9 28-19 28-19-12-19-28 7-26 19-26z', 'M40 33a10 10 0 0 1 20 0',
    'M50 40v44', 'M31 48H16', 'M31 62H14', 'M33 75l-12 9', 'M69 48h15', 'M69 62h17', 'M67 75l12 9', 'M44 22l-6-8', 'M56 22l6-8']),
  P('braces', 'Variable / object', 'Code', ['M40 16c-10 0-10 8-10 16s0 14-10 18c10 4 10 10 10 18s0 16 10 16',
    'M60 16c10 0 10 8 10 16s0 14 10 18c-10 4-10 10-10 18s0 16-10 16']),
  P('git-branch', 'Branch', 'Code', [circ(30, 18, 8), circ(30, 82, 8), circ(70, 34, 8), 'M30 26v48', 'M70 42v4c0 14-40 10-40 26']),
  P('merge', 'Merge / pull request', 'Code', [circ(28, 20, 8), circ(28, 80, 8), circ(72, 80, 8), 'M28 28v44',
    'M72 72V42c0-8-6-14-14-14H44', 'M52 20l-8 8 8 8']),
  P('commit', 'Commit', 'Code', [circ(50, 50, 13), 'M8 50h29', 'M63 50h29']),
  P('package', 'Package', 'Code', ['M14 30l36-16 36 16v42L50 88 14 72z', 'M14 30l36 16 36-16', 'M50 46v42', 'M32 22l36 16v14']),
  P('config', 'Settings', 'Code', ['M14 26h72', 'M14 50h72', 'M14 74h72', circ(34, 26, 7), circ(64, 50, 7), circ(42, 74, 7)]),
  P('tests', 'Tests passed', 'Code', [circ(50, 50, 36), 'M32 50l13 13 24-26']),
  P('logs', 'Logs', 'Code', ['M30 24h56', 'M30 41h56', 'M30 58h56', 'M30 75h38', circ(17, 24, 2), circ(17, 41, 2),
    circ(17, 58, 2), circ(17, 75, 2)]),
  P('metrics', 'Metrics', 'Code', ['M12 12v76h76', 'M22 70l20-24 14 12 26-30', 'M68 28h14v14']),
  P('alert', 'Alert', 'Code', ['M50 12l40 72H10z', 'M50 38v22', 'M50 72v1']),

  // Flow (flowchart pieces)
  P('flow-start', 'Start / end', 'Flow', [rr(8, 32, 84, 36, 18)]),
  P('flow-process', 'Process', 'Flow', ['M10 30h80v40H10z']),
  P('flow-decision', 'Decision', 'Flow', ['M50 12l38 38-38 38-38-38z']),
  P('flow-io', 'Input / output', 'Flow', ['M26 30h64l-16 40H10z']),
  P('flow-subprocess', 'Subprocess', 'Flow', ['M8 30h84v40H8z', 'M20 30v40', 'M80 30v40']),
  P('flow-note', 'Note', 'Flow', ['M14 12h54l18 18v58H14z', 'M68 12v18h18', 'M26 46h46', 'M26 60h46', 'M26 74h28']),
  P('flow-loop', 'Loop', 'Flow', ['M78 50a28 28 0 1 1-8-20', 'M72 14v18H54']),
  P('flow-arrow', 'Arrow', 'Flow', ['M10 50h76', 'M70 34l16 16-16 16']),
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

/**
 * What the panel offers: programming only. The electronics and water icons stay
 * defined above, unlisted, so icons already placed on a board still draw.
 */
export const SPHERES: Sphere[] = [
  { id: 'programming', label: 'Programming', groups: groupsOf('programming') },
];

/** Spheres kept only so placed icons still draw. Not shown in the panel. */
export const HIDDEN_SPHERES = ['electronics', 'water'];

export const iconsIn = (sphere: string, group: string): IconDef[] =>
  ICON_DEFS.filter(d => d.sphere === sphere && d.group === group);
