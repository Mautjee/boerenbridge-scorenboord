import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const shotsDir = path.join(repoRoot, 'docs/design/shots');
const evidenceDir = path.join(repoRoot, 'docs/design/evidence');

const screens = [
  { file: 'spellen.html', name: 'spellen', states: ['empty', 'progress', 'finished'], primary: 'progress', wide: 'progress' },
  { file: 'nieuw-spel.html', name: 'nieuw-spel', states: ['empty', 'progress', 'invalid'], primary: 'progress', wide: 'progress' },
  { file: 'biedingen.html', name: 'biedingen', states: ['empty', 'progress', 'blocked', 'keypad'], primary: 'progress', wide: 'progress' },
  { file: 'slagen.html', name: 'slagen', states: ['empty', 'progress', 'ready', 'blocked', 'finished'], primary: 'progress', wide: 'progress' },
  { file: 'scorebord.html', name: 'scorebord', states: ['empty', 'progress', 'finished', 'confirm'], primary: 'progress', wide: 'progress' },
  { file: 'afgelopen.html', name: 'afgelopen', states: ['finished', 'shared'], primary: 'finished', wide: 'finished' },
];

const urlFor = (file, state) => `file://${path.join(here, file)}?state=${state}`;

function measureInPage() {
  const selector = 'a, button, input, select, textarea, [role="button"]';
  const all = [...document.querySelectorAll(selector)];
  const visible = all.filter((el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const label = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;
    const txt = (el.innerText || el.value || '').trim().replace(/\s+/g, ' ');
    if (txt) return txt.slice(0, 48);
    return el.getAttribute('placeholder') || el.tagName.toLowerCase();
  };
  const group = (el) => {
    if (el.closest('.sheet')) return 'sheet';
    if (el.closest('.action-dock')) return 'dock';
    return 'flow';
  };
  const items = visible.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      label: label(el),
      group: group(el),
      x: Math.round(r.x * 10) / 10,
      y: Math.round(r.y * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      inViewport: r.top < innerHeight && r.bottom > 0,
    };
  });
  const small = items.filter((i) => i.w < 44 || i.h < 44);
  const gaps = [];
  for (let a = 0; a < items.length; a += 1) {
    for (let b = a + 1; b < items.length; b += 1) {
      const A = items[a];
      const B = items[b];
      if (A.group !== B.group) continue;
      const dx = Math.max(0, Math.max(A.x, B.x) - Math.min(A.x + A.w, B.x + B.w));
      const dy = Math.max(0, Math.max(A.y, B.y) - Math.min(A.y + A.h, B.y + B.h));
      const distance = Math.hypot(dx, dy);
      if (distance < 8) {
        gaps.push({ a: A.label, b: B.label, distance: Math.round(distance * 10) / 10 });
      }
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    items,
    small,
    gaps,
    headings: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()),
  };
}

async function main() {
  await mkdir(shotsDir, { recursive: true });
  await mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const results = [];
  for (const screen of screens) {
    for (const state of screen.states) {
      for (const width of [360, 390, 768, 1280]) {
        const height = width === 360 ? 800 : width === 390 ? 844 : width === 768 ? 1024 : 900;
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        await page.goto(urlFor(screen.file, state), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const m = await page.evaluate(measureInPage);
        results.push({ screen: screen.name, state, width, ...m });
        await context.close();
      }
      if (state === screen.primary) {
        const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 });
        const page = await context.newPage();
        await page.goto(urlFor(screen.file, state), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(shotsDir, `${screen.name}-360.png`) });
        await context.close();
      }
      if (state === screen.primary) {
        const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        await page.goto(urlFor(screen.file, state), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(shotsDir, `${screen.name}-768.png`), fullPage: true });
        await context.close();
      }
      if (state === screen.wide) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        await page.goto(urlFor(screen.file, state), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(shotsDir, `${screen.name}-1280.png`), fullPage: true });
        await context.close();
      }
      if (state !== screen.primary) {
        const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 });
        const page = await context.newPage();
        await page.goto(urlFor(screen.file, state), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(shotsDir, `${screen.name}-${state}-360.png`) });
        await context.close();
      }
    }
  }
  await browser.close();
  await writeFile(path.join(evidenceDir, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);

  const bad = results.filter((r) => r.scrollWidth > r.innerWidth || r.small.length > 0 || r.gaps.length > 0);
  console.log(`runs: ${results.length}`);
  console.log(`runs with overflow/small/gap issues: ${bad.length}`);
  for (const r of bad) {
    console.log(`\n${r.screen}/${r.state} @${r.width}: scrollWidth=${r.scrollWidth} innerWidth=${r.innerWidth}`);
    for (const s of r.small) console.log(`  small ${s.label} ${s.w}x${s.h}`);
    for (const g of r.gaps) console.log(`  gap ${g.distance}px ${g.a} / ${g.b}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
