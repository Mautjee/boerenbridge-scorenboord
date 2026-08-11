// Boerenbridge offline engine — DuckDB-WASM + game logic
let db = null;
let conn = null;

// ── Game logic (mirrors Go internal/game/game.go) ──

function roundSequence(numPlayers, direction, maxCards) {
  const naturalMax = Math.floor(52 / numPlayers);
  let peak = naturalMax;
  if (maxCards > 0 && maxCards < peak) peak = maxCards;

  const seq = [];
  if (direction === 'up_only') {
    for (let i = 1; i <= peak; i++) seq.push(i);
  } else {
    for (let i = 1; i <= peak; i++) seq.push(i);
    for (let i = peak - 1; i >= 1; i--) seq.push(i);
  }
  return seq;
}

function totalRounds(numPlayers, direction, maxCards) {
  return roundSequence(numPlayers, direction, maxCards).length;
}

function cardsForRound(roundNum, numPlayers, direction, maxCards) {
  const seq = roundSequence(numPlayers, direction, maxCards);
  if (roundNum < 1 || roundNum > seq.length) return 0;
  return seq[roundNum - 1];
}

function calculateScore(bid, tricksWon) {
  if (bid === tricksWon) return 10 + 3 * bid;
  return -3 * Math.abs(bid - tricksWon);
}

function validateBids(bids, cards) {
  const total = bids.reduce((a, b) => a + b, 0);
  if (total === cards) return 'De biedingen mogen samen niet optellen tot ' + cards + ' (blinde regel)';
  return null;
}

function validateTricks(tricks, cards) {
  const total = tricks.reduce((a, b) => a + b, 0);
  if (total !== cards) return 'Het totaal aantal gewonnen slagen (' + total + ') moet gelijk zijn aan het aantal kaarten per speler (' + cards + ')';
  return null;
}

// ── DuckDB init ──
let initTimer = null;

function assert(condition, msg) {
  if (!condition) {
    const err = new Error('ASSERT: ' + msg);
    console.error('[offline]', err.message);
    throw err;
  }
}

function assertEl(id, msg) {
  const el = document.getElementById(id);
  assert(el, msg || 'Element #' + id + ' niet gevonden in DOM');
  return el;
}

function logStep(msg) {
  const el = document.getElementById('loading-step');
  if (el) el.textContent = msg;
  console.log('[offline]', msg);
}

function showError(html) {
  const loading = assertEl('loading', 'loading div niet gevonden');
  loading.innerHTML = html;
}

