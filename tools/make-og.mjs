/**
 * Composes the Open Graph / social preview card, 1200x630.
 *
 * Built from the application's own mark rather than a separate brand asset —
 * the same rule the About screen and `pdf-logo.ts` follow. The card is the
 * mark on the app's own black, with the gold rule beneath it; no text is
 * drawn, because a hand-rasterised typeface at this size reads worse than the
 * title the platform already renders beside the image.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const PNG = createRequire(import.meta.url)(process.argv[3] + '/node_modules/pngjs').PNG;

const OUT = process.argv[2];
const W = 1200, H = 630;

const mark = PNG.sync.read(readFileSync(`${OUT}/ruood-lab-mark-256.png`));
const out = new PNG({ width: W, height: H });

// Base: the app's own #0B0B0C, with a soft radial warmth behind the mark.
const cx = W / 2, cy = H / 2 - 20;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (W * y + x) << 2;
    const d = Math.hypot(x - cx, y - cy) / 520;
    const glow = Math.max(0, 1 - d) ** 2.2;
    out.data[i]     = Math.round(11 + glow * 38);
    out.data[i + 1] = Math.round(11 + glow * 28);
    out.data[i + 2] = Math.round(12 + glow * 10);
    out.data[i + 3] = 255;
  }
}

// The mark, centred, over the glow.
const M = mark.width;
const ox = Math.round((W - M) / 2), oy = Math.round(cy - M / 2 - 30);
for (let y = 0; y < M; y++) {
  for (let x = 0; x < M; x++) {
    const s = (M * y + x) << 2;
    const a = mark.data[s + 3] / 255;
    if (a === 0) continue;
    const d = (W * (oy + y) + (ox + x)) << 2;
    for (let c = 0; c < 3; c++) {
      out.data[d + c] = Math.round(mark.data[s + c] * a + out.data[d + c] * (1 - a));
    }
  }
}

// A gold rule beneath the mark — the same accent line the About screen draws.
const ruleY = oy + M + 54, ruleW = 180, ruleH = 3;
for (let y = ruleY; y < ruleY + ruleH; y++) {
  for (let x = Math.round(cx - ruleW / 2); x < Math.round(cx + ruleW / 2); x++) {
    const t = Math.abs(x - cx) / (ruleW / 2);
    const a = 1 - t * t;
    const i = (W * y + x) << 2;
    out.data[i]     = Math.round(0xD9 * a + out.data[i] * (1 - a));
    out.data[i + 1] = Math.round(0xA4 * a + out.data[i + 1] * (1 - a));
    out.data[i + 2] = Math.round(0x41 * a + out.data[i + 2] * (1 - a));
  }
}

const buf = PNG.sync.write(out, { deflateLevel: 9 });
writeFileSync(`${OUT}/ruood-lab-social-card.png`, buf);
console.log(`ruood-lab-social-card.png  ${buf.length} bytes`);
