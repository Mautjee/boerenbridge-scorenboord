import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2];
if (url === undefined) {
  throw new Error('gebruik: node scripts/verify/js-off.mjs <url>');
}

const root = path.resolve(import.meta.dirname, '..', '..');
const shots = path.join(root, '.tmp');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  const body = await page.locator('body').innerText();
  assert.match(body, /Boerenbridge/);
  assert.match(body, /Totaal/);
  console.log(page.url());
  console.log(body.replace(/\s+/g, ' ').trim().slice(0, 300));
  await page.screenshot({ path: path.join(shots, 'share-js-off.png'), fullPage: true });
  console.log('JS_OFF_RENDER=1');
} finally {
  await browser.close();
}
