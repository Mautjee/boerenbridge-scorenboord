import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(import.meta.dirname, '..', '..');
const outDir = path.join(root, 'internal', 'assets', 'static');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const file =
    url.pathname === '/' || url.pathname === '/index.html'
      ? path.join(outDir, 'index.html')
      : url.pathname.startsWith('/static/')
        ? path.join(outDir, url.pathname.slice('/static/'.length))
        : path.join(outDir, url.pathname.replace(/^\/+/, ''));
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('niet gevonden');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [];
const check = (label, condition) => {
  assert.ok(condition, label);
  results.push(`ok - ${label}`);
};

try {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.goto(`${base}/#/nieuw`, { waitUntil: 'load' });
  await page.waitForSelector('.player-row');

  const inputs = page.locator('.player-row .name-input');
  await inputs.nth(0).fill('Sanne');
  await inputs.nth(1).fill('Mauro');
  await page.getByRole('button', { name: 'Speler toevoegen' }).click();
  await page.locator('.player-row .name-input').nth(2).fill('Joost');
  await page.getByRole('button', { name: 'Speler toevoegen' }).click();
  await page.locator('.player-row .name-input').nth(3).fill('Lotte');
  await page.getByRole('button', { name: 'Spel starten' }).click();
  await page.waitForSelector('h1:text("Biedingen")');
  check('creating a game opens Biedingen', true);

  await page.locator('.player-bid').nth(0).locator('.step-btn--plus').click();
  check('the blind rule disables submit', await page.getByRole('button', { name: 'Biedingen vastleggen' }).isDisabled());
  check(
    'the blind rule message is specific',
    (await page.locator('#blind-hint').innerText()).includes('biedingen mogen niet samen exact 1 zijn'),
  );

  await page.locator('.player-bid').nth(0).locator('.step-btn').first().click();
  check('submit is enabled after fixing the blind rule', await page.getByRole('button', { name: 'Biedingen vastleggen' }).isEnabled());
  await page.getByRole('button', { name: 'Biedingen vastleggen' }).click();
  await page.waitForSelector('h1:text("Slagen")');
  check('saving bids opens Slagen', true);

  await page.locator('.value-btn').nth(0).click();
  await page.waitForSelector('.sheet[role="dialog"]');
  await page.locator('.keypad__key', { hasText: /^1$/ }).click();
  await page.getByRole('button', { name: 'Klaar' }).click();
  check('the keypad sets the trick value', await page.getByRole('button', { name: 'Ronde afronden' }).isEnabled());
  await page.getByRole('button', { name: 'Ronde afronden' }).click();
  await page.waitForSelector('.result-banner');
  check('submitting tricks shows the score deltas', await page.locator('.delta').count() === 4);
  await page.getByRole('button', { name: 'Ongedaan maken' }).click();
  await page.waitForSelector('.total-counter');
  check('undo returns to the tricks form', true);

  const seeded = {
    schemaVersion: 2,
    id: '55555555-5555-4555-8555-555555555555',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-27T10:00:00.000Z',
    phase: 'active',
    setup: {
      players: ['Sanne', 'Mauro', 'Joost', 'Lotte'].map((name, seat) => ({ id: `seed-p${seat}`, name, seat })),
      direction: 'up_down',
      maxCards: 5,
    },
    rounds: [1, 2, 3, 4, 5, 4, 3].map((cards, index) => {
      const bids = [0, 0, 0, 0];
      const tricks = [cards, 0, 0, 0];
      return {
        round: index + 1,
        cards,
        bids,
        tricks,
        scores: bids.map((bid, seat) => (bid === tricks[seat] ? 10 + 3 * bid : -3 * Math.abs(bid - tricks[seat]))),
      };
    }),
    pending: { round: 8, cards: 2, bids: null },
    revision: 8,
  };
  await page.evaluate(async (game) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('boerenbridge', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('games')) {
          const store = db.createObjectStore('games', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('games', 'readwrite');
        tx.objectStore('games').put(game);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, seeded);
  await page.goto(`${base}/#/spel/${seeded.id}/scorebord`, { waitUntil: 'load' });
  await page.waitForSelector('.matrix');
  const roundRows = page.locator('.round-row');
  await roundRows.nth(4).locator('.round-correct').click();
  await page.waitForSelector('.sheet[role="dialog"]');
  check('correcting an older round asks for confirmation', (await page.locator('.sheet__title').innerText()) === 'Ronde 3 corrigeren?');
  await page.getByRole('button', { name: 'Corrigeren', exact: true }).click();
  await page.waitForSelector('h1:text("Ronde 3 corrigeren")');
  check('confirming opens the correction form', true);
  await page.getByRole('button', { name: 'Correctie opslaan' }).click();
  await page.waitForSelector('h1:text("Scorebord")');
  check('saving a correction returns to the scoreboard', true);

  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForSelector('.game-card');
  const before = await page.locator('.game-card').count();
  await page.locator('.game-card').first().locator('.game-card__delete').click();
  await page.waitForSelector('.sheet[role="dialog"]');
  await page.getByRole('button', { name: 'Verwijderen', exact: true }).click();
  await page.waitForTimeout(200);
  check('deleting a game asks first and then removes it', (await page.locator('.game-card').count()) === before - 1);

  console.log(results.join('\n'));
} finally {
  await browser.close();
  server.close();
}
