# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

The **official public website for RUŌOD Lab**, deployed at
`https://ruood.com/lab`. Static HTML, CSS and vanilla JavaScript. **No
framework, no dependencies, no build step for the content.**

`https://ruood.com` is the main RUŌOD perfume business and is not part of this
project. Never deploy to, link canonically to, or change anything at the apex.

This is a **separate project from the RUŌOD Lab mobile application**, which
lives in its own directory alongside this one (typically `../app`). Read from
it freely; do not modify it. The only thing taken from it is the launcher icon,
copied and downsampled into `assets/images/`.

## Commands

Node 18+. There is nothing to install.

```bash
npm run preview                 # http://localhost:8080/lab
node tools/preview.mjs 8099 &   # the checks run against a live server
npm run verify                  # links, SEO, a11y basics, inline styles
npm run measure                 # overflow + tap targets in Chrome, 9 widths
npm run shots                   # screenshots into ./.shots
npm run build                   # → dist/ (publish dist, not the repo root)
```

`verify` and `measure` exit non-zero on failure. Run **both** before calling
work done — they check different things and neither subsumes the other.

`measure.mjs` and `shots.mjs` drive an installed Chrome over the DevTools
Protocol; the two standard Windows paths are hard-coded in each.

## The `/lab` prefix is load-bearing

Every asset path and internal link is root-relative and starts with `/lab`
(`href="/lab/css/style.css"`, `href="/lab/privacy"`). That is correct for the
deployed URL and it is the constraint most easily broken.

- **Opening a file directly, or serving the folder at `/`, will look broken.**
  That is expected. Do not "fix" it by making paths relative — the pages sit at
  two depths (`/lab` and `/lab/about`), so relative paths cannot be right for
  both, and they would break production.
- `verify.mjs` fails on any path that is relative or outside `/lab`, and on a
  canonical pointing at the apex.
- `build.mjs` stages into `dist/lab/` for the same reason.

## Rules that are not preferences

### No third-party resources, ever

The site loads nothing from another origin — no web fonts, no CDN, no
analytics, no embeds. The type stacks are device fonts. This is a **stated
privacy property**: `privacy/index.html` says in words that the site makes no
third-party requests. Adding one makes that page false, so it would have to be
changed in the same commit. `verify.mjs` fails on a cross-origin `script`,
`link` or `img`.

Do not add analytics unless the user explicitly asks, and if they do, the
Privacy Policy and the `Permissions-Policy`/CSP headers change with it.

### No `style="…"` attributes

The deployed CSP is `style-src 'self'` with no `'unsafe-inline'`, so an inline
style is **silently dropped in production** while working in a preview that
sends no header. Use a class; there are small placement utilities at the end of
`style.css` for one-offs. `verify.mjs` fails on one, and `preview.mjs` sends
the production CSP so the local preview cannot disagree with the deploy.

### The inline script is allowed by hash

Every page carries one inline script —
`document.documentElement.classList.remove('no-js');` — allowed in `script-src`
by SHA-256 rather than `'unsafe-inline'`, so nothing else inline can run. The
hash is in **two** places, `netlify.toml` and `tools/preview.mjs`, and the
command to regenerate it is commented in `netlify.toml`. Change that line and
both must be updated.

### Content must match the application

Copy was written against the app's source and its `CLAUDE.md`. Before writing
any claim about what the product does, verify it there. In particular:

- **no cloud sync** — backup only, user-initiated (or on a schedule checked
  when the app next opens; there is no background worker);
- **no collaboration**, no sharing, no multi-user anything;
- **no AI** in the product;
- **export: PDF, CSV, Excel, JSON. Import: CSV, Excel, JSON.** Not TXT, not
  DOCX;
- **Android only** — every EAS build profile produces an Android artifact;
- **nothing is gated.** RUŌOD Lab Premium exists through Google Play Billing
  and currently places no feature behind it. `useSubscription` has exactly
  three consumers in the app, which is what pins that;
- **there is no Google Play listing yet**, so there is no download link. Never
  invent a store URL;
- the home page's hero figure is a **diagram** and its caption says so. There
  are no screenshots on this site, and nothing may imply there are.

The three percentages, the dilution methods and the solvent distinctions on the
home page are taken from `formula-calculation-engine.ts`. If that file's
semantics change, the page is wrong.

### The Privacy Policy is derived, not templated

`privacy/index.html` was written by reading the app's implementation: the
database and its AsyncStorage keys, SecureStore, the OAuth scopes
(`openid`, `profile`, `email`, `drive.file`), token handling, the Drive API
layer, Play Billing, the announcements fetcher, import/export, the Android
manifest, and a repo-wide sweep confirming there is no analytics, crash
reporting, advertising or tracking SDK.

Do not add a privacy claim that the code does not support, and do not remove
one without checking the code first. If app behaviour changes — especially a
new network request, or a feature going behind the subscription — this page
changes with it, and the `Last updated` date at the top changes too.

### SEO invariants

- one `<h1>` per page; no skipped heading levels;
- unique `<title>` and meta description per page;
- canonical to the `/lab` URL, never the apex;
- structured data carries **no rating, review, price, award or download
  count** — none of those is a fact anyone can stand behind.

`robots.txt` is only honoured at the apex, so the file here is a **source to
merge** into the main site's. See README, *Deployment*.

## Structure

```
index.html  about/  privacy/  contact/  404.html
css/style.css        one file: tokens → primitives → sections → utilities
js/main.js           mobile menu and current-page marking; the only script
assets/images/       brand marks + social card, generated from the app icon
tools/               never deployed
```

The header and footer are **duplicated across the five pages**. With no build
step that is the trade, deliberately taken rather than adding a templating
dependency for five files. Change one, change all five — and update the nav in
all five when adding a page, plus `sitemap.xml` and the `PAGES` array in both
`verify.mjs` and `measure.mjs`.

## Design

The palette is the product's own: gold `#D9A441` (the gilded Ō of the app's
launcher icon) for brand moments, emerald `#10B981` for data and figures — the
app's own accent, doing the same job — on the app's black.

Colour was **measured, not eyeballed**: body and small text clear WCAG AA
against every surface they sit on, and `--line-control` exists separately from
`--line-strong` because a control's boundary needs 3:1 and a decorative divider
does not. Check any new pair before using it.

Spacing comes from the tokens at the top of `style.css`. Don't fix an alignment
difference with a one-off number.
