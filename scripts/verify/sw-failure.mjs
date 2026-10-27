import assert from 'node:assert/strict';
import { cp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { startStaticServer } from './_static-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(import.meta.dirname, '..', '..');
const temp = path.join(root, '.tmp', 'sw-failure');
await rm(temp, { recursive: true, force: true });
await cp(path.join(root, 'internal', 'assets', 'static'), temp, { recursive: true });
await rm(path.join(temp, 'icons', 'icon-512.png'));

const { server, base } = await startStaticServer(temp);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const warnings = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      warnings.push(message.text());
    }
  });
  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15000 });
  await page.waitForFunction(
    () => true,
    { timeout: 1000 },
  );
  await page.waitForTimeout(500);

  const warning = warnings.find((line) => line.includes('/static/icons/icon-512.png'));
  assert.ok(warning, 'de mislukte URL moet apart worden gemeld');
  console.log('per-URL warning:', warning);
  const entries = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names[0]);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  console.log('cached entries after one failed URL:', entries.length);
  assert.equal(entries.length, 8);
  console.log('INSTALL_CONTINUED_AFTER_FAILURE=1');
} finally {
  await browser.close();
  server.close();
  await rm(temp, { recursive: true, force: true });
}
