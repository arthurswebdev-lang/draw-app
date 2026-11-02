// One-time setup on the Mac: makes a certificate that the Mac and the iPad trust,
// so the Draw app (an https page) may open a secure WebSocket to this Mac.
// Needs mkcert:  brew install mkcert

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { networkInterfaces, hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

try { run('mkcert', ['-help']); }
catch {
  console.error('\nmkcert is not installed. Install it with:\n\n  brew install mkcert\n\nthen run this setup again.\n');
  process.exit(1);
}

// The Mac's Bonjour name, e.g. "arturs-macbook.local". It stays the same when
// the Wi-Fi gives the Mac a new IP address.
let host;
try { host = `${run('scutil', ['--get', 'LocalHostName'])}.local`; }
catch { host = hostname().endsWith('.local') ? hostname() : `${hostname()}.local`; }
const ips = Object.values(networkInterfaces()).flat()
  .filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);

console.log('\n1/3  Adding the mkcert certificate authority to this Mac (may ask for your password)…');
execFileSync('mkcert', ['-install'], { stdio: 'inherit' });

console.log(`\n2/3  Making a certificate for ${host} ${ips.join(' ')}…`);
mkdirSync(join(dir, 'certs'), { recursive: true });
execFileSync('mkcert', [
  '-cert-file', join(dir, 'certs', 'cert.pem'),
  '-key-file', join(dir, 'certs', 'key.pem'),
  host, 'localhost', '127.0.0.1', ...ips,
], { stdio: 'inherit' });

console.log('\n3/3  Copying the root certificate for the iPad…');
const rootSrc = join(run('mkcert', ['-CAROOT']), 'rootCA.pem');
const rootDst = join(dir, 'rootCA.pem');
copyFileSync(rootSrc, rootDst);
try { execFileSync('open', ['-R', rootDst]); } catch { /* not on a Mac desktop */ }

const port = process.env.PORT ?? 8443;
console.log(`
Done.

Server address (type this in the app's Sync dialog on every device):

    ${host}:${port}

Next steps:
  • Start the server:            npm run sync-server
    or start it at every login:  npm run sync-autostart
  • iPad: AirDrop ${rootDst}
    (a Finder window shows it), then
      Settings → Profile Downloaded → Install
      Settings → General → About → Certificate Trust Settings → turn it on
  • Check on the iPad: open https://${host}:${port} in Safari.
    It should say "Draw sync server is running".
`);
