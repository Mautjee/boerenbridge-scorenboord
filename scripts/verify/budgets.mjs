import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const out = path.join(root, 'internal', 'assets', 'static');

function fileFor(url) {
  if (url === '/') {
    return path.join(out, 'index.html');
  }
  if (url.startsWith('/static/')) {
    return path.join(out, url.slice('/static/'.length));
  }
  throw new Error(`onbekende precache-url: ${url}`);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const precache = JSON.parse(await readFile(path.join(out, 'precache.json'), 'utf8'));
let failed = false;

function check(label, actual, budget, unit = 'kB') {
  const over = actual > budget;
  if (over) {
    failed = true;
  }
  const shown = unit === 'kB' ? kb(actual) : `${actual} B`;
  const max = unit === 'kB' ? kb(budget) : `${budget} B`;
  console.log(`${over ? 'FAIL' : 'ok  '} ${label}: ${shown} (budget ${max})`);
}

const appJs = await readFile(path.join(out, 'app.js'));
const appCss = await readFile(path.join(out, 'app.css'));
check('app.js gzip', gzipSync(appJs).length, 60 * 1024);
check('app.css gzip', gzipSync(appCss).length, 25 * 1024);

const iconNames = precache.files.filter((url) => url.startsWith('/static/icons/'));
for (const url of iconNames) {
  const info = await stat(fileFor(url));
  check(url, info.size, 15 * 1024, 'B');
}

const firstViewFiles = [
  path.join(out, 'index.html'),
  path.join(out, 'app.js'),
  path.join(out, 'app.css'),
  path.join(out, 'manifest.json'),
  path.join(out, 'icons', 'icon-192.png'),
];
let firstView = 0;
for (const file of firstViewFiles) {
  firstView += (await stat(file)).size;
}
check('first view raw', firstView, 250 * 1024);

let total = 0;
for (const url of precache.files) {
  total += (await stat(fileFor(url))).size;
}
check('precache total raw', total, 300 * 1024);

if (failed) {
  process.exitCode = 1;
}
