# RUŌOD Lab — official website

The public product site for **RUŌOD Lab**, the perfume formulation and
laboratory-management application. Deployed at:

```
https://ruood.com/lab
```

`https://ruood.com` itself belongs to the main RUŌOD perfume business and is
**not** part of this project. Nothing here should be deployed to the apex.

---

## What this is

Static HTML, CSS and a small amount of vanilla JavaScript. No framework, no
build step for the content, no dependencies — `package.json` declares none, and
`node_modules/` is never created.

That was a deliberate choice, not a shortcut:

- every word of every page is in the HTML, so a crawler sees the content
  without executing anything;
- there is nothing to hydrate, so first render is the first paint;
- the site loads **zero third-party resources** — no web fonts, no CDN, no
  analytics — which is a real privacy property the Privacy Policy states in
  words, and not just a performance one;
- with JavaScript blocked, the whole site still works. The one script runs the
  mobile menu.

### Separation from the mobile app

This project is entirely separate from the RUŌOD Lab React Native application,
which lives in its own directory alongside this one. Nothing here imports from
it, and nothing in it was modified to build this. One asset was **copied** out
of it — the launcher icon, downsampled into `assets/images/` by
`tools/make-icons.mjs`.

---

## Pages

| URL | File |
| --- | --- |
| `/lab` | `index.html` |
| `/lab/about` | `about/index.html` |
| `/lab/privacy` | `privacy/index.html` |
| `/lab/contact` | `contact/index.html` |
| (any unknown path) | `404.html` |

---

## Structure

```
ruood-lab-website/
├── index.html              the product page
├── about/index.html
├── privacy/index.html
├── contact/index.html
├── 404.html
├── css/style.css           the whole design system, one file
├── js/main.js              mobile menu; the only script
├── assets/images/          brand marks + the social card
├── robots.txt              SOURCE — see Deployment
├── sitemap.xml
├── netlify.toml            publish config, headers, CSP
└── tools/                  never deployed
    ├── preview.mjs         local server, mounted at /lab
    ├── verify.mjs          links, SEO, accessibility basics
    ├── measure.mjs         real-browser layout measurement
    ├── shots.mjs           screenshots at real device metrics
    ├── build.mjs           stages dist/
    └── make-icons.mjs      regenerates the marks from the app icon
```

---

## The `/lab` prefix is load-bearing

**Every asset path and internal link is root-relative and begins with `/lab`.**
For example:

```html
<link rel="stylesheet" href="/lab/css/style.css">
<a href="/lab/privacy">Privacy Policy</a>
```

This is correct for the deployed URL and it is the single most important thing
to preserve. Two consequences:

1. **Opening `index.html` from the filesystem will look broken.** So will
   serving the folder at `http://localhost:8080/`. Neither is a bug, and
   "fixing" it by making the paths relative is what would actually break
   production, because the pages sit at two different depths (`/lab` and
   `/lab/about`).

2. **Local preview must be mounted at `/lab`.** `tools/preview.mjs` does
   exactly that, and `tools/verify.mjs` fails on any path that is relative or
   that points outside `/lab`.

---

## Local development

Requires Node 18 or newer. Nothing to install.

```bash
npm run preview           # http://localhost:8080/lab
```

### Checks

```bash
node tools/preview.mjs 8099 &   # the checks run against a live server

npm run verify    # links, titles, canonicals, headings, OG, JSON-LD, inline styles
npm run measure   # overflow + tap targets in Chrome, at 9 widths
npm run shots     # screenshots into ./.shots
```

`verify` and `measure` both exit non-zero on failure, so they work in CI.

**`measure.mjs` and `shots.mjs` need Chrome installed** — they drive it over
the DevTools Protocol. They look in the two standard Windows install paths;
change `CHROME` in each file on another platform.

> Chrome's old `--headless --screenshot --window-size=…` does **not** apply
> mobile emulation, so a phone-width capture comes back laid out wide and
> cropped — which looks exactly like a horizontal-overflow bug that is not
> there. `shots.mjs` uses `Emulation.setDeviceMetricsOverride` instead. Don't
> diagnose a layout from a `--window-size` screenshot.

---

## Deployment

```bash
npm run build     # → dist/
```

`build.mjs` stages the site into `dist/lab/`, because the paths require a `lab`
directory at the server root. It copies only the published files; `tools/` is
excluded.

```
dist/
├── lab/          ← the site
└── robots.txt    ← see below
```

**Publish directory: `dist`.** Publishing the project root instead would serve
the site at `/` and break every link.

### Which hosting situation applies

**A — this deployment serves `ruood.com`.** Use `netlify.toml` as it stands:
publish `dist`, and `dist/robots.txt` becomes the apex `robots.txt`. The main
RUŌOD site's own pages would need to be part of the same deployment.

**B — the main RUŌOD site owns the domain and only `/lab` comes from here.**
This is the likelier case.

- Delete `dist/robots.txt`; it would be ignored anyway.
- **`robots.txt` is only read at the apex.** A crawler fetches
  `https://ruood.com/robots.txt` and never `https://ruood.com/lab/robots.txt`,
  so the file in this repo is a **source to merge**. Add this line to the main
  site's `robots.txt`:

  ```
  Sitemap: https://ruood.com/lab/sitemap.xml
  ```

  and make sure nothing there disallows `/lab`.
