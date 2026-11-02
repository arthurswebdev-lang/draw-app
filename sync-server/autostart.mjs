// Starts the sync server at every login on this Mac, and restarts it if it stops.
//
//   node autostart.mjs           install (and start now)
//   node autostart.mjs --remove  uninstall

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LABEL = 'com.draw-app.sync';
const dir = dirname(fileURLToPath(import.meta.url));
const plist = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const domain = `gui/${userInfo().uid}`;
const logFile = join(dir, 'data', 'server.log');

const unload = () => {
  try { execFileSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'ignore' }); } catch { /* not loaded */ }
};

if (process.argv.includes('--remove')) {
  unload();
  if (existsSync(plist)) rmSync(plist);
  console.log('Autostart removed. The server no longer starts at login.');
  process.exit(0);
}

if (!existsSync(join(dir, 'certs', 'cert.pem'))) {
  console.error('No certificate found. Run the setup first:  npm run sync-setup');
  process.exit(1);
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
mkdirSync(dirname(plist), { recursive: true });
mkdirSync(join(dir, 'data'), { recursive: true });
writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(process.execPath)}</string>
    <string>${esc(join(dir, 'server.mjs'))}</string>
  </array>
  <key>WorkingDirectory</key><string>${esc(dir)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${esc(logFile)}</string>
  <key>StandardErrorPath</key><string>${esc(logFile)}</string>
</dict>
</plist>
`);
unload();
execFileSync('launchctl', ['bootstrap', domain, plist], { stdio: 'inherit' });
console.log(`Autostart installed. The server is running now and starts at every login.
Log: ${logFile}
To remove:  npm run sync-autostart -- --remove`);