async function initDB() {
  logStep('Stap 0/6: Asserties controleren...');
  assertEl('loading');
  assertEl('loading-step');
  assertEl('loading-progress');
  assertEl('loading-bar');
  assertEl('loading-pct');
  assertEl('game-list-page');
  assertEl('game-page');
  assertEl('new-game-page');
  assert(typeof fetch === 'function', 'fetch API niet beschikbaar');
  assert(typeof Worker !== 'undefined', 'Web Workers niet beschikbaar');
  assert(typeof WebAssembly !== 'undefined', 'WebAssembly niet beschikbaar');
  console.log('[offline] alle DOM asserts OK');

  logStep('Stap 1/6: DuckDB module importeren...');
  const importMap = document.querySelector('script[type="importmap"]');
  assert(importMap, 'importmap script tag niet gevonden! apache-arrow kan niet resolved worden.');
  console.log('[offline] importmap:', importMap.textContent.replace(/\s+/g, ' ').slice(0, 120));

  let duckdb;
  try {
    duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser.mjs');
  } catch (e) {
    console.error('[offline] import failed:', e);
    throw new Error('Import mislukt: ' + e.message);
  }
  assert(duckdb, 'duckdb module is null na import');
  assert(typeof duckdb === 'object', 'duckdb is geen object: ' + typeof duckdb);
  assert(typeof duckdb.AsyncDuckDB === 'function', 'AsyncDuckDB ontbreekt in duckdb module');
  assert(typeof duckdb.selectBundle === 'function', 'selectBundle ontbreekt in duckdb module');
  assert(typeof duckdb.getJsDelivrBundles === 'function', 'getJsDelivrBundles ontbreekt in duckdb module');
  assert(typeof duckdb.ConsoleLogger === 'function', 'ConsoleLogger ontbreekt in duckdb module');
  assert(typeof duckdb.getPlatformFeatures === 'function', 'getPlatformFeatures ontbreekt in duckdb module');
  const exports = Object.keys(duckdb);
  console.log('[offline] duckdb exports (' + exports.length + '):', exports.slice(0, 10));

  logStep('Stap 2/6: Platform features + bundle kiezen...');
  let features;
  try {
    features = await duckdb.getPlatformFeatures();
    assert(features, 'getPlatformFeatures returned null/undefined');
    assert(typeof features === 'object', 'features is geen object');
  } catch(e) {
    console.error('[offline] features check failed:', e);
    throw new Error('Platform feature check mislukt: ' + e.message);
  }
  console.log('[offline] platform:', JSON.stringify(features));

  const bundles = duckdb.getJsDelivrBundles();
  assert(bundles, 'getJsDelivrBundles returned null');
  assert(bundles.mvp, 'mvp bundle ontbreekt');
  assert(bundles.eh, 'eh bundle ontbreekt');
  assert(bundles.mvp.mainModule, 'mvp.mainModule ontbreekt');
  assert(bundles.mvp.mainWorker, 'mvp.mainWorker ontbreekt');
  console.log('[offline] bundles beschikbaar:', Object.keys(bundles));

  let bundle;
  try {
    bundle = await duckdb.selectBundle(bundles);
  } catch (e) {
    console.error('[offline] selectBundle failed:', e);
    throw new Error('Bundle selectie mislukt: ' + e.message);
  }
  assert(bundle, 'selectBundle returned null/undefined');
  assert(bundle.mainModule, 'bundle.mainModule is leeg');
  assert(typeof bundle.mainModule === 'string', 'bundle.mainModule is geen string');
  assert(bundle.mainWorker, 'bundle.mainWorker is leeg');
  assert(typeof bundle.mainWorker === 'string', 'bundle.mainWorker is geen string');
  console.log('[offline] gekozen bundle:', JSON.stringify({
    module: bundle.mainModule.slice(-30),
    worker: bundle.mainWorker.slice(-40),
    pthread: bundle.pthreadWorker ? bundle.pthreadWorker.slice(-40) : 'none',
  }));

  logStep('Stap 3/6: Web Worker laden als blob...');
  let worker;
  try {
    // Fetch worker script as blob — avoids cross-origin worker restrictions on mobile
    const workerResp = await fetch(bundle.mainWorker);
    assert(workerResp.ok, 'Worker script download failed: HTTP ' + workerResp.status);
    const workerBlob = await workerResp.blob();
    assert(workerBlob.size > 0, 'Worker blob is empty (size=0)');
    const workerUrl = URL.createObjectURL(workerBlob);
    console.log('[offline] worker blob:', workerBlob.size, 'bytes, type:', workerBlob.type);
    worker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl); // clean up blob URL after worker starts
  } catch (e) {
    console.error('[offline] Worker creation failed:', e);
    throw new Error('Worker aanmaken mislukt: ' + e.message);
  }
  assert(worker, 'worker is null na constructie');
  assert(worker instanceof Worker, 'worker is geen Worker instance');
  worker.onerror = (e) => {
    // Dump everything — mobile browsers often leave properties undefined
    console.error('[offline] worker error event:', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      error: e.error ? (e.error.message || String(e.error)) : 'no error object',
      type: e.type,
      keys: Object.keys(e),
    });
    showError(`
      <div class="text-red-600 text-lg font-bold mb-2">⚠️ Worker fout</div>
      <p class="text-gray-600 mb-1">${e.message || '(geen bericht — zie console)'}</p>
      <p class="text-xs text-gray-400 mb-1">${e.filename || '?'}:${e.lineno || '?'}</p>
      <p class="text-xs text-gray-500 font-mono break-all">${e.error ? (e.error.message || String(e.error)) : ''}</p>
      <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition">🔄 Opnieuw proberen</button>`);
  };
  worker.onmessageerror = (e) => {
    console.error('[offline] worker messageerror:', e);
  };
  console.log('[offline] worker OK (blob loaded)');

  logStep('Stap 4/6: WASM bereikbaarheid checken...');
  const progressEl = assertEl('loading-progress');
  progressEl.classList.remove('hidden');

  console.log('[offline] WASM URL:', bundle.mainModule);
  let wasmHead;
  try {
    wasmHead = await fetch(bundle.mainModule, { method: 'HEAD' });
  } catch (e) {
    console.error('[offline] WASM HEAD failed:', e);
    throw new Error('Kan WASM bestand niet bereiken (HEAD): ' + e.message);
  }
  assert(wasmHead.ok, 'WASM HEAD returned status ' + wasmHead.status);
  const contentLength = wasmHead.headers.get('content-length');
  console.log('[offline] WASM status:', wasmHead.status, 'size:', contentLength || 'onbekend');

  logStep('Stap 4/6: DuckDB instantieren (' + (contentLength ? (Math.round(Number(contentLength)/1048576) + 'MB') : 'onbekend') + ' WASM downloaden)...');
  const logger = new duckdb.ConsoleLogger();
  assert(logger, 'ConsoleLogger is null');
  db = new duckdb.AsyncDuckDB(logger, worker);
  assert(db, 'AsyncDuckDB is null na constructie');
  assert(typeof db.instantiate === 'function', 'db.instantiate is geen function');

  let progressReceived = false;
  let instantiateOk = false;
  try {
    initTimer = Date.now();
    await Promise.race([
      db.instantiate(bundle.mainModule, null, (p) => {
        progressReceived = true;
        const loaded = p?.bytesLoaded ?? p?.loaded ?? p?.current;
        const total = p?.bytesTotal ?? p?.total ?? p?.max;
        if (loaded != null && total != null && total > 0) {
          const pct = Math.round((loaded / total) * 100);
          assertEl('loading-bar').style.width = pct + '%';
          assertEl('loading-pct').textContent = pct + '%';
        }
        console.log('[offline] progress:', JSON.stringify(p));
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na 120s — WASM duurt te lang. Controleer je internetverbinding.')), 120000)),
    ]);
    instantiateOk = true;
    const elapsed = Math.round((Date.now() - initTimer) / 1000);
    console.log('[offline] instantiate OK in', elapsed, 's, progress received:', progressReceived);
  } catch (e) {
    const elapsed = Math.round((Date.now() - initTimer) / 1000);
    progressEl.classList.add('hidden');
    console.error('[offline] instantiate FAILED after', elapsed, 's, progress:', progressReceived, 'error:', e.message);
    throw new Error('Instantiatie mislukt (' + elapsed + 's): ' + e.message);
  }
  progressEl.classList.add('hidden');
  assert(instantiateOk, 'instantiate voltooid maar flag niet gezet');
  assert(db, 'db is null na instantiate');

  logStep('Stap 5/6: Verbinding maken...');
  try {
    conn = await db.connect();
  } catch (e) {
    console.error('[offline] connect failed:', e);
    throw new Error('Connectie mislukt: ' + e.message);
  }
  assert(conn, 'conn is null na connect');
  assert(typeof conn.query === 'function', 'conn.query is geen function');
  console.log('[offline] connectie OK');

  logStep('Stap 6/6: Tabellen opnieuw aanmaken...');
  try {
    // Drop old tables (no data yet — safe)
    await conn.query('DROP TABLE IF EXISTS round_results');
    await conn.query('DROP TABLE IF EXISTS players');
    await conn.query('DROP TABLE IF EXISTS games');

    await conn.query(`CREATE TABLE games (
      id INTEGER PRIMARY KEY,
      current_round INTEGER NOT NULL DEFAULT 1,
      phase TEXT NOT NULL DEFAULT 'bidding',
      direction TEXT NOT NULL DEFAULT 'up_down',
      max_cards INTEGER NOT NULL DEFAULT 0,
      created_at TEXT
    )`);
    console.log('[offline] games table OK');

    await conn.query(`CREATE TABLE players (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL
    )`);
    console.log('[offline] players table OK');

    await conn.query(`CREATE TABLE round_results (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      bid INTEGER,
      tricks_won INTEGER,
      score INTEGER
    )`);
    console.log('[offline] round_results table OK');
  } catch (e) {
    throw new Error('Tabellen aanmaken mislukt: ' + e.message);
  }

  // Verify
  const gameCount = (await conn.query('SELECT COUNT(*) as c FROM games')).toArray();
  console.log('[offline] tabellen OK, games:', gameCount[0]?.c ?? '?');

  return true;
}

// ── DB helpers ──

async function createGame(playerNames, direction, maxCards) {
  assert(Array.isArray(playerNames), 'playerNames moet array zijn');
  assert(playerNames.length >= 2, 'minimaal 2 spelers nodig, kreeg: ' + playerNames.length);
  assert(playerNames.length <= 8, 'maximaal 8 spelers, kreeg: ' + playerNames.length);
  assert(direction === 'up_down' || direction === 'up_only', 'ongeldige richting: ' + direction);
  assert(typeof maxCards === 'number' && maxCards >= 0, 'ongeldige maxCards: ' + maxCards);
  assert(conn, 'conn is niet beschikbaar voor createGame');

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  // DuckDB INTEGER PRIMARY KEY doesn't auto-increment — generate ID manually
  const maxId = (await conn.query(`SELECT COALESCE(MAX(id), 0) as mx FROM games`)).toArray();
  const nextId = Number(maxId[0].mx) + 1;
  await conn.query(
    `INSERT INTO games (id, direction, max_cards, created_at) VALUES (${nextId}, '${direction}', ${maxCards}, '${now}')`
  );
  const gameId = nextId;
  assert(gameId > 0, 'gameId is ongeldig: ' + gameId);

  for (let i = 0; i < playerNames.length; i++) {
    const name = playerNames[i];
    assert(name && name.trim(), 'speler naam ' + i + ' is leeg');
    const sanitized = name.replace(/'/g, "''");
    const maxPId = (await conn.query(`SELECT COALESCE(MAX(id), 0) as mx FROM players`)).toArray();
    const nextPId = Number(maxPId[0].mx) + 1;
    console.log('[offline] inserting player', i, 'id:', nextPId, 'name:', sanitized);
    try {
      await conn.query(
        `INSERT INTO players (id, game_id, name, position) VALUES (${nextPId}, ${gameId}, '${sanitized}', ${i})`
      );
    } catch(e) {
      throw new Error('Speler ' + i + ' (' + sanitized + ') invoegen mislukt: ' + e.message);
    }
  }

  // Verify game was fully created
  const verify = await getGame(gameId);
  assert(verify !== null, 'game niet teruggevonden na creatie (id=' + gameId + ')');
  if (verify.players.length !== playerNames.length) {
    // Dump players table for debugging
    const allPlayers = (await conn.query('SELECT * FROM players')).toArray();
    console.error('[offline] ALL players in DB:', JSON.stringify(allPlayers));
    throw new Error('spelers-aantal mismatch: ' + verify.players.length + ' in DB vs ' + playerNames.length + ' verwacht (gameId=' + gameId + ')');
  }
  console.log('[offline] game ' + gameId + ' aangemaakt met ' + playerNames.length + ' spelers');
  return gameId;
}

async function getGame(gameId) {
  assert(typeof gameId === 'number' && gameId > 0, 'ongeldige gameId: ' + gameId);
  assert(conn, 'conn niet beschikbaar');
  const rows = (await conn.query(`SELECT * FROM games WHERE id = ${gameId}`)).toArray();
  if (!rows.length) return null;
  const g = rows[0];
  assert(g.id === gameId, 'game id mismatch: ' + g.id + ' vs ' + gameId);
  const players = (await conn.query(`SELECT * FROM players WHERE game_id = ${gameId} ORDER BY position`)).toArray();
  g.numPlayers = players.length;
  console.log('[offline] getGame', gameId, 'players:', g.numPlayers, 'phase:', g.phase);
  return { game: g, players };
}

async function updateGamePhase(gameId, round, phase) {
  assert(typeof gameId === 'number' && gameId > 0, 'ongeldige gameId');
  assert(typeof round === 'number' && round > 0, 'ongeldige ronde: ' + round);
  assert(['bidding', 'playing', 'round_summary', 'game_over'].includes(phase), 'ongeldige fase: ' + phase);
  await conn.query(`UPDATE games SET current_round = ${round}, phase = '${phase}' WHERE id = ${gameId}`);
  console.log('[offline] game ' + gameId + ' fase: ' + phase + ' ronde: ' + round);
}

async function saveBids(gameId, round, bids) {
  assert(typeof gameId === 'number', 'ongeldige gameId');
  assert(typeof round === 'number', 'ongeldige ronde');
  assert(typeof bids === 'object' && Object.keys(bids).length >= 2, 'bids moet object met >=2 entries zijn');
  for (const [playerId, bid] of Object.entries(bids)) {
    assert(typeof bid === 'number' && bid >= 0, 'ongeldig bod voor speler ' + playerId + ': ' + bid);
    const maxRId = (await conn.query(`SELECT COALESCE(MAX(id), 0) as mx FROM round_results`)).toArray();
    const nextRId = Number(maxRId[0].mx) + 1;
    await conn.query(
      `INSERT INTO round_results (id, game_id, round_number, player_id, bid) VALUES (${nextRId}, ${gameId}, ${round}, ${playerId}, ${bid})`
    );
  }
  console.log('[offline] bids opgeslagen voor game ' + gameId + ' ronde ' + round);
}

async function saveTricksAndScores(gameId, round, tricks) {
  assert(typeof gameId === 'number', 'ongeldige gameId');
  assert(typeof round === 'number', 'ongeldige ronde');
  assert(typeof tricks === 'object', 'tricks moet object zijn');
  for (const [playerId, trick] of Object.entries(tricks)) {
    assert(typeof trick === 'number' && trick >= 0, 'ongeldige tricks voor speler ' + playerId);
    const rows = (await conn.query(
      `SELECT bid FROM round_results WHERE game_id = ${gameId} AND round_number = ${round} AND player_id = ${playerId}`
    )).toArray();
    assert(rows.length > 0, 'geen bid gevonden voor speler ' + playerId + ' ronde ' + round);
    const bid = rows[0].bid;
    assert(typeof bid === 'number', 'bid is geen nummer voor speler ' + playerId);
    const score = calculateScore(bid, trick);
    assert(typeof score === 'number', 'score is NaN voor speler ' + playerId);
    await conn.query(
      `UPDATE round_results SET tricks_won = ${trick}, score = ${score} WHERE game_id = ${gameId} AND round_number = ${round} AND player_id = ${playerId}`
    );
  }
  console.log('[offline] tricks opgeslagen voor game ' + gameId + ' ronde ' + round);
}

async function getAllResults(gameId) {
  assert(typeof gameId === 'number', 'ongeldige gameId');
  const rows = (await conn.query(
    `SELECT rr.round_number, rr.player_id, p.name as player_name, rr.bid, rr.tricks_won, rr.score
     FROM round_results rr JOIN players p ON rr.player_id = p.id
     WHERE rr.game_id = ${gameId} ORDER BY rr.round_number, p.position`
  )).toArray();
  return rows;
}

// ── Scoreboard data ──

async function buildScoreboard(gameId, g, players) {
  const results = await getAllResults(gameId);

  const completedRounds = new Set();
  for (const r of results) {
    if (r.score !== null) completedRounds.add(r.round_number);
  }

  const roundNums = [];
  for (let rn = 1; rn <= g.current_round; rn++) {
    if (completedRounds.has(rn)) roundNums.push(rn);
  }

  const rounds = roundNums.map(rn => ({
    number: rn,
    cardsPerPlayer: cardsForRound(rn, g.numPlayers, g.direction, g.max_cards),
  }));

  const playerMap = {};
  const rows = players.map((p, i) => {
    playerMap[p.id] = i;
    return {
      playerId: p.id,
      playerName: p.name,
      roundScores: new Array(roundNums.length).fill(0),
      total: 0,
    };
  });

  for (const r of results) {
    if (r.score !== null) {
      const idx = playerMap[r.player_id];
      const colIdx = roundNums.indexOf(r.round_number);
      if (idx !== undefined && colIdx >= 0) {
        rows[idx].roundScores[colIdx] = r.score;
        rows[idx].total += r.score;
      }
    }
  }

  // Cumulative scores
  for (const row of rows) {
    row.cumulativeScores = [];
    let cum = 0;
    for (const s of row.roundScores) {
      cum += s;
      row.cumulativeScores.push(cum);
    }
  }

  rows.sort((a, b) => b.total - a.total);
  return { rounds, rows };
}

// ── UI rendering ──

const COLORS = ['#047857', '#b91c1c', '#1d4ed8', '#7c3aed', '#b45309', '#0e7490', '#a21caf', '#4d7c0f'];
const DASH = [[], [6, 3], [2, 2], [10, 4, 2, 4]];
let chart = null;
let currentGameId = null;

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

function render(el, html) {
  el.innerHTML = html;
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ── Page: Game list ──

async function renderGameList() {
  assert(conn, 'conn niet beschikbaar voor renderGameList');
  const container = document.getElementById('game-list-content');
  assert(container, 'game-list-content element niet gevonden');
  const games = (await conn.query(`SELECT * FROM games ORDER BY id DESC`)).toArray();
  console.log('[offline] game list: ' + games.length + ' spellen');
  const playerCounts = {};

  for (const g of games) {
    const p = (await conn.query(`SELECT COUNT(*) as cnt FROM players WHERE game_id = ${g.id}`)).toArray();
    playerCounts[g.id] = p[0].cnt;
  }

  if (!games.length) {
    render(container, '<p class="text-gray-500 italic">Nog geen spellen gespeeld. Start een nieuw spel!</p>');
    return;
  }

  let html = '<div class="space-y-2">';
  for (const g of games) {
    const rounds = totalRounds(playerCounts[g.id], g.direction, g.max_cards);
    const phaseText = {
      'bidding': 'Biedingen',
      'playing': 'Slagen',
      'round_summary': 'Ronde overzicht',
      'game_over': 'Afgelopen 🏆',
    }[g.phase] || g.phase;

    html += `
      <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 cursor-pointer transition"
           onclick="loadGame(${g.id})">
        <div>
          <span class="font-medium text-gray-800">Spel #${g.id}</span>
          <span class="text-sm text-gray-500 ml-2">${playerCounts[g.id]} spelers · ${g.direction === 'up_only' ? 'Alleen omhoog' : 'Piramide'}
            · max ${g.max_cards || Math.floor(52 / playerCounts[g.id])} kaarten</span>
        </div>
        <div class="text-right">
          <span class="text-sm font-medium ${g.phase === 'game_over' ? 'text-emerald-700' : 'text-amber-600'}">${phaseText}</span>
          <div class="text-xs text-gray-400">Ronde ${g.current_round} / ${rounds}</div>
        </div>
      </div>`;
  }
  html += '</div>';
  render(container, html);
}

// ── Page: New game ──

function renderNewGame() {
  showPage('new-game-page');
}

function addPlayerRow() {
  const container = document.getElementById('offline-player-inputs');
  const count = container.querySelectorAll('.player-row').length;
  if (count >= 8) { alert('Maximaal 8 spelers.'); return; }
  const div = el('div', { className: 'flex items-center gap-3 player-row' },
    el('span', { className: 'w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm' }, String(count + 1)),
    el('input', { type: 'text', required: true, className: 'flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none', placeholder: 'Naam speler ' + (count + 1) }),
    el('button', { type: 'button', className: 'px-2 py-1 text-red-500 hover:text-red-700 text-xl', onclick() { div.remove(); refreshOfflineSettings(); } }, '×'),
  );
  container.appendChild(div);
  refreshOfflineSettings();
}

function refreshOfflineSettings() {
  const count = document.querySelectorAll('#offline-player-inputs .player-row').length;
  if (count < 2) return;
  const dir = document.querySelector('input[name="offline_direction"]:checked').value;
  const naturalMax = Math.floor(52 / count);
  const rounds = dir === 'up_only' ? naturalMax : 2 * naturalMax - 1;
  document.getElementById('offline_max_cards').max = naturalMax;
  if (!document.getElementById('offline_max_cards').dataset.userEdited) {
    document.getElementById('offline_max_cards').value = naturalMax;
  }
  document.getElementById('offline-rounds-hint').textContent = '→ ' + rounds + ' rondes';
}

async function startOfflineGame() {
  try {
    const names = [];
    document.querySelectorAll('#offline-player-inputs input[type="text"]').forEach(i => names.push(i.value.trim()));
    if (names.length < 2) { alert('Minimaal 2 spelers vereist.'); return; }
    const direction = document.querySelector('input[name="offline_direction"]:checked').value;
    let maxCards = parseInt(document.getElementById('offline_max_cards').value) || 0;
    if (maxCards === 0) maxCards = Math.floor(52 / names.length);

    const gameId = await createGame(names, direction, maxCards);
    await loadGame(gameId);
  } catch(e) {
    console.error('[offline] startOfflineGame error:', e);
    alert('Fout bij starten spel: ' + e.message);
  }
}

// ── Page: Game ──

async function loadGame(gameId) {
  assert(typeof gameId === 'number' && gameId > 0, 'ongeldige gameId in loadGame: ' + gameId);
  currentGameId = gameId;
  showPage('game-page');
  await renderGameView();
}

async function renderGameView() {
  assert(currentGameId > 0, 'currentGameId niet gezet');
  const data = await getGame(currentGameId);
  assert(data !== null, 'game ' + currentGameId + ' niet gevonden');
  const { game: g, players } = data;

  const tRounds = totalRounds(g.numPlayers, g.direction, g.max_cards);
  assert(tRounds > 0, 'tRounds is 0 voor game ' + currentGameId);
  const cards = cardsForRound(g.current_round, g.numPlayers, g.direction, g.max_cards);
  assert(cards > 0, 'cards is 0 voor ronde ' + g.current_round);
  const roundsLeft = g.phase !== 'game_over' ? tRounds - g.current_round + 1 : 0;

  // Header
  let html = `
    <div class="bg-white rounded-xl shadow-lg p-6 mb-4">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-2xl font-bold text-emerald-800">Spel #${g.id}</h1>
        <button onclick="showPage('game-list-page');renderGameList()" class="text-sm text-gray-500 hover:text-gray-700">← Terug</button>
      </div>
      <p class="text-gray-600">
        ${g.direction === 'up_only' ? 'Alleen omhoog' : 'Piramide'} · ${g.numPlayers} spelers · max ${g.max_cards || Math.floor(52 / g.numPlayers)} kaarten · ${tRounds} rondes
        ${g.phase !== 'game_over' ? ` · <strong>${roundsLeft}</strong> nog te spelen` : ''}
      </p>
    </div>
  `;

  // Scoreboard
  const sb = await buildScoreboard(currentGameId, g, players);
  html += renderScoreboardHTML(sb);

  // Game phase content
  if (g.phase === 'bidding') {
    html += renderBiddingPhase(g, players, cards);
  } else if (g.phase === 'playing') {
    const bids = await getCurrentBids(g);
    html += renderPlayingPhase(g, players, cards, bids);
  } else if (g.phase === 'round_summary') {
    const results = (await conn.query(
      `SELECT rr.*, p.name FROM round_results rr JOIN players p ON rr.player_id = p.id
       WHERE rr.game_id = ${currentGameId} AND rr.round_number = ${g.current_round} ORDER BY p.position`
    )).toArray();
    html += renderSummaryPhase(g, players, cards, results, tRounds);
  } else if (g.phase === 'game_over') {
    html += renderGameOver(sb);
  }

  render(document.getElementById('game-content'), html);

  // Restore graph preference
  const savedView = localStorage.getItem('boerenbridge_scoreboard_view');
  if (savedView === 'graph' && sb.rounds.length) {
    document.getElementById('scoreboard-table').classList.add('hidden');
    document.getElementById('scoreboard-graph').classList.remove('hidden');
    document.getElementById('scoreboard-toggle').textContent = '📋 Tabel';
    drawOfflineChart(sb);
  }
}

function renderScoreboardHTML(sb) {
  if (!sb.rounds.length) {
    return `<div id="scoreboard" class="bg-white rounded-xl shadow-lg p-6 mb-4">
      <h2 class="text-xl font-bold text-emerald-800 mb-4">Scorebord</h2>
      <p class="text-gray-500 italic">Nog geen rondes gespeeld.</p></div>`;
  }

  let html = `<div id="scoreboard" class="bg-white rounded-xl shadow-lg p-6 mb-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-emerald-800">Scorebord</h2>
      <button id="scoreboard-toggle" onclick="toggleOfflineScoreboard()" class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">📊 Grafiek</button>
    </div>
    <div id="scoreboard-table" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b-2 border-emerald-200">
          <th class="text-left py-2 px-2 font-semibold text-gray-700 sticky left-0 bg-white z-10">Speler</th>`;

  for (const r of sb.rounds) {
    html += `<th class="text-center py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">R${r.number} (${r.cardsPerPlayer})</th>`;
  }
  html += `<th class="text-center py-2 px-3 font-bold text-emerald-800 border-l-2 border-emerald-200">Totaal</th></tr></thead><tbody>`;

  for (const row of sb.rows) {
    html += `<tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-2 px-2 font-medium text-gray-800 sticky left-0 bg-white z-10">${row.playerName}</td>`;
    for (const s of row.roundScores) {
      html += `<td class="text-center py-2 px-2 ${s >= 0 ? 'text-emerald-700' : 'text-red-600'}">${s}</td>`;
    }
    html += `<td class="text-center py-2 px-3 font-bold text-emerald-800 border-l-2 border-emerald-200">${row.total}</td></tr>`;
  }
  html += `</tbody></table></div>
    <div id="scoreboard-graph" class="hidden" style="height:350px"><canvas id="scoreChart"></canvas></div></div>`;

  return html;
}

function toggleOfflineScoreboard() {
  const table = document.getElementById('scoreboard-table');
  const graph = document.getElementById('scoreboard-graph');
  const btn = document.getElementById('scoreboard-toggle');
  if (table.classList.contains('hidden')) {
    table.classList.remove('hidden');
    graph.classList.add('hidden');
    btn.textContent = '📊 Grafiek';
    localStorage.setItem('boerenbridge_scoreboard_view', 'table');
  } else {
    table.classList.add('hidden');
    graph.classList.remove('hidden');
    btn.textContent = '📋 Tabel';
    localStorage.setItem('boerenbridge_scoreboard_view', 'graph');
    drawOfflineChart(currentScoreboardData);
  }
}

let currentScoreboardData = null;

function drawOfflineChart(sb) {
  if (!sb) return;
  currentScoreboardData = sb;
  if (chart) chart.destroy();
  const canvas = document.getElementById('scoreChart');
  if (!canvas) return;

  const labels = sb.rounds.map(r => 'R' + r.number);
  const datasets = sb.rows.map((row, i) => ({
    label: row.playerName,
    data: row.cumulativeScores,
    borderColor: COLORS[i % COLORS.length],
    backgroundColor: COLORS[i % COLORS.length] + '20',
    borderWidth: 2.5,
    borderDash: DASH[i % DASH.length],
    tension: 0.2,
    pointRadius: 4,
    pointHoverRadius: 6,
  }));

  chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        y: { title: { display: true, text: 'Cumulatieve punten' } },
        x: { title: { display: true, text: 'Ronde' } },
      },
    },
  });
}

