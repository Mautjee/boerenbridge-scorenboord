import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(import.meta.dirname, '..', '..');
const outDir = path.join(root, 'internal', 'assets', 'static');
const shotDir = path.join(root, 'docs', 'shots', 'build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let file;
  if (url.pathname === '/' || url.pathname === '/index.html') {
    file = path.join(outDir, 'index.html');
  } else if (url.pathname.startsWith('/static/')) {
    file = path.join(outDir, url.pathname.slice('/static/'.length));
  } else {
    file = path.join(outDir, url.pathname.replace(/^\/+/, ''));
  }
  if (!file.startsWith(outDir)) {
    response.writeHead(403).end('verboden');
    return;
  }
  readFile(file)
    .then((body) => {
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('niet gevonden');
    });
});

function roundSequence(numPlayers, direction, maxCards) {
  const naturalMax = Math.floor(52 / numPlayers);
  const peak = maxCards > 0 && maxCards < naturalMax ? maxCards : naturalMax;
  const sequence = [];
  for (let cards = 1; cards <= peak; cards++) sequence.push(cards);
  if (direction === 'up_down') {
    for (let cards = peak - 1; cards >= 1; cards--) sequence.push(cards);
  }
  return sequence;
}

function calculateScore(bid, tricks) {
  return bid === tricks ? 10 + 3 * bid : -3 * Math.abs(bid - tricks);
}

function completedRound(round, cards, players) {
  const bids = cards >= 2 && round % 3 === 2 ? [0, 1, 0, 0] : [0, 0, 0, 0];
  const tricks = cards >= 2 && round % 3 === 2 ? [cards - 1, 1, 0, 0] : [cards, 0, 0, 0];
  const scores = bids.map((bid, seat) => calculateScore(bid, tricks[seat]));
  return { round, cards, bids: bids.slice(0, players), tricks: tricks.slice(0, players), scores: scores.slice(0, players) };
}

function makeGame({ id, names, direction = 'up_down', maxCards = 0, roundsPlayed, pendingBids = null, finished = false, createdAt, updatedAt }) {
  const sequence = roundSequence(names.length, direction, maxCards);
  const count = finished ? sequence.length : roundsPlayed;
  const rounds = [];
  for (let index = 0; index < count; index++) {
    rounds.push(completedRound(index + 1, sequence[index], names.length));
  }
  const pending = finished
    ? null
    : { round: count + 1, cards: sequence[count], bids: pendingBids };
  return {
    schemaVersion: 2,
    id,
    createdAt,
    updatedAt,
    phase: finished ? 'finished' : 'active',
    setup: {
      players: names.map((name, seat) => ({ id: `${id}-p${seat + 1}`, name, seat })),
      direction,
      maxCards,
    },
    rounds,
    pending,
    revision: rounds.length + 1,
  };
}

const now = new Date();
const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();
const daysAgo = (days) => new Date(now.getTime() - days * 86_400_000).toISOString();
const names = ['Sanne', 'Mauro', 'Joost', 'Lotte'];

const fixtures = [
  makeGame({
    id: '11111111-1111-4111-8111-111111111111',
    names,
    maxCards: 5,
    roundsPlayed: 4,
    createdAt: daysAgo(1),
    updatedAt: minutesAgo(30),
  }),
  makeGame({
    id: '22222222-2222-4222-8222-222222222222',
    names,
    maxCards: 5,
    roundsPlayed: 4,
    pendingBids: [2, 1, 1, 0],
    createdAt: daysAgo(2),
    updatedAt: minutesAgo(60),
  }),
  makeGame({
    id: '33333333-3333-4333-8333-333333333333',
    names: ['Bram', 'Noor', 'Daan', 'Fien'],
    maxCards: 5,
    roundsPlayed: 9,
    finished: true,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(12),
  }),
  makeGame({
    id: '44444444-4444-4444-8444-444444444444',
    names: ['Bram', 'Noor', 'Daan', 'Fien'],
    maxCards: 5,
    roundsPlayed: 9,
    finished: true,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(28),
  }),
];

const screens = [
  { name: 'spellen', hash: '#/', wait: '.game-card' },
  { name: 'nieuw-spel', hash: '#/nieuw', wait: '.player-row' },
  { name: 'biedingen', hash: '#/spel/11111111-1111-4111-8111-111111111111', wait: '.player-bid' },
  { name: 'slagen', hash: '#/spel/22222222-2222-4222-8222-222222222222', wait: '.total-counter' },
  { name: 'scorebord', hash: '#/spel/11111111-1111-4111-8111-111111111111/scorebord', wait: '.matrix' },
  { name: 'afgelopen', hash: '#/spel/33333333-3333-4333-8333-333333333333', wait: '.winner-card' },
];

