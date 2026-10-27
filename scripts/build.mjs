import { mkdir, copyFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'internal', 'assets', 'static');

await mkdir(out, { recursive: true });

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
if (existsSync(shell)) {
  await copyFile(shell, path.join(out, 'index.html'));
}

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
