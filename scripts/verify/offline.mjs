import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { startStaticServer } from './_static-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(import.meta.dirname, '..', '..');
const shots = path.join(root, '.tmp');
await mkdir(shots, { recursive: true });

const { server, base } = await startStaticServer(path.join(root, 'internal', 'assets', 'static'));
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('h1:text("Spellen")');
  console.log('OFFLINE_SHELL=1');
  await page.screenshot({ path: path.join(shots, 'offline-start.png') });

  await page.goto(`${base}/#/nieuw`, { waitUntil: 'load' });
  await page.waitForSelector('.player-row');
  await page.locator('.player-row .name-input').nth(0).fill('Sanne');
  await page.locator('.player-row .name-input').nth(1).fill('Mauro');
  await page.getByRole('button', { name: 'Alleen omhoog' }).click();
  await page.locator('.option-row .step-btn--plus').click();
  await page.getByRole('button', { name: 'Spel starten' }).click();
  await page.waitForSelector('h1:text("Biedingen")');
  await page.screenshot({ path: path.join(shots, 'offline-mid.png') });

  await page.getByRole('button', { name: 'Biedingen vastleggen' }).click();
  await page.waitForSelector('h1:text("Slagen")');
  await page.locator('.player-bid').nth(0).locator('.step-btn--plus').click();
  await page.getByRole('button', { name: 'Ronde afronden' }).click();
  await page.getByRole('link', { name: 'Scorebord' }).click();
  await page.waitForSelector('h1:text("Scorebord")');
  await page.getByRole('link', { name: 'Bekijk uitslag' }).click();
  await page.waitForSelector('h1:text("Afgelopen")');
  await page.screenshot({ path: path.join(shots, 'offline-gameover.png') });
  console.log('OFFLINE_FULL_GAME=1');

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('h1:text("Afgelopen")');
  assert.match(await page.locator('h1').innerText(), /Afgelopen/);
  console.log('OFFLINE_RESULT_PERSISTED=1');

  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForSelector('.game-card');
  const card = await page.locator('.game-card').innerText();
  console.log('Spellen card:', card.replace(/\s+/g, ' ').trim());
  assert.match(card, /Afgelopen/);
  console.log('OFFLINE_LIST_PERSISTED=1');
} finally {
  await browser.close();
  server.close();
}