// ── Phase renderers ──

async function getCurrentBids(g) {
  const rows = (await conn.query(
    `SELECT player_id, bid FROM round_results WHERE game_id = ${currentGameId} AND round_number = ${g.current_round}`
  )).toArray();
  const bids = {};
  for (const r of rows) bids[r.player_id] = r.bid;
  return bids;
}

function renderBiddingPhase(g, players, cards) {
  const dealerIdx = (g.current_round - 1) % players.length;
  const firstBidderIdx = (dealerIdx + 1) % players.length;

  let html = `<div class="bg-white rounded-xl shadow-lg p-6">
    <h2 class="text-2xl font-bold text-emerald-800 mb-2">Biedingen invoeren</h2>
    <p class="text-gray-600 mb-3">Ronde ${g.current_round} · ${cards} ${cards === 1 ? 'kaart' : 'kaarten'} per speler</p>
    <div class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
      💡 <strong>Blinde regel:</strong> De biedingen mogen samen niet optellen tot ${cards}.
    </div>
    <form id="bids-form" onsubmit="return submitBids(event, ${cards})" class="space-y-3">`;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const isDealer = i === dealerIdx;
    const isFirstBidder = i === firstBidderIdx;
    html += `<div class="flex items-center gap-2 flex-wrap">
      <div class="flex items-center gap-2 w-44 min-w-0">
        <span class="font-medium text-gray-700 truncate">${p.name}</span>
        ${isDealer ? '<span class="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold">🃏 Deler</span>' : ''}
        ${isFirstBidder ? '<span class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">🎯 1e bod</span>' : ''}
      </div>
      <input type="number" id="bid_${p.id}" min="0" max="${cards}" value="0"
        class="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bid-input"
        onchange="updateBidTotal(${cards})">
    </div>`;
  }

  html += `<div class="mt-4 p-3 bg-gray-50 rounded-lg">
      Totaal: <strong id="bid-total">0</strong> / ${cards}
      <span id="bid-warning" class="text-red-600 font-semibold hidden ml-3">⚠️ Blinde regel!</span>
    </div>
    <button type="submit" class="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition">Biedingen bevestigen</button>
    <div id="bids-error" class="mt-2 text-red-600 font-medium hidden"></div>
    </form></div>`;
  return html;
}

