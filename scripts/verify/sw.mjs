import assert from 'node:assert/strict';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { startStaticServer } from './_static-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(import.meta.dirname, '..', '..');
const source = path.join(root, 'internal', 'assets', 'static');
const temp = path.join(root, '.tmp', 'sw-test');
const precache = JSON.parse(await readFile(path.join(source, 'precache.json'), 'utf8'));

await rm(temp, { recursive: true, force: true });
await cp(source, temp, { recursive: true });

const { server, base } = await startStaticServer(temp);
const browser = await chromium.launch({ headless: true });

async function cacheState(page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const entries = {};
    for (const name of names) {
      const cache = await caches.open(name);
      entries[name] = (await cache.keys()).map((request) => new URL(request.url).pathname + (new URL(request.url).search));
    }
    return entries;
  });
}

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);

  const before = await cacheState(page);
  console.log('cache names before:', Object.keys(before).join(', '));
  assert.deepEqual(Object.keys(before), [precache.version]);
  const urls = [...(before[precache.version] ?? [])].sort();
  console.log(`${precache.version} entries:`);
  for (const url of urls) {
    console.log(`  ${url}`);
  }
  assert.deepEqual(urls, [...precache.files].sort());
  console.log('CACHE_EXACT=1');

  const swPath = path.join(temp, 'sw.js');
  const original = await readFile(swPath, 'utf8');
  const updated = original.replaceAll(precache.version, 'boerenbridge-update1');
  assert.notEqual(updated, original, 'cache name moet in sw.js staan');
  await writeFile(swPath, updated);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  await page.waitForSelector('.update-bar', { timeout: 15000 });
  const barText = await page.locator('.update-bar').innerText();
  console.log('update bar:', barText.replace(/\s+/g, ' ').trim());
  assert.match(barText, /Nieuwe versie beschikbaar/);

  const reloaded = page.waitForEvent('load', { timeout: 15000 });
  await page.getByRole('button', { name: 'Herladen' }).click();
  await reloaded;
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15000 });
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    return names.includes('boerenbridge-update1');
  }, { timeout: 15000 });

  const after = await cacheState(page);
  console.log('cache names after:', Object.keys(after).join(', '));
  assert.deepEqual(Object.keys(after), ['boerenbridge-update1']);
  console.log('OLD_CACHE_DELETED=1');
  console.log('UPDATE_PROMPT=1');
} finally {
  await browser.close();
  server.close();
  await rm(temp, { recursive: true, force: true });
}
