import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { startStaticServer } from './_static-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(import.meta.dirname, '..', '..');
const temp = path.join(root, '.tmp');
const exportPath = path.join(temp, 'export.json');
await mkdir(temp, { recursive: true });

const { server, base } = await startStaticServer(path.join(root, 'internal', 'assets', 'static'));
const browser = await chromium.launch({ headless: true });

async function readGames(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('boerenbridge');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const games = await new Promise((resolve, reject) => {
      const request = db.transaction('games', 'readonly').objectStore('games').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return games;
  });
}

function withoutUpdatedAt(game) {
  const copy = structuredClone(game);
  delete copy.updatedAt;
  return copy;
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(`${base}/#/nieuw`, { waitUntil: 'load' });
  await page.waitForSelector('.player-row');
  await page.locator('.player-row .name-input').nth(0).fill('Sanne');
  await page.locator('.player-row .name-input').nth(1).fill('Mauro');
  await page.getByRole('button', { name: 'Alleen omhoog' }).click();
  await page.locator('.option-row .step-btn--plus').click();
  await page.getByRole('button', { name: 'Spel starten' }).click();
  await page.waitForSelector('h1:text("Biedingen")');
  await page.getByRole('button', { name: 'Biedingen vastleggen' }).click();
  await page.waitForSelector('h1:text("Slagen")');
  await page.locator('.player-bid').nth(0).locator('.step-btn--plus').click();
  await page.getByRole('button', { name: 'Ronde afronden' }).click();
  await page.getByRole('link', { name: 'Scorebord' }).click();
  await page.waitForSelector('h1:text("Scorebord")');
  await page.getByRole('link', { name: 'Bekijk uitslag' }).click();
  await page.waitForSelector('h1:text("Afgelopen")');

  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForSelector('h1:text("Spellen")');
  await page.waitForFunction(() => {
    const node = document.querySelector('.app-footer__estimate');
    return node !== null && !node.textContent?.includes('onbekend');
  });
  const estimate = await page.locator('.app-footer__estimate').innerText();
  const persistence = await page.evaluate(async () => ({
    marker: localStorage.getItem('boerenbridge.storagePersisted'),
    persisted: (await navigator.storage.persisted?.()) ?? null,
  }));
  console.log('storage estimate:', estimate);
  console.log('persistence:', JSON.stringify(persistence));

  const before = await readGames(page);
  console.log(`IndexedDB games before export: ${before.length}`);
  console.log(JSON.stringify(before, null, 2));

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Alle spellen als JSON-bestand bewaren' }).click();
  const download = await downloadPromise;
  await download.saveAs(exportPath);
  const exported = await readFile(exportPath, 'utf8');
  console.log(`export file: ${exportPath} (${exported.length} bytes)`);
  console.log(exported.trim());

  await page.locator('.game-card__delete').click();
  await page.locator('.sheet__actions .btn--danger').click();
  await page.waitForSelector('h1:text("Spellen")');
  await page.waitForSelector('.empty-card');
  const cleared = await readGames(page);
  console.log(`IndexedDB games after clear: ${cleared.length}`);
  assert.equal(cleared.length, 0);

  await page.locator('.app-footer input[type="file"]').setInputFiles(exportPath);
  await page.waitForSelector('.game-card');
  const imported = await readGames(page);
  console.log(`IndexedDB games after import: ${imported.length}`);
  assert.equal(imported.length, 1);

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('h1:text("Spellen")');
  await page.waitForSelector('.game-card');
  const after = await readGames(page);
  console.log('IndexedDB games after reload:');
  console.log(JSON.stringify(after, null, 2));

  assert.deepEqual(withoutUpdatedAt(after[0]), withoutUpdatedAt(before[0]));
  console.log('ROUND_TRIP_STATE_MATCH=1 (updatedAt refreshed by the store contract)');
} finally {
  await browser.close();
  server.close();
  await rm(exportPath, { force: true });
}