function updateBidTotal(cards) {
  let total = 0;
  document.querySelectorAll('.bid-input').forEach(i => total += parseInt(i.value) || 0);
  document.getElementById('bid-total').textContent = total;
  const warn = document.getElementById('bid-warning');
  if (total === cards) { warn.classList.remove('hidden'); }
  else { warn.classList.add('hidden'); }
}

async function submitBids(event, cards) {
  event.preventDefault();
  assert(typeof cards === 'number' && cards > 0, 'ongeldig aantal kaarten: ' + cards);
  assert(currentGameId > 0, 'currentGameId niet gezet');

  const bids = {};
  const bidValues = [];
  document.querySelectorAll('.bid-input').forEach(i => {
    const pid = parseInt(i.id.replace('bid_', ''));
    const val = parseInt(i.value) || 0;
    bids[pid] = val;
    bidValues.push(val);
  });
  assert(Object.keys(bids).length >= 2, 'minder dan 2 biedingen verzameld');
  assert(bidValues.length === Object.keys(bids).length, 'bid arrays mismatch');

  const err = validateBids(bidValues, cards);
  if (err) {
    const el = document.getElementById('bids-error');
    el.textContent = '⚠️ ' + err;
    el.classList.remove('hidden');
    return false;
  }

  const { game: g } = await getGame(currentGameId);
  assert(g, 'game ' + currentGameId + ' niet gevonden bij submitBids');
  assert(g.phase === 'bidding', 'verwachte fase bidding, kreeg: ' + g.phase);
  await saveBids(currentGameId, g.current_round, bids);
  await updateGamePhase(currentGameId, g.current_round, 'playing');
  await renderGameView();
  return false;
}

