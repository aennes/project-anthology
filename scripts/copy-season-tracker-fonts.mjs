/**
 * Copies @fontsource WOFF2 files into public/fonts/st/ with stable names
 * so season-tracker/styles.css and radio-anthology/styles.css can self-host (no Google Fonts CDN).
 * Run: npm run fonts:season-tracker
 * Wired into build:vercel via (npm run fonts:season-tracker || npm run nop).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const destDir = path.join(root, 'public', 'fonts', 'st');

const copies = [
  ['@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2', 'bebas-neue-latin-400-normal.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-400-normal.woff2', 'barlow-condensed-latin-400-normal.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2', 'barlow-condensed-latin-500-normal.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2', 'barlow-condensed-latin-600-normal.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2', 'barlow-condensed-latin-700-normal.woff2'],
  ['@fontsource/dm-sans/files/dm-sans-latin-300-normal.woff2', 'dm-sans-latin-300-normal.woff2'],
  ['@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2', 'dm-sans-latin-400-normal.woff2'],
  ['@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2', 'dm-sans-latin-500-normal.woff2'],
  ['@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2', 'dm-sans-latin-700-normal.woff2'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'ibm-plex-mono-latin-400-normal.woff2'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', 'ibm-plex-mono-latin-600-normal.woff2'],
];

let ok = 0;
let skipped = 0;
fs.mkdirSync(destDir, { recursive: true });
for (const [rel, destName] of copies) {
  const src = path.join(root, 'node_modules', rel);
  const dest = path.join(destDir, destName);
  if (!fs.existsSync(src)) {
    skipped += 1;
    continue;
  }
  fs.copyFileSync(src, dest);
  ok += 1;
}
console.log(`copy-season-tracker-fonts: ${ok} copied → public/fonts/st (${skipped} missing — run npm install)`);
if (ok === 0) process.exit(0);
