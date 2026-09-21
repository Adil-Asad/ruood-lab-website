/**
 * Site verification — links, assets, SEO and accessibility basics.
 *
 * Runs against the live preview server rather than against the files, so it
 * tests the /lab paths exactly as a browser and a crawler will resolve them.
 * That is the whole point: a path that is right on disk and wrong under /lab
 * is the failure mode this project is most exposed to.
 *
 *   node tools/preview.mjs 8099 &
 *   node tools/verify.mjs 8099
 */

const PORT = Number(process.argv[2]) || 8099;
const ORIGIN = `http://localhost:${PORT}`;
const PAGES = ['/lab', '/lab/about', '/lab/privacy', '/lab/contact', '/lab/404.html'];

const problems = [];
const notes = [];
const fail = (page, msg) => problems.push(`${page}: ${msg}`);

const checked = new Map();
async function status(url) {
  if (checked.has(url)) return checked.get(url);
  let code;
  try {
    code = (await fetch(ORIGIN + url, { method: 'GET' })).status;
  } catch (e) {
    code = 0;
  }
  checked.set(url, code);
  return code;
}

const attrs = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

const titles = new Map();
const descriptions = new Map();

for (const page of PAGES) {
  const res = await fetch(ORIGIN + page);
  if (!res.ok) { fail(page, `page returned ${res.status}`); continue; }
  const html = await res.text();

  // ── Content is in the HTML, not built by script ────────────────────────
  const textLength = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
  if (textLength < 400) fail(page, `only ${textLength} chars of text in raw HTML`);

  // ── Title / description uniqueness ─────────────────────────────────────
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  if (!title) fail(page, 'no <title>');
  else if (titles.has(title)) fail(page, `title duplicates ${titles.get(title)}`);
  else titles.set(title, page);
  if (title && title.length > 65) notes.push(`${page}: title is ${title.length} chars (>65 may truncate in SERPs)`);

  const desc = (html.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1];
  if (!desc) fail(page, 'no meta description');
  else if (descriptions.has(desc)) fail(page, `description duplicates ${descriptions.get(desc)}`);
  else descriptions.set(desc, page);
  if (desc && (desc.length < 70 || desc.length > 165)) {
    notes.push(`${page}: description is ${desc.length} chars (70-165 is the useful range)`);
  }

  // ── Canonical ──────────────────────────────────────────────────────────
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (page === '/lab/404.html') {
    if (canonical) fail(page, '404 should not be canonicalised');
    if (!/name="robots" content="noindex/.test(html)) fail(page, '404 is not noindex');
  } else {
    const expected = 'https://ruood.com' + page;
    if (canonical !== expected) fail(page, `canonical is "${canonical}", expected "${expected}"`);
    if (canonical === 'https://ruood.com/' || canonical === 'https://ruood.com') {
      fail(page, 'canonicalised to the ROOT domain, which belongs to the main RUŌOD site');
    }
  }

  // ── Accidental noindex ─────────────────────────────────────────────────
  if (page !== '/lab/404.html' && /content="[^"]*noindex/.test(html)) {
    fail(page, 'carries noindex');
  }

  // ── Headings ───────────────────────────────────────────────────────────
  const h1s = attrs(html, /<h1[^>]*>([\s\S]*?)<\/h1>/g);
  if (h1s.length !== 1) fail(page, `${h1s.length} <h1> elements, expected exactly 1`);

  // Heading order: no level may be skipped on the way down.
  const levels = [...html.matchAll(/<h([1-4])[^>]*>/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      fail(page, `heading jumps h${levels[i - 1]} → h${levels[i]}`);
      break;
    }
  }

  // ── Landmarks ──────────────────────────────────────────────────────────
  for (const tag of ['<main', '<header', '<footer', '<nav']) {
    if (!html.includes(tag)) fail(page, `no ${tag}> landmark`);
  }
  if (!html.includes('skip-link')) fail(page, 'no skip link');
  if (!/<html lang="en"/.test(html)) fail(page, 'no lang on <html>');

  // ── Images: alt and intrinsic size ─────────────────────────────────────
  for (const tag of [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])) {
    if (!/\balt=/.test(tag)) fail(page, `<img> with no alt: ${tag.slice(0, 70)}`);
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
      fail(page, `<img> with no width/height (layout shift): ${tag.slice(0, 70)}`);
    }
  }

  // ── Open Graph ─────────────────────────────────────────────────────────
  if (page !== '/lab/404.html') {
    for (const prop of ['og:title', 'og:description', 'og:url', 'og:image']) {
      if (!html.includes(`property="${prop}"`)) fail(page, `no ${prop}`);
    }
  }

  // ── Structured data parses ─────────────────────────────────────────────
  for (const block of [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]) {
    try { JSON.parse(block[1]); }
    catch (e) { fail(page, `invalid JSON-LD: ${e.message}`); }
  }

  // ── Every local href and src resolves ──────────────────────────────────
  const refs = [
    ...attrs(html, /href="([^"]+)"/g),
    ...attrs(html, /src="([^"]+)"/g),
  ];

  for (const ref of refs) {
    if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
    if (!ref.startsWith('/')) {
      fail(page, `relative path "${ref}" — must be root-relative under /lab`);
      continue;
    }
    if (!ref.startsWith('/lab')) {
      fail(page, `path "${ref}" is outside /lab and would hit the main RUŌOD site`);
      continue;
    }
    const [path, hash] = ref.split('#');
    const code = await status(path);
    if (code !== 200) fail(page, `broken link ${ref} → ${code}`);
    // An in-page anchor must have a target on this page.
    if (hash && path === page && !html.includes(`id="${hash}"`)) {
      fail(page, `anchor #${hash} has no target`);
    }
  }

  // ── No inline style attributes ─────────────────────────────────────────
  //
  // The deployed CSP is `style-src 'self'` with no 'unsafe-inline', so an
  // inline style attribute is DROPPED in production while working perfectly in
  // a local preview that sends no CSP header. That is the worst kind of bug to
  // ship, so it is a hard failure here.
  const inlineStyles = [...html.matchAll(/<[^>]+\sstyle="([^"]*)"/g)];
  for (const m of inlineStyles) {
    fail(page, `inline style="${m[1].slice(0, 46)}" — use a class (blocked by CSP)`);
  }

  // ── No third-party requests ────────────────────────────────────────────
  const external = refs.filter((r) => /^https?:\/\//.test(r));
  for (const url of external) {
    const host = new URL(url).host;
    const allowed = ['ruood.com', 'myaccount.google.com', 'policies.google.com', 'docs.github.com'];
    if (!allowed.includes(host)) fail(page, `unexpected external host: ${host}`);
  }
  // Anything that would *load* from a third party is the real problem.
  const loaded = [...attrs(html, /<(?:script|link|img)[^>]+(?:src|href)="(https?:\/\/[^"]+)"/g)];
  const loadedThirdParty = loaded.filter((u) => !new URL(u).host.endsWith('ruood.com'));
  if (loadedThirdParty.length) {
    fail(page, `loads third-party resources: ${loadedThirdParty.join(', ')}`);
  }

  console.log(`checked ${page} — ${refs.length} refs, ${textLength} chars of text`);
}

// ── Sitemap and robots ─────────────────────────────────────────────────────
const sitemap = await (await fetch(ORIGIN + '/lab/sitemap.xml')).text();
const locs = attrs(sitemap, /<loc>([^<]+)<\/loc>/g);
for (const page of PAGES.filter((p) => p !== '/lab/404.html')) {
  if (!locs.includes('https://ruood.com' + page)) fail('sitemap.xml', `missing ${page}`);
}
for (const loc of locs) {
  if (!loc.startsWith('https://ruood.com/lab')) fail('sitemap.xml', `non-/lab URL: ${loc}`);
}
if (locs.length !== 4) fail('sitemap.xml', `${locs.length} URLs, expected 4`);

const robots = await (await fetch(ORIGIN + '/lab/robots.txt')).text();
if (/Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt', 'disallows everything');
if (!robots.includes('Sitemap: https://ruood.com/lab/sitemap.xml')) {
  fail('robots.txt', 'no sitemap reference');
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log('');
if (notes.length) {
  console.log('Notes:');
  for (const n of notes) console.log('  · ' + n);
  console.log('');
}
if (problems.length) {
  console.log(`FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exitCode = 1;
}
console.log(`PASSED — ${PAGES.length} pages, ${checked.size} unique local paths, all resolve.`);