function renderPlayingPhase(g, players, cards, bids) {
  const dealerIdx = (g.current_round - 1) % players.length;
  const firstBidderIdx = (dealerIdx + 1) % players.length;

  let html = `<div class="bg-white rounded-xl shadow-lg p-6">
    <h2 class="text-2xl font-bold text-emerald-800 mb-2">Slagen invoeren</h2>
    <p class="text-gray-600 mb-3">Ronde ${g.current_round} · ${cards} ${cards === 1 ? 'kaart' : 'kaarten'} per speler</p>
    <div class="overflow-x-auto"><table class="w-full">
      <thead><tr class="border-b-2 border-emerald-200">
        <th class="text-left py-2 px-3 font-semibold text-gray-700">Speler</th>
        <th class="text-center py-2 px-3 font-semibold text-gray-700">Bod</th>
        <th class="text-center py-2 px-3 font-semibold text-gray-700">Slagen</th>
      </tr></thead><tbody>`;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const isDealer = i === dealerIdx;
    const isFirstBidder = i === firstBidderIdx;
    html += `<tr class="border-b border-gray-100">
      <td class="py-2 px-3 font-medium text-gray-800">
        ${p.name}
        ${isDealer ? '<span class="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold ml-1">🃏 Deler</span>' : ''}
        ${isFirstBidder ? '<span class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold ml-1">🎯 1e bod</span>' : ''}
      </td>
      <td class="text-center py-2 px-3"><span class="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold">${bids[p.id] || 0}</span></td>
      <td class="text-center py-2 px-3">
        <input type="number" id="tricks_${p.id}" min="0" max="${cards}" value="0"
          class="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none trick-input"
          onchange="updateTrickTotal(${cards})">
      </td></tr>`;
  }

  html += `</tbody></table></div>
    <div class="mt-4 p-3 bg-gray-50 rounded-lg">
      Totaal: <strong id="trick-total">0</strong> / ${cards}
      <span id="trick-warning" class="text-red-600 font-semibold hidden ml-3">⚠️ Totaal moet ${cards} zijn!</span>
    </div>
    <button onclick="submitTricks(${cards})" class="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition">Slagen bevestigen</button>
    <div id="tricks-error" class="mt-2 text-red-600 font-medium hidden"></div></div>`;
  return html;
}