const widths = [
  { width: 360, height: 800, dpr: 2, shot: true },
  { width: 390, height: 844, dpr: 2, shot: false },
  { width: 768, height: 1024, dpr: 1, shot: false },
  { width: 1280, height: 900, dpr: 1, shot: true },
];

const cssSource = await readFile(path.join(root, 'web', 'src', 'styles', 'app.css'), 'utf8');

function measureInPage() {
  const doc = document.documentElement;
  const candidates = Array.from(
    document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  );
  const elements = candidates
    .map((node, index) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none') {
        return null;
      }
      const label =
        node.getAttribute('aria-label') ??
        node.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ??
        node.getAttribute('placeholder') ??
        '';
      return {
        index,
        tag: node.tagName.toLowerCase(),
        label,
        parent: node.parentElement?.className ?? '',
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        disabled: node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true',
        inViewport: rect.top < window.innerHeight && rect.bottom > 0,
      };
    })
    .filter((entry) => entry !== null);

  let minGap = Infinity;
  for (let first = 0; first < elements.length; first++) {
    for (let second = first + 1; second < elements.length; second++) {
      const a = elements[first];
      const b = elements[second];
      const horizontal = Math.max(a.left, b.left) - Math.min(a.right, b.right);
      const vertical = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
      if (horizontal < 0 && vertical < 0) continue;
      const gap = Math.max(horizontal, vertical);
      if (gap >= 0 && gap < minGap) minGap = gap;
    }
  }

  return {
    scrollWidth: doc.scrollWidth,
    innerWidth: window.innerWidth,
    overflow: doc.scrollWidth > window.innerWidth,
    h1: Array.from(document.querySelectorAll('h1')).map((node) => node.textContent?.trim() ?? ''),
    liveRegions: document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length,
    minWidth: Math.min(...elements.map((entry) => entry.width)),
    minHeight: Math.min(...elements.map((entry) => entry.height)),
    minGap: Number.isFinite(minGap) ? minGap : null,
    elements,
  };
}

await mkdir(shotDir, { recursive: true });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
const runs = [];

try {
  for (const viewport of widths) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.evaluate(async (games) => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('boerenbridge', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('games')) {
            const store = db.createObjectStore('games', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt');
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('games', 'readwrite');
          for (const game of games) {
            transaction.objectStore('games').put(game);
          }
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    }, fixtures);

    for (const screen of screens) {
      await page.goto(`${base}/${screen.hash}`, { waitUntil: 'load' });
      await page.waitForSelector(screen.wait, { state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(350);
      const metrics = await page.evaluate(measureInPage);
      runs.push({
        screen: screen.name,
        width: viewport.width,
        height: viewport.height,
        ...metrics,
      });
      if (viewport.shot) {
        const target = path.join(shotDir, `${screen.name}-${viewport.width}.png`);
        await page.screenshot({ path: target, fullPage: viewport.width >= 768 });
      }
    }
    await context.close();
  }

  const focusRingPresent = /:focus-visible[\s\S]*?outline:\s*3px solid/.test(cssSource);
  const report = {
    generatedAt: new Date().toISOString(),
    base,
    browser: await browser.version(),
    focusRingPresent,
    runs,
  };
  await writeFile(path.join(shotDir, 'measurements.json'), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '| screen | width | scrollWidth | innerWidth | overflow | h1 | min target | min gap | interactive |',
    '|---|---:|---:|---:|---|---|---|---:|---:|',
  ];
  for (const run of runs) {
    lines.push(
      `| ${run.screen} | ${run.width} | ${run.scrollWidth} | ${run.innerWidth} | ${run.overflow ? 'YES' : 'no'} | ${run.h1.join(' / ')} | ${run.minWidth}×${run.minHeight} | ${run.minGap ?? '-'} | ${run.elements.length} |`,
    );
  }
  console.log(lines.join('\n'));
  console.log(`\nfocus-visible ring present: ${focusRingPresent}`);
  console.log(`measurements: ${path.join(shotDir, 'measurements.json')}`);
} finally {
  await browser.close();
  server.close();
}