- The rewrite belongs in the **main site's** configuration, not this one. On
  Netlify, in the main site's `netlify.toml`:

  ```toml
  [[redirects]]
    from = "/lab/*"
    to = "https://<this-site>.netlify.app/lab/:splat"
    status = 200   # 200 = proxy, so the URL stays ruood.com/lab
  ```

  The `200` matters: a `301` would move visitors off `ruood.com` and split the
  SEO value away from the canonical URLs.

### After any deploy

- `https://ruood.com/lab` loads, and so does `/lab/about`, `/lab/privacy`,
  `/lab/contact`, on a hard refresh as well as by link;
- `https://ruood.com/lab/sitemap.xml` returns XML;
- `https://ruood.com/robots.txt` does not disallow `/lab`;
- the social card resolves at
  `https://ruood.com/lab/assets/images/ruood-lab-social-card.png`;
- submit `https://ruood.com/lab/sitemap.xml` in Google Search Console.

---

## SEO

Handled per page, in the HTML:

- a unique `<title>` and meta description on each page (uniqueness is asserted
  by `verify.mjs`);
- `<link rel="canonical">` to the `/lab` URL — **never to the apex**, which
  `verify.mjs` also asserts, because canonicalising to `https://ruood.com/`
  would hand these pages to the main perfume site;
- exactly one `<h1>` per page, and no skipped heading levels;
- Open Graph and Twitter card metadata, with a 1200×630 image;
- JSON-LD: `WebSite`, `Organization` and `SoftwareApplication` on the home
  page, `FAQPage` for the FAQ, and `BreadcrumbList` on the three inner pages.

**No rating, review, price, award or download count appears in the structured
data**, because none of those is a fact anyone could stand behind yet.

---

## Content accuracy

The site describes what the application **currently does**. Copy was written
against the application's own source and its `CLAUDE.md`, not from a feature
wish-list. A few rules worth keeping when editing:

- **no cloud sync** — there is backup, which the user starts, and no
  synchronisation;
- **no collaboration**, no shared documents, no multi-user editing;
- **no AI** anywhere in the product;
- **export is PDF, CSV, Excel and JSON; import is CSV, Excel and JSON** — not
  TXT, not DOCX;
- **Android only** — the EAS build profiles produce Android artifacts;
- **nothing is behind the subscription.** RUŌOD Lab Premium exists via Google
  Play Billing and currently gates no feature. Do not imply otherwise;
- **no Google Play link**, because the app is not yet listed. Do not invent a
  store URL — add the real one when it exists;
- the diagrams are **diagrams**, and the one on the home page says so in its
  own caption. There are no screenshots on this site. If real ones are added,
  they must be of functionality that actually exists.

---

## Privacy Policy

`privacy/index.html` was written from the application's implementation, not
from a template. It was built by reading, in the app: the local database and
its AsyncStorage keys, SecureStore usage, the Google OAuth scopes and token
handling, the Drive API layer, the Google Play Billing integration, the
announcements fetcher, the export/import paths, the Android manifest, and a
repository-wide sweep for analytics, crash reporting, advertising and tracking
SDKs (there are none).

**If the application's behaviour changes, this page changes with it** —
particularly if anything new makes a network request, or if a feature is ever
placed behind the subscription. Update the `Last updated` date at the top when
you do.

---

## Accessibility

- semantic landmarks, a skip link, and `lang` on every page;
- one `h1` per page, no skipped levels;
- visible focus rings everywhere, never removed;
- the mobile menu is a real `<button>` with `aria-expanded`, closes on Escape
  and returns focus;
- all interactive targets clear the 24×24px WCAG 2.2 minimum, asserted by
  `measure.mjs`;
- body and small text clear WCAG AA contrast against every surface they are
  used on (the palette was measured, not eyeballed);
- `prefers-reduced-motion` disables transitions and smooth scrolling;
- wide tables scroll inside their own box rather than pushing the page
  sideways.

---

## Maintenance notes

- **Editing the inline `no-js` script means regenerating the CSP hash.** Every
  page carries one inline script, and the deployed
  `script-src` allows it by SHA-256 rather than with `'unsafe-inline'`. The
  hash appears in `netlify.toml` and in `tools/preview.mjs`, and the command to
  regenerate it is in a comment in `netlify.toml`.
- **No `style="…"` attributes.** The deployed CSP is `style-src 'self'` with no
  `'unsafe-inline'`, so an inline style is dropped in production while working
  in a preview that sends no header. `verify.mjs` fails on one; use a class.
- **The header and footer are duplicated across the five pages.** With no build
  step that is the trade, and it is a deliberate one — the alternative is a
  templating dependency for five files. Change one, change all five.
- **Regenerating the brand marks:** `node tools/make-icons.mjs <src.png> <out>
  <path-to-app>` — the third argument is where `pngjs` is resolved from, since
  this project has no dependencies of its own.
- Adding a page means: the file, an entry in `sitemap.xml`, the nav in all five
  pages, the footer, and `PAGES` in both `verify.mjs` and `measure.mjs`.
