import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'internal', 'assets', 'static');
const pwa = path.join(root, 'web', 'pwa');
const iconsOut = path.join(out, 'icons');

await rm(out, { recursive: true, force: true });
await mkdir(iconsOut, { recursive: true });

const js = await build({
  entryPoints: [path.join(root, 'web', 'src', 'app.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  outfile: path.join(out, 'app.js'),
  logLevel: 'silent',
  metafile: true,
});

const css = await build({
  entryPoints: [path.join(root, 'web', 'src', 'styles', 'app.css')],
  bundle: true,
  minify: true,
  outfile: path.join(out, 'app.css'),
  logLevel: 'silent',
  metafile: true,
});

const shell = path.join(root, 'web', 'index.html');
if (!existsSync(shell)) {
  throw new Error('web/index.html ontbreekt');
}
await copyFile(shell, path.join(out, 'index.html'));
await copyFile(path.join(pwa, 'manifest.json'), path.join(out, 'manifest.json'));

const iconNames = (await readdir(path.join(pwa, 'icons'))).filter((name) => name.endsWith('.png')).sort();
if (iconNames.length === 0) {
  throw new Error('web/pwa/icons bevat geen PNG-iconen; draai npm run icons');
}
for (const name of iconNames) {
  await copyFile(path.join(pwa, 'icons', name), path.join(iconsOut, name));
}

const hashInputs = [
  { label: 'index.html', file: path.join(out, 'index.html') },
  { label: 'app.js', file: path.join(out, 'app.js') },
  { label: 'app.css', file: path.join(out, 'app.css') },
  { label: 'manifest.json', file: path.join(out, 'manifest.json') },
  ...iconNames.map((name) => ({ label: `icons/${name}`, file: path.join(iconsOut, name) })),
  { label: 'sw.ts', file: path.join(root, 'web', 'src', 'sw.ts') },
];

const hash = createHash('sha256');
for (const input of hashInputs) {
  hash.update(input.label);
  hash.update(await readFile(input.file));
}
const digest = hash.digest('hex');
const cacheName = `boerenbridge-${digest.slice(0, 8)}`;

const precacheFiles = [
  '/',
  '/static/app.js',
  '/static/app.css',
  '/static/manifest.json',
  ...iconNames.map((name) => `/static/icons/${name}`),
].sort((a, b) => {
  if (a === '/') return -1;
  if (b === '/') return 1;
  return a.localeCompare(b);
});

const sw = await build({
  entryPoints: [path.join(root, 'web', 'src', 'sw.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  outfile: path.join(out, 'sw.js'),
  logLevel: 'silent',
  define: {
    __PRECACHE__: JSON.stringify(precacheFiles),
    __CACHE_NAME__: JSON.stringify(cacheName),
  },
});

await writeFile(
  path.join(out, 'precache.json'),
  `${JSON.stringify({ version: cacheName, cache: cacheName, files: precacheFiles }, null, 2)}\n`,
);

for (const [name, result] of [
  ['app.js', js],
  ['app.css', css],
]) {
  const info = await stat(path.join(out, name));
  const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
  const source = await readFile(path.join(out, name));
  console.log(`${name}: ${bytes} bytes (${source.length} written)`);
  if (info.size === 0) {
    throw new Error(`${name} is leeg`);
  }
}

console.log(`sw.js: ${(await stat(path.join(out, 'sw.js'))).size} bytes, cache ${cacheName}`);
console.log(`precache.json: ${precacheFiles.length} urls`);
