// ---------------------------------------------------------------------------
// fina - Sinh icon PWA tu public/branding/fina-icon.svg
//
//   node scripts/make-icons.mjs
//
// Sinh tu code de doi mau chi phai sua MOT cho (file SVG goc).
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'public/branding/fina-icon.svg';
const OUT = 'public/icons';
// Nen phai khop rect trong SVG goc, neu khong vien maskable se lo mot khung khac mau.
const BG = '#101014';

mkdirSync(OUT, { recursive: true });
const svg = readFileSync(SRC);

// density cao de rasterize sac net, roi moi resize xuong.
const render = (size) => sharp(svg, { density: 600 }).resize(size, size).png();

for (const size of [192, 512, 1024]) {
  writeFileSync(`${OUT}/icon-${size}.png`, await render(size).toBuffer());
  console.log(`icon-${size}.png`);
}

// apple-touch-icon: iOS khong bo goc gium, SVG da co san rx=30.
writeFileSync(`${OUT}/apple-touch-icon.png`, await render(180).toBuffer());
console.log('apple-touch-icon.png');

// Maskable: Android cat theo hinh bat ky, noi dung phai nam trong ~80% giua.
// Thu nho glyph roi dat len nen day khung.
const inner = await render(410).toBuffer();
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
