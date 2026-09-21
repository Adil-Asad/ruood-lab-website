/**
 * Measures real layout in a real browser, over the widths the site has to work
 * at. Two things it looks for, both of which a static read of the CSS cannot
 * settle:
 *
 *   · horizontal overflow — any element wider than the viewport. `body` carries
 *     `overflow-x: hidden`, which HIDES an overflow rather than preventing one,
 *     so without measuring, a clipped line looks like a design choice.
 *   · tap-target size — anything interactive under 44px on a phone.
 *
 * Drives Chrome over the DevTools Protocol with no dependencies: Chrome is
 * launched with a debugging port, the JSON endpoint gives a WebSocket target,
 * and Node's own WebSocket client does the rest.
 *
 *   node tools/measure.mjs [port-of-preview-server]
 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITE_PORT = Number(process.argv[2]) || 8099;
const CDP_PORT = 9333;
const PAGES = ['/lab', '/lab/about', '/lab/privacy', '/lab/contact', '/lab/404.html'];
const WIDTHS = [320, 360, 390, 414, 768, 834, 1024, 1280, 1440];

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);

if (!CHROME) { console.error('Chrome not found'); process.exit(1); }

const profile = join(tmpdir(), 'ruood-lab-measure-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--remote-debugging-port=' + CDP_PORT,
  '--user-data-dir=' + profile,
  'about:blank',
], { stdio: 'ignore' });

/** Chrome needs a moment before its debugging endpoint answers. */
async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error('Chrome debugging port never opened');
}

const ws = new WebSocket(await endpoint());
await new Promise((r) => (ws.onopen = r));

let nextId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
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
const call = (method, params) => send(method, params, sessionId);

await call('Page.enable');
await call('Runtime.enable');

/** Runs in the page: what sticks out, and what is too small to tap. */
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const over = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // A fixed/sticky decoration may legitimately sit outside; anything in flow
    // must not.
    if (r.right > vw + 1 || r.left < -1) {
      const style = getComputedStyle(el);
      if (style.position === 'fixed') continue;
      // A wide table inside its own horizontal scroller is the intended
      // behaviour, not an overflow: the page does not scroll, the box does.
      let inScroller = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') { inScroller = true; break; }
      }
      if (inScroller) continue;
      over.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString().slice(0, 44)) || '',
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  }
  const small = [];
  if (vw < 900) {
    for (const el of document.querySelectorAll('a, button, summary')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(el).display === 'inline' ) continue;
      // WCAG 2.2 SC 2.5.8 (AA) sets the minimum target at 24x24 CSS px.
      if (r.height < 24 || r.width < 24) {
        small.push({ tag: el.tagName.toLowerCase(),
                     cls: (el.className && el.className.toString().slice(0,30)) || '',
                     h: Math.round(r.height), w: Math.round(r.width),
                     text: (el.textContent || '').trim().slice(0, 28) });
      }
    }
  }
  return JSON.stringify({
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    over: over.slice(0, 6),
    overCount: over.length,
    small: small.slice(0, 5),
    smallCount: small.length,
  });
})()`;

let problems = 0;

for (const width of WIDTHS) {
  await call('Emulation.setDeviceMetricsOverride', {
    width, height: 900, deviceScaleFactor: 1,
    mobile: width < 900,
  });

  for (const page of PAGES) {
    await call('Page.navigate', { url: `http://localhost:${SITE_PORT}${page}` });
    await new Promise((r) => setTimeout(r, 380));

    const { result } = await call('Runtime.evaluate', {
      expression: PROBE, returnByValue: true,
    });
    const data = JSON.parse(result.value);

    const overflows = data.scrollWidth > data.vw + 1;
    if (overflows || data.overCount || data.smallCount) {
      problems++;
      console.log(`\n✗ ${page} @ ${width}px`);
      if (overflows) {
        console.log(`    documentElement.scrollWidth ${data.scrollWidth} > viewport ${data.vw}`);
      }
      for (const o of data.over) {
        console.log(`    overflows: <${o.tag} class="${o.cls}"> left ${o.left} right ${o.right}`);
      }
      if (data.overCount > data.over.length) {
        console.log(`    …and ${data.overCount - data.over.length} more`);
      }
      for (const s of data.small) {
        console.log(`    tap target ${s.w}x${s.h}px: <${s.tag} class="${s.cls}"> "${s.text}"`);
      }
    }
  }
  console.log(`checked ${width}px`);
}

console.log(problems ? `\n${problems} page/width combination(s) with problems` : '\nNo overflow, no small tap targets.');

ws.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
if (problems) process.exitCode = 1;
