/**
 * Screenshots through the DevTools Protocol, with real device metrics.
 *
 * Chrome's old `--headless --screenshot --window-size=…` does NOT apply mobile
 * emulation, so a phone-width capture comes back laid out for a wider viewport
 * and cropped — which reads exactly like a horizontal-overflow bug that is not
 * there. `Emulation.setDeviceMetricsOverride` is the authoritative path and is
 * what `measure.mjs` uses, so screenshots are taken the same way.
 *
 *   node tools/shots.mjs <out-dir> [site-port]
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2];
const SITE_PORT = Number(process.argv[3]) || 8099;
const CDP_PORT = 9334;

const SHOTS = [
  { name: 'home-mobile',    path: '/lab',         width: 390,  height: 3200 },
  { name: 'home-tablet',    path: '/lab',         width: 834,  height: 2400 },
  { name: 'home-desktop',   path: '/lab',         width: 1440, height: 2000 },
  { name: 'calc-desktop',   path: '/lab#calculations', width: 1440, height: 1500 },
  { name: 'privacy-mobile', path: '/lab/privacy', width: 390,  height: 1600 },
  { name: 'privacy-desktop',path: '/lab/privacy', width: 1440, height: 1500 },
  { name: 'about-desktop',  path: '/lab/about',   width: 1440, height: 1400 },
  { name: 'contact-desktop',path: '/lab/contact', width: 1440, height: 1200 },
  { name: 'contact-mobile', path: '/lab/contact', width: 390,  height: 1400 },
  { name: 'notfound',       path: '/lab/nope',    width: 1440, height: 900 },
];

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!CHROME) { console.error('Chrome not found'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const profile = join(tmpdir(), 'ruood-lab-shots-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--remote-debugging-port=' + CDP_PORT,
  '--user-data-dir=' + profile,
  'about:blank',
], { stdio: 'ignore' });

async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      return (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl;
    } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  throw new Error('Chrome debugging port never opened');
}

const ws = new WebSocket(await endpoint());
await new Promise((r) => (ws.onopen = r));

let nextId = 1;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const call = (m, p) => send(m, p, sessionId);

await call('Page.enable');

for (const shot of SHOTS) {
  await call('Emulation.setDeviceMetricsOverride', {
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: 1,
    mobile: shot.width < 900,
  });
  await call('Page.navigate', { url: `http://localhost:${SITE_PORT}${shot.path}` });
  await new Promise((r) => setTimeout(r, 700));

  const { data } = await call('Page.captureScreenshot', { format: 'png' });
  const file = join(OUT, shot.name + '.png');
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`${shot.name.padEnd(17)} ${shot.width}x${shot.height}`);
}

ws.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
