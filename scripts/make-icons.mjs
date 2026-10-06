// ---------------------------------------------------------------------------
// fina - Build PWA icons from public/branding/fina-icon.svg
//
//   node scripts/make-icons.mjs
//
// Generated, so a color change means editing ONE file (the source SVG).
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'public/branding/fina-icon.svg';
const OUT = 'public/icons';
// Must match the rect in the source SVG, or the maskable edge shows a different-colored frame.
const BG = '#f4f4f1';

mkdirSync(OUT, { recursive: true });
const svg = readFileSync(SRC);
// OS version: drop the thin border around the tile. iOS/Android apply their own
// mask, which would clip the border unevenly at the corners.
const plain = Buffer.from(
  svg.toString().replace(/(<rect [^>]*?) stroke="[^"]*" stroke-width="[^"]*"/, '$1'),
);

// High density for a sharp raster, then resize down.
const render = (size, src = svg) => sharp(src, { density: 600 }).resize(size, size).png();

for (const size of [192, 512, 1024]) {
  writeFileSync(`${OUT}/icon-${size}.png`, await render(size).toBuffer());
  console.log(`icon-${size}.png`);
}

// apple-touch-icon: iOS rounds the corners and fills transparency with BLACK.
// On a light tile that shows, so fill the whole square with the background.
writeFileSync(
  `${OUT}/apple-touch-icon.png`,
  await render(180, plain).flatten({ background: BG }).toBuffer(),
);
console.log('apple-touch-icon.png');

// Maskable: Android may crop to any shape; content must sit in the middle ~80%.
// Shrink the glyph and place it on a full-bleed background.
const inner = await render(410, plain).toBuffer();
writeFileSync(
  `${OUT}/maskable-512.png`,
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: BG },
  })
    .composite([{ input: inner, top: 51, left: 51 }])
    .png()
    .toBuffer(),
);
console.log('maskable-512.png');
