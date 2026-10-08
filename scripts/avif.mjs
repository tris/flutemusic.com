// Makes the AVIF copies of the site's photos that the pages offer to browsers that
// can show AVIF. They're a third the size of the JPEGs or less, and look the same.
// Run `npm run avif` after replacing one of these JPEGs.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PHOTOS = ['KPFS1.jpg', 'flowerflute2_soft_web.jpg', 'portrait.jpg', 'Kathy.jpg'];

for (const photo of PHOTOS) {
  const avif = photo.replace(/\.jpg$/, '.avif');
  const { size } = await sharp(fileURLToPath(new URL(`../public/${photo}`, import.meta.url)))
    .avif({ quality: 60 })
    .toFile(fileURLToPath(new URL(`../public/${avif}`, import.meta.url)));
  console.log(`${avif}: ${Math.round(size / 1024)} KiB`);
}
