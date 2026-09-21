/**
 * Local preview, served at /lab — which is the only way to test this site
 * honestly.
 *
 * Every asset path and every internal link in the site is root-relative and
 * carries the `/lab` prefix, because that is where the site is deployed. Open
 * the folder at `http://localhost:8080/` instead and every one of those paths
 * 404s — so a plain static server would tell you the site is broken, and
 * "fixing" it by making the paths relative is what would actually break
 * production.
 *
 * This mounts the project at /lab and nothing else, so what you see locally is
 * what the deployed URLs do. Node's standard library only; no dependencies and
 * no package.json.
 *
 *   node tools/preview.mjs [port]
 *   → http://localhost:8080/lab
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const PORT = Number(process.argv[2]) || 8080;
const BASE = '/lab';

/** Kept in step with netlify.toml by hand; there are two copies of one string
 *  because the deploy config cannot import from here. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'sha256-tuKyZn/3ycw/MNMDii/kvSPrelo6SCsJSecqb1n2neg='",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** Resolve a request path to a file, applying the directory-index rule a
 *  static host applies: `/lab/about` serves `about/index.html`. */
async function resolve(urlPath) {
  // Strip the mount prefix. Anything outside it is not ours to serve.
  if (urlPath !== BASE && !urlPath.startsWith(BASE + '/')) return null;
  let rel = urlPath.slice(BASE.length) || '/';

  // `..` must not escape the project, even though this only ever binds to
  // localhost.
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, safe);
  if (!file.startsWith(ROOT + sep) && file !== ROOT) return null;

  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    // A bare path with no extension is a directory URL the host would resolve.
    if (!extname(file)) file = join(file, 'index.html');
  }

  try {
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    .replace(/\/+$/, '') || '/';

  // Serving the root as a courtesy: the real site lives under /lab, and the
  // main RUŌOD site owns everything above it.
  if (urlPath === '/') {
    res.writeHead(302, { location: BASE });
    res.end();
    return;
  }

  const file = await resolve(urlPath);

  if (!file) {
    const notFound = await resolve(BASE + '/404.html');
    const body = notFound ? await readFile(notFound) : 'Not found';
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(body);
    console.log(`404  ${urlPath}`);
    return;
  }

  const body = await readFile(file);
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
    // The same policy netlify.toml deploys. Sending it locally too is the
    // point: `style-src 'self'` silently drops inline style attributes, so a
    // preview without the header would look right and production would not.
    'content-security-policy': CSP,
  });
  res.end(body);
  console.log(`200  ${urlPath}  (${body.length} bytes)`);
});

server.listen(PORT, () => {
  console.log(`RUŌOD Lab preview → http://localhost:${PORT}${BASE}`);
  console.log(`Serving ${ROOT} mounted at ${BASE}`);
});
