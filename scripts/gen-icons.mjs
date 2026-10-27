import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(import.meta.dirname, '..');
const pwa = path.join(root, 'web', 'pwa');
const outDir = path.join(pwa, 'icons');

const targets = [
  { source: 'icon.svg', size: 192, out: 'icon-192.png' },
  { source: 'icon.svg', size: 512, out: 'icon-512.png' },
  { source: 'icon-maskable.svg', size: 192, out: 'maskable-192.png' },
  { source: 'icon-maskable.svg', size: 512, out: 'maskable-512.png' },
  { source: 'icon.svg', size: 180, out: 'apple-touch-180.png' },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const target of targets) {
    const svg = await readFile(path.join(pwa, target.source), 'utf8');
    const page = await browser.newPage({
      viewport: { width: target.size, height: target.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0b5f3c}svg{display:block;width:100%;height:100%}</style></head><body>${svg}</body></html>`,
      { waitUntil: 'load' },
    );
    await page.screenshot({ path: path.join(outDir, target.out), omitBackground: false });
    await page.close();
    console.log(`${target.out}: ${target.size}x${target.size}`);
  }
} finally {
  await browser.close();
}
