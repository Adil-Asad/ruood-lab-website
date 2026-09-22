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
 *   └── robots.txt      ← keeps the netlify.app ORIGIN out of search
 *                         results. It is not the site's own robots.txt; see
 *                         the note where it is written, below.
 *
 * `tools/` is not copied: it is the preview server and the checks, and none of
 * it belongs on a public site.
 *
 *   node tools/build.mjs
 */

import { cp, mkdir, rm, readdir, stat, writeFile } from 'node:fs/promises';
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

// The robots.txt at the ROOT of this deployment — which is the root of the
// hosting origin, https://ruoo.netlify.app, and NOT of ruood.com. The public
// site is served by the main RUŌOD site proxying /lab/* through to here, so
// crawlers read ruood.com/robots.txt (the main site's, into which this
// project's own robots.txt is merged by hand) and never this file. This one
// is reached only by a crawler that found the netlify.app address directly,
// and its whole job is to keep that implementation host out of the index so
// it cannot compete with the canonical ruood.com/lab URLs.
//
// It has to be robots.txt rather than an X-Robots-Tag header: response
// headers ARE passed through the proxy, so a noindex header here would
// deindex the real pages at ruood.com/lab.
//
// The project's own robots.txt is still staged inside dist/lab/ as the source
// to merge into the main site's. See README, "Deployment".
await writeFile(
  join(DIST, 'robots.txt'),
  [
    '# This is the hosting ORIGIN for https://ruood.com/lab, not the site itself.',
    '# The public URLs are on ruood.com and are governed by ruood.com/robots.txt.',
    '# Nothing should index this address.',
    '',
    'User-agent: *',
    'Disallow: /',
    '',
  ].join('\n'),
);

console.log(`Built dist/ — ${files} files, ${(bytes / 1024).toFixed(1)} KB`);
console.log(`Site staged at dist/lab/, ready to serve at https://ruood.com/lab`);
console.log(`Publish directory: dist`);
