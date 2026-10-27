import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { startStaticServer } from './_static-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(import.meta.dirname, '..', '..');
const { server, base } = await startStaticServer(path.join(root, 'internal', 'assets', 'static'));
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const requests = [];
  context.on('request', (request) => {
    requests.push({ method: request.method(), url: request.url(), type: request.resourceType() });
  });
  const page = await context.newPage();

  await page.goto(`${base}/#/nieuw`, { waitUntil: 'load' });
  await page.waitForSelector('.player-row');
  const inputs = page.locator('.player-row .name-input');
  await inputs.nth(0).fill('Sanne');
  await inputs.nth(1).fill('Mauro');
  await page.getByRole('button', { name: 'Speler toevoegen' }).click();
  await page.locator('.player-row .name-input').nth(2).fill('Joost');
  await page.getByRole('button', { name: 'Speler toevoegen' }).click();
  await page.locator('.player-row .name-input').nth(3).fill('Lotte');
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
  await page.getByRole('button', { name: 'Ronde 1 corrigeren' }).click();
  await page.waitForSelector('h1:text("Ronde 1 corrigeren")');
  await page.getByRole('button', { name: 'Correctie opslaan' }).click();
  await page.waitForSelector('h1:text("Scorebord")');
  await page.getByRole('link', { name: 'Bekijk uitslag' }).click();
  await page.waitForSelector('h1:text("Afgelopen")');
  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForSelector('h1:text("Spellen")');

  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('h1:text("Spellen")');

  const origin = new URL(base).origin;
  console.log('method resourceType url');
  for (const request of requests) {
    console.log(`${request.method} ${request.type} ${request.url}`);
  }
  const thirdParty = requests.filter((request) => new URL(request.url).origin !== origin);
  for (const request of thirdParty) {
    console.log(`THIRD_PARTY ${request.url}`);
  }
  assert.equal(thirdParty.length, 0, 'alleen same-origin requests toegestaan');
  console.log(`REQUESTS=${requests.length}`);
  console.log('THIRD_PARTY_REQUESTS=0');
} finally {
  await browser.close();
  server.close();
}
