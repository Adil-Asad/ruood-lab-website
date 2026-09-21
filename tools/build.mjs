/**
 * Stages the site for deployment.
 *
 * There is nothing to compile — the source IS the site. What this does is put
 * it at the path it is served from: every asset path and internal link in the
 * HTML is root-relative and carries the `/lab` prefix, so the deployable tree
 * has to have a `lab/` directory at its root.
 *
 *   dist/
 *   ├── lab/            ← this project
 *   │   ├── index.html
 *   │   ├── about/ privacy/ contact/
 *   │   ├── css/ js/ assets/
 *   │   ├── 404.html sitemap.xml robots.txt
 *   └── robots.txt      ← ONLY for the case where this deployment owns the
 *                         apex domain. If the main RUŌOD site owns it, delete
 *                         this and merge its Sitemap line into theirs instead
 *                         (see README, "Deployment").
 *
 * `tools/` is not copied: it is the preview server and the checks, and none of
 * it belongs on a public site.
 *
 *   node tools/build.mjs
 */

import { cp, mkdir, rm, readdir, stat, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE = join(DIST, 'lab');

/** Everything that is part of the published site. */
const INCLUDE = [
  'index.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'about',
  'privacy',
  'contact',
  'css',
  'js',
  'assets',
];

await rm(DIST, { recursive: true, force: true });
await mkdir(SITE, { recursive: true });

let files = 0;
let bytes = 0;

async function measure(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const entry of await readdir(path)) await measure(join(path, entry));
  } else {
    files++;
    bytes += info.size;
  }
}

for (const entry of INCLUDE) {
  await cp(join(ROOT, entry), join(SITE, entry), { recursive: true });
  await measure(join(SITE, entry));
}

// The apex robots.txt, for the standalone-deployment case only.
await copyFile(join(ROOT, 'robots.txt'), join(DIST, 'robots.txt'));

console.log(`Built dist/ — ${files} files, ${(bytes / 1024).toFixed(1)} KB`);
console.log(`Site staged at dist/lab/, ready to serve at https://ruood.com/lab`);
console.log(`Publish directory: dist`);