function updateTrickTotal(cards) {
  let total = 0;
  document.querySelectorAll('.trick-input').forEach(i => total += parseInt(i.value) || 0);
  document.getElementById('trick-total').textContent = total;
  const warn = document.getElementById('trick-warning');
  if (total !== cards) { warn.classList.remove('hidden'); }
  else { warn.classList.add('hidden'); }
}

async function submitTricks(cards) {
  assert(typeof cards === 'number' && cards > 0, 'ongeldig aantal kaarten: ' + cards);
  assert(currentGameId > 0, 'currentGameId niet gezet');

  const tricks = {};
  const trickValues = [];
  document.querySelectorAll('.trick-input').forEach(i => {
    const pid = parseInt(i.id.replace('tricks_', ''));
    const val = parseInt(i.value) || 0;
    tricks[pid] = val;
    trickValues.push(val);
  });
  assert(Object.keys(tricks).length >= 2, 'minder dan 2 tricks verzameld');

  const err = validateTricks(trickValues, cards);
  if (err) {
    const el = document.getElementById('tricks-error');
    el.textContent = '⚠️ ' + err;
    el.classList.remove('hidden');
    return;
  }

  const { game: g } = await getGame(currentGameId);
  assert(g, 'game ' + currentGameId + ' niet gevonden bij submitTricks');
  assert(g.phase === 'playing', 'verwachte fase playing, kreeg: ' + g.phase);
  await saveTricksAndScores(currentGameId, g.current_round, tricks);
  await updateGamePhase(currentGameId, g.current_round, 'round_summary');
  await renderGameView();
}

