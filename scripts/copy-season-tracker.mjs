import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'season-tracker');
const dest = path.join(root, 'dist', 'season-tracker');

if (!fs.existsSync(src)) {
  console.error('copy-season-tracker: missing', src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
