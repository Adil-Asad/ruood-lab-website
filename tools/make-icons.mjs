/**
 * Downsamples the application's own launcher icon into the web sizes.
 *
 * The source is `assets/images/icon.png` in the mobile app — 1024x1024 and
 * ~900 KB, which is an order of magnitude more bytes than a 64px mark on a web
 * page can use. There is no second brand asset: the same file is the splash,
 * the About screen mark and the source `pdf-logo.ts` was generated from.
 *
 * Box-filter averaging over an integer block, so every source pixel
 * contributes exactly once. Run from the app directory, which is where `pngjs`
 * resolves; the app is otherwise untouched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const PNG = createRequire(import.meta.url)(process.argv[4] + '/node_modules/pngjs').PNG;

const SRC = process.argv[2];
const OUT_DIR = process.argv[3];

const src = PNG.sync.read(readFileSync(SRC));

function downsample(png, size) {
  const out = new PNG({ width: size, height: size });
  const block = png.width / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const y0 = Math.floor(y * block), y1 = Math.floor((y + 1) * block);
      const x0 = Math.floor(x * block), x1 = Math.floor((x + 1) * block);
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (png.width * sy + sx) << 2;
          const alpha = png.data[i + 3] / 255;
          // Premultiply, so transparent pixels do not drag colour toward black.
          r += png.data[i] * alpha; g += png.data[i + 1] * alpha;
          b += png.data[i + 2] * alpha; a += png.data[i + 3];
          n++;
        }
      }
      const o = (size * y + x) << 2;
      const meanAlpha = a / n / 255;
      out.data[o]     = meanAlpha > 0 ? Math.round(r / n / meanAlpha) : 0;
      out.data[o + 1] = meanAlpha > 0 ? Math.round(g / n / meanAlpha) : 0;
      out.data[o + 2] = meanAlpha > 0 ? Math.round(b / n / meanAlpha) : 0;
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

for (const size of [512, 256, 180, 96, 64, 32]) {
  const png = downsample(src, size);
  const buf = PNG.sync.write(png, { deflateLevel: 9 });
  writeFileSync(`${OUT_DIR}/ruood-lab-mark-${size}.png`, buf);
  console.log(`ruood-lab-mark-${size}.png  ${buf.length} bytes`);
}