function renderSummaryPhase(g, players, cards, results, tRounds) {
  let html = `<div class="bg-white rounded-xl shadow-lg p-6">
    <h2 class="text-2xl font-bold text-emerald-800 mb-2">Resultaten ronde ${g.current_round}</h2>
    <p class="text-gray-600 mb-3">${cards} ${cards === 1 ? 'kaart' : 'kaarten'} per speler</p>
    <div class="overflow-x-auto"><table class="w-full">
      <thead><tr class="border-b-2 border-emerald-200">
        <th class="text-left py-2 px-3 font-semibold text-gray-700">Speler</th>
        <th class="text-center py-2 px-3 font-semibold text-gray-700">Bod</th>
        <th class="text-center py-2 px-3 font-semibold text-gray-700">Slagen</th>
        <th class="text-center py-2 px-3 font-semibold text-gray-700">Punten</th>
      </tr></thead><tbody>`;

  for (const r of results) {
    html += `<tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-2 px-3 font-medium text-gray-800">${r.name}</td>
      <td class="text-center py-2 px-3">${r.bid}</td>
      <td class="text-center py-2 px-3">${r.tricks_won}</td>
      <td class="text-center py-2 px-3 font-bold ${r.score >= 0 ? 'text-emerald-700' : 'text-red-600'}">${r.score >= 0 ? '+' : ''}${r.score}</td></tr>`;
  }

  html += `</tbody></table></div>
    <button onclick="goNextRound()" class="mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition">
      ${g.current_round >= tRounds ? 'Bekijk eindstand' : 'Volgende ronde'}
    </button></div>`;
  return html;
}

