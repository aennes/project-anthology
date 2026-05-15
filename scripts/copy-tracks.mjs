import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'tracks');
const dest = path.join(root, 'dist', 'tracks');

if (!fs.existsSync(src)) {
  console.error('copy-tracks: missing', src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });

const mustExist = ['index.html', 'app.js', 'styles.css'];
for (const f of mustExist) {
  const p = path.join(dest, f);
  if (!fs.existsSync(p)) {
    console.error('copy-tracks: expected file missing after copy:', p);
    process.exit(1);
  }
}
let count = 0;
function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else count += 1;
  }
}
walk(dest);
console.log(`copy-tracks: ok → ${path.relative(root, dest)} (${count} files)`);
