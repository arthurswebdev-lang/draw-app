/**
 * Built-in icons. Every icon is a set of SVG path strings drawn in a 48x48 box.
 * They are stroke-only, so they take the current color and line width.
 */
export type IconDef = { id: string; name: string; paths: string[] };
export type IconTab = { id: string; name: string; icons: IconDef[] };
export type Sphere = { id: string; name: string; tabs: IconTab[] };

export const ICON_BOX = 48;

const f = (n: number) => String(+n.toFixed(2));
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const rect = (x: number, y: number, w: number, h: number, r = 0) =>
  r === 0
    ? `M${x} ${y}h${w}v${h}h${-w}Z`
    : `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
/** Two-way arrows used on "reverse" switches, centered at (cx, cy). */
const swap = (cx: number, cy: number, w = 8) =>
  `M${cx - w / 2} ${cy - 3}h${w}m-3 -3l3 3l-3 3M${cx + w / 2} ${cy + 3}h${-w}m3 -3l-3 3l3 3`;

// ---------- Electronics ----------
const electronicsHome: IconDef[] = [
  { id: 'el-switch-1', name: 'Switch', paths: [rect(8, 6, 32, 36, 4), rect(16, 12, 16, 24, 3), 'M16 24h16'] },
  { id: 'el-switch-2', name: '2-button switch', paths: [rect(4, 10, 40, 28, 4), rect(9, 15, 12, 18, 2), rect(27, 15, 12, 18, 2)] },
  { id: 'el-switch-3', name: '3-button switch', paths: [rect(2, 12, 44, 24, 4), rect(6, 16, 10, 16, 2), rect(19, 16, 10, 16, 2), rect(32, 16, 10, 16, 2)] },
  { id: 'el-switch-rev', name: 'Reverse switch', paths: [rect(8, 6, 32, 36, 4), rect(16, 12, 16, 24, 3), swap(24, 24)] },
  { id: 'el-switch-rev-2', name: '2-button reverse switch', paths: [rect(4, 10, 40, 28, 4), rect(9, 15, 12, 18, 2), rect(27, 15, 12, 18, 2), swap(15, 24, 6), swap(33, 24, 6)] },
  { id: 'el-dimmer', name: 'Dimmer', paths: [rect(8, 6, 32, 36, 4), circle(24, 24, 9), 'M24 15v6'] },
  { id: 'el-socket', name: 'Socket', paths: [circle(24, 24, 18), circle(17.5, 24, 2), circle(30.5, 24, 2), 'M20 11h8M20 37h8'] },
  { id: 'el-socket-2', name: 'Double socket', paths: [rect(2, 10, 44, 28, 4), circle(14, 24, 8), circle(34, 24, 8), circle(11.5, 24, 1.5), circle(16.5, 24, 1.5), circle(31.5, 24, 1.5), circle(36.5, 24, 1.5)] },
  { id: 'el-lamp', name: 'Lamp', paths: ['M18 32C18 27 12 25 12 18A12 12 0 0 1 36 18C36 25 30 27 30 32Z', 'M18 37h12M19 41h10M21 45h6'] },
  { id: 'el-ceiling', name: 'Ceiling light', paths: [circle(24, 24, 18), circle(24, 24, 8), 'M24 2v4M24 42v4M2 24h4M42 24h4'] },
  { id: 'el-wall-lamp', name: 'Wall lamp', paths: ['M10 34A14 14 0 0 1 38 34Z', 'M8 38h32M24 6v6M10 12l4 4M38 12l-4 4'] },
  { id: 'el-spot', name: 'Spotlight', paths: ['M14 10h20l6 14H8Z', 'M18 30v4M24 30v8M30 30v4'] },
  { id: 'el-sensor', name: 'Motion sensor', paths: ['M10 40A14 14 0 0 1 38 40Z', 'M14 26A14 14 0 0 1 34 26M10 20A20 20 0 0 1 38 20M6 14A26 26 0 0 1 42 14'] },
  { id: 'el-battery', name: 'Battery', paths: [rect(4, 14, 36, 20, 3), rect(40, 21, 4, 6, 1), 'M12 20v8M19 20v8M26 20v8'] },
  { id: 'el-panel', name: 'Breaker panel', paths: [rect(8, 4, 32, 40, 3), rect(13, 10, 8, 10, 1), rect(27, 10, 8, 10, 1), rect(13, 26, 8, 10, 1), rect(27, 26, 8, 10, 1)] },
  { id: 'el-breaker', name: 'Circuit breaker', paths: [rect(14, 6, 20, 36, 2), rect(20, 12, 8, 12, 1), 'M17 32h14'] },
  { id: 'el-junction', name: 'Junction box', paths: [rect(10, 10, 28, 28, 3), circle(24, 24, 5), 'M24 2v8M24 38v8M2 24h8M38 24h8'] },
  { id: 'el-meter', name: 'Electric meter', paths: [rect(8, 4, 32, 40, 4), circle(24, 20, 9), 'M24 20l5-4M16 36h16'] },
];

const electronicsSchematic: IconDef[] = [
  { id: 'sc-resistor', name: 'Resistor', paths: ['M2 24h10l3-8l6 16l6-16l6 16l3-8h10'] },
  { id: 'sc-capacitor', name: 'Capacitor', paths: ['M2 24h18M20 10v28M28 10v28M28 24h18'] },
  { id: 'sc-diode', name: 'Diode', paths: ['M2 24h12M14 12v24l20-12ZM34 12v24M34 24h12'] },
  { id: 'sc-led', name: 'LED', paths: ['M2 28h12M14 16v24l20-12ZM34 16v24M34 28h12', 'M28 12l6-6M34 6h-4M34 6v4M36 14l6-6M42 8h-4M42 8v4'] },
  { id: 'sc-cell', name: 'Battery cell', paths: ['M2 24h18M20 12v24M28 18v12M28 24h18'] },
  { id: 'sc-ground', name: 'Ground', paths: ['M24 6v18M10 24h28M16 30h16M21 36h6'] },
  { id: 'sc-switch', name: 'Switch (symbol)', paths: ['M2 30h12M34 30h12M14 30l20-14', circle(14, 30, 1.5), circle(34, 30, 1.5)] },
  { id: 'sc-lamp', name: 'Lamp (symbol)', paths: [circle(24, 24, 14), 'M14 14l20 20M34 14l-20 20M2 24h8M38 24h8'] },
  { id: 'sc-ac', name: 'AC source', paths: [circle(24, 24, 16), 'M14 24q5 -10 10 0t10 0', 'M2 24h6M40 24h6'] },
  { id: 'sc-fuse', name: 'Fuse', paths: [rect(12, 16, 24, 16, 2), 'M2 24h10M36 24h10M12 24h24'] },
  { id: 'sc-dot', name: 'Junction dot', paths: [circle(24, 24, 3), 'M24 4v14M24 30v14M4 24h14M30 24h14'] },
];

// ---------- Programming ----------
const progStorage: IconDef[] = [
  { id: 'pg-db', name: 'Database', paths: ['M10 12A14 5 0 0 1 38 12A14 5 0 0 1 10 12V36A14 5 0 0 0 38 36V12', 'M10 24A14 5 0 0 0 38 24'] },
  { id: 'pg-cache', name: 'Cache', paths: ['M27 4L11 27h12l-2 17l16-24H25Z'] },
  { id: 'pg-redis', name: 'Redis / in-memory', paths: ['M24 6l18 7l-18 7l-18 -7Z', 'M6 21l18 7l18 -7M6 29l18 7l18 -7M6 13v24l18 7l18 -7V13'] },
  { id: 'pg-disk', name: 'Disk', paths: [rect(4, 14, 40, 20, 3), 'M10 24h12M34 24h.01', circle(36, 24, 2)] },
  { id: 'pg-bucket', name: 'Object storage', paths: ['M8 12A16 5 0 0 1 40 12A16 5 0 0 1 8 12L12 40A12 4 0 0 0 36 40L40 12', 'M8 12'] },
  { id: 'pg-file', name: 'File', paths: ['M12 4h16l10 10v30H12Z', 'M28 4v10h10M18 24h14M18 31h14'] },
  { id: 'pg-kv', name: 'Key-value store', paths: [rect(4, 8, 40, 32, 3), 'M4 18h40M20 18v22M10 13h.01', circle(10, 13, 1)] },
];

const progServers: IconDef[] = [
  { id: 'pg-server', name: 'Server', paths: [rect(6, 6, 36, 16, 3), rect(6, 26, 36, 16, 3), circle(13, 14, 1.5), circle(13, 34, 1.5), 'M20 14h16M20 34h16'] },
  { id: 'pg-cloud', name: 'Cloud', paths: ['M14 38A9 9 0 0 1 14 20A12 12 0 0 1 37 22A8 8 0 0 1 36 38Z'] },
  { id: 'pg-container', name: 'Container', paths: ['M24 4l18 10v20l-18 10l-18 -10V14Z', 'M6 14l18 10l18 -10M24 24v20'] },
  { id: 'pg-lb', name: 'Load balancer', paths: [circle(10, 24, 5), circle(38, 10, 5), circle(38, 24, 5), circle(38, 38, 5), 'M15 24h18M14 21L33 12M14 27L33 36'] },
  { id: 'pg-api', name: 'API gateway', paths: ['M24 4l17 10v20l-17 10l-17 -10V14Z', 'M16 24h16M27 19l5 5l-5 5'] },
  { id: 'pg-function', name: 'Function', paths: ['M18 6C13 6 14 12 14 18C14 22 12 24 9 24C12 24 14 26 14 30C14 36 13 42 18 42', 'M30 6C35 6 34 12 34 18C34 22 36 24 39 24C36 24 34 26 34 30C34 36 35 42 30 42'] },
  { id: 'pg-worker', name: 'Worker / cron', paths: [circle(24, 24, 18), 'M24 12v12l8 5'] },
];

const progNetwork: IconDef[] = [
  { id: 'pg-user', name: 'User', paths: [circle(24, 15, 8), 'M8 43C8 31 16 28 24 28C32 28 40 31 40 43Z'] },
  { id: 'pg-laptop', name: 'Laptop', paths: [rect(10, 10, 28, 20, 2), 'M4 38h40l-4 -8H8Z'] },
  { id: 'pg-mobile', name: 'Phone', paths: [rect(14, 4, 20, 40, 4), 'M21 38h6'] },
  { id: 'pg-browser', name: 'Browser', paths: [rect(4, 8, 40, 32, 3), 'M4 18h40', circle(10, 13, 1), circle(16, 13, 1)] },
  { id: 'pg-globe', name: 'Internet', paths: [circle(24, 24, 18), 'M24 6C14 14 14 34 24 42C34 34 34 14 24 6', 'M6 24h36'] },
  { id: 'pg-firewall', name: 'Firewall', paths: [rect(6, 8, 36, 32, 2), 'M6 19h36M6 30h36M20 8v11M32 19v11M14 30v10'] },
  { id: 'pg-router', name: 'Router / Wi-Fi', paths: ['M6 20A26 26 0 0 1 42 20', 'M13 27A16 16 0 0 1 35 27', 'M19 33A7 7 0 0 1 29 33', circle(24, 40, 1.5)] },
  { id: 'pg-queue', name: 'Queue', paths: [rect(4, 14, 40, 20, 2), 'M16 14v20M28 14v20M10 24h.01M22 24h.01M34 24h.01'] },
  { id: 'pg-arrow', name: 'Arrow', paths: ['M4 24h38M32 14l10 10l-10 10'] },
  { id: 'pg-arrow-2', name: 'Two-way arrow', paths: ['M6 24h36M14 14l-10 10l10 10M34 14l10 10l-10 10'] },
];

// ---------- Water supply ----------
const waterPipes: IconDef[] = [
  { id: 'ws-pipe', name: 'Pipe', paths: ['M2 18h44M2 30h44', rect(10, 14, 4, 20), rect(34, 14, 4, 20)] },
  { id: 'ws-elbow', name: 'Elbow', paths: ['M2 16h28v30M2 32h12v14'] },
  { id: 'ws-tee', name: 'Tee', paths: ['M2 16h44M2 32h12v14M46 32H34v14'] },
  { id: 'ws-cross', name: 'Cross', paths: ['M2 16h12V2M34 2v14h12M2 32h12v14M46 32H34v14'] },
  { id: 'ws-valve', name: 'Ball valve', paths: ['M8 14l16 10l-16 10ZM40 14l-16 10l16 10Z', 'M24 24V8M16 8h16M2 24h6M40 24h6'] },
  { id: 'ws-check', name: 'Check valve', paths: [circle(24, 24, 14), 'M14 24h16M24 17l7 7l-7 7M2 24h8M38 24h8'] },
  { id: 'ws-3way', name: '3-way valve', paths: ['M6 14l14 10l-14 10ZM42 14l-14 10l14 10Z', 'M14 12l10 12l10 -12ZM24 24v22M2 24h4M42 24h4'] },
  { id: 'ws-tap', name: 'Tap', paths: ['M6 18h20a8 8 0 0 1 8 8v6', 'M14 18v-6M8 12h12M30 32h8', 'M34 38q-3 4 0 6q3 -2 0 -6'] },
  { id: 'ws-pump', name: 'Pump', paths: [circle(22, 28, 14), 'M16 20l14 8l-14 8Z', 'M22 14V6h24M2 28h6'] },
  { id: 'ws-meter', name: 'Water meter', paths: [circle(24, 24, 15), 'M24 24l7-6M17 31h14M2 24h7M39 24h7'] },
  { id: 'ws-gauge', name: 'Pressure gauge', paths: [circle(24, 22, 15), 'M24 22l8-8M12 22h3M33 22h3M24 10v3', 'M24 37v8M19 45h10'] },
  { id: 'ws-tank', name: 'Water tank', paths: [rect(10, 6, 28, 36, 6), 'M10 22q3.5 -4 7 0t7 0t7 0t7 0'] },
  { id: 'ws-boiler', name: 'Boiler', paths: [rect(10, 4, 28, 38, 6), 'M24 14C20 20 19 25 24 32C29 25 28 20 24 14Z', 'M18 42v4M30 42v4'] },
];

const waterTreatment: IconDef[] = [
  { id: 'ws-filter', name: 'Filter', paths: [rect(12, 10, 24, 30, 4), 'M16 10V6h16v4M18 18h12M18 24h12M18 30h12', 'M2 8h14M32 8h14'] },
  { id: 'ws-ro', name: 'Reverse osmosis', paths: [rect(4, 16, 40, 16, 8), 'M14 16v16M34 16v16M24 22v4'] },
  { id: 'ws-softener', name: 'Softener', paths: [rect(12, 6, 24, 36, 6), 'M18 28h5v5h-5ZM26 28h5v5h-5Z', 'M18 16h12'] },
  { id: 'ws-uv', name: 'UV lamp', paths: [rect(4, 16, 40, 16, 8), 'M12 24l4 -4l4 8l4 -8l4 8l4 -8l4 4'] },
  { id: 'ws-drop', name: 'Water drop', paths: ['M24 4C24 4 10 20 10 29A14 14 0 0 0 38 29C38 20 24 4 24 4Z'] },
  { id: 'ws-hot', name: 'Hot', paths: ['M24 4C26 12 36 16 36 28A12 12 0 0 1 12 28C12 22 16 20 18 16C19 20 22 20 22 16C22 12 22 8 24 4Z'] },
  { id: 'ws-cold', name: 'Cold', paths: ['M24 4v40M6 14l36 20M6 34l36 -20M19 8l5 5l5 -5M19 40l5 -5l5 5'] },
];

const waterFixtures: IconDef[] = [
  { id: 'ws-sink', name: 'Sink', paths: ['M6 22h36C42 32 36 38 24 38C12 38 6 32 6 22Z', 'M24 22v-10h8v4M14 22h.01'] },
  { id: 'ws-toilet', name: 'Toilet', paths: [rect(14, 4, 20, 12, 2), 'M10 18h28C38 30 32 36 24 36C16 36 10 30 10 18Z', 'M18 36v8h12v-8'] },
  { id: 'ws-bath', name: 'Bathtub', paths: ['M4 22h40C44 34 40 38 34 38H14C8 38 4 34 4 22Z', 'M10 38v4M38 38v4M10 22V10h6'] },
  { id: 'ws-shower', name: 'Shower', paths: ['M12 20A12 10 0 0 1 36 20Z', 'M24 10V6H8v38', 'M16 26v4M24 26v6M32 26v4M20 36v3M28 36v3'] },
  { id: 'ws-washer', name: 'Washing machine', paths: [rect(8, 4, 32, 40, 3), circle(24, 28, 10), circle(14, 11, 1.5), 'M22 11h12'] },
  { id: 'ws-radiator', name: 'Radiator', paths: [rect(8, 10, 32, 26, 3), 'M16 10v26M24 10v26M32 10v26M2 40h6M40 40h6'] },
];

export const SPHERES: Sphere[] = [
  {
    id: 'electronics', name: 'Electronics',
    tabs: [
      { id: 'home', name: 'Home', icons: electronicsHome },
      { id: 'schematic', name: 'Schematic', icons: electronicsSchematic },
    ],
  },
  {
    id: 'programming', name: 'Programming',
    tabs: [
      { id: 'storage', name: 'Storage', icons: progStorage },
      { id: 'servers', name: 'Servers', icons: progServers },
      { id: 'network', name: 'Network & clients', icons: progNetwork },
    ],
  },
  {
    id: 'water', name: 'Water supply',
    tabs: [
      { id: 'pipes', name: 'Pipes & valves', icons: waterPipes },
      { id: 'treatment', name: 'Treatment', icons: waterTreatment },
      { id: 'fixtures', name: 'Fixtures', icons: waterFixtures },
    ],
  },
];

const byId = new Map<string, IconDef>();
for (const s of SPHERES) for (const t of s.tabs) for (const i of t.icons) byId.set(i.id, i);

export const getIcon = (id: string) => byId.get(id);
export const allIcons = () => [...byId.values()];

const pathCache = new Map<string, Path2D>();
/** One Path2D per icon, in the 48x48 box. */
export function iconPath2D(id: string): Path2D | undefined {
  let p = pathCache.get(id);
  if (!p) {
    const def = byId.get(id);
    if (!def) return undefined;
    p = new Path2D();
    for (const d of def.paths) p.addPath(new Path2D(d));
    pathCache.set(id, p);
  }
  return p;
}