function renderGameOver(sb) {
  const results = sb.rows.map((row, i) => ({
    position: i + 1,
    name: row.playerName,
    total: row.total,
  }));

  let html = `<div class="bg-white rounded-xl shadow-lg p-6 text-center">
    <div class="text-6xl mb-4">🏆</div>
    <h2 class="text-3xl font-bold text-emerald-800 mb-6">Spel afgelopen!</h2>
    <div class="overflow-x-auto"><table class="w-full mx-auto max-w-md">
      <thead><tr class="border-b-2 border-emerald-200">
        <th class="text-center py-2 px-3 font-semibold text-gray-700">Positie</th>
        <th class="text-left py-2 px-3 font-semibold text-gray-700">Speler</th>
        <th class="text-center py-2 px-3 font-semibold text-gray-700">Punten</th>
      </tr></thead><tbody>`;

  for (const r of results) {
    const medal = r.position === 1 ? '🥇' : r.position === 2 ? '🥈' : r.position === 3 ? '🥉' : r.position;
    html += `<tr class="border-b border-gray-100 ${r.position === 1 ? 'bg-amber-50' : ''}">
      <td class="text-center py-3 px-3">${medal}</td>
      <td class="py-3 px-3 font-medium text-gray-800 ${r.position === 1 ? 'text-xl' : ''}">${r.name}</td>
      <td class="text-center py-3 px-3 font-bold ${r.total >= 0 ? 'text-emerald-700' : 'text-red-600'}">${r.total}</td></tr>`;
  }

  html += `</tbody></table></div>
    <button onclick="showPage('game-list-page');renderGameList()" class="mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition">Alle spellen</button></div>`;
  return html;
}

async function goNextRound() {
  assert(currentGameId > 0, 'currentGameId niet gezet');
  const data = await getGame(currentGameId);
  assert(data !== null, 'game niet gevonden bij goNextRound');
  const { game: g } = data;
  const nextRound = g.current_round + 1;
  const tRounds = totalRounds(g.numPlayers, g.direction, g.max_cards);
  assert(tRounds > 0, 'tRounds is 0');

  if (nextRound > tRounds) {
    await updateGamePhase(currentGameId, g.current_round, 'game_over');
  } else {
    await updateGamePhase(currentGameId, nextRound, 'bidding');
  }
  await renderGameView();
}

// ── Init ──

window.addEventListener('load', async () => {
  // Defensive: ensure critical DOM elements exist before anything
  try {
    assertEl('loading');
    assertEl('loading-step');
    assertEl('loading-progress');
    assertEl('loading-bar');
    assertEl('loading-pct');
  } catch (e) {
    document.body.innerHTML = '<div style="padding:2rem;color:red;font-family:sans-serif"><h2>⚠️ Kritieke fout</h2><p>DOM elementen ontbreken: ' + e.message + '</p></div>';
    console.error('[offline] DOM assert failed:', e);
    return;
  }

  logStep('Stap 0/6: Pagina geladen, initialisatie start...');
  console.log('[offline] === INIT START ===');
  console.log('[offline] navigator.onLine:', navigator.onLine);
  console.log('[offline] userAgent:', navigator.userAgent);
  console.log('[offline] serviceWorker:', 'serviceWorker' in navigator ? 'supported' : 'not supported');

  try {
    await initDB();
    const loading = assertEl('loading');
    loading.classList.add('hidden');
    console.log('[offline] DB init complete, rendering game list');
    await renderGameList();
    showPage('game-list-page');
    console.log('[offline] === INIT SUCCESS ===');
  } catch (err) {
    const lastStep = document.getElementById('loading-step')?.textContent || 'onbekend';
    const elapsed = initTimer ? Math.round((Date.now() - initTimer) / 1000) + 's' : '?';
    console.error('[offline] === INIT FAILED ===');
    console.error('[offline] at step:', lastStep);
    console.error('[offline] elapsed:', elapsed);
    console.error('[offline] error name:', err.name);
    console.error('[offline] error message:', err.message);
    console.error('[offline] error stack:', err.stack);

    const loading = document.getElementById('loading');
    if (!loading) {
      document.body.innerHTML = '<div style="padding:2rem;color:red"><h2>Kritieke fout</h2><p>Loading element verdwenen: ' + err.message + '</p></div>';
      return;
    }
    loading.innerHTML = `
      <div class="text-red-600 text-lg font-bold mb-2">⚠️ Fout bij laden database</div>
      <p class="text-gray-700 font-medium mb-1">Laatste stap: <span class="text-amber-600">${lastStep}</span></p>
      <p class="text-gray-600 mb-1">Tijd: <span class="text-gray-500">${elapsed}</span></p>
      <p class="text-gray-600 mb-1">Fout: <span class="text-red-600">${err.message || 'Onbekende fout'}</span></p>
      <p class="text-xs text-gray-400 font-mono mb-4 max-w-md mx-auto break-all">Type: ${err.name || 'Error'}</p>
      <button onclick="location.reload()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition">
        🔄 Opnieuw proberen
      </button>
      <p class="mt-4 text-xs text-gray-400">Probeer ook: site data wissen in browser instellingen</p>`;
  }
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/sw.js');
}
