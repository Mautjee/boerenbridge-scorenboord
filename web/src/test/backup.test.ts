import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importGames, parseBackup, serializeBackup } from '../backup.ts';
import { createGame, submitBids, submitTricks } from '../model.ts';
import { MemoryStore } from '../store.ts';
import { SCHEMA_VERSION, type Game } from '../types.ts';

const NOW = '2026-10-27T12:00:00.000Z';

function finishedGame(): Game {
  const created = createGame({ names: ['Anna', 'Bram'], direction: 'up_only', maxCards: 1 }, NOW);
  return submitTricks(submitBids(created, [0, 0]), [1, 0]);
}

test('a JSON backup round-trips a game snapshot unchanged', () => {
  const game = finishedGame();
  const text = serializeBackup([game], NOW);

  const parsed = parseBackup(text);

  assert.deepEqual(parsed, [game]);
  assert.equal(parsed[0]!.schemaVersion, SCHEMA_VERSION);
  assert.equal(parsed[0]!.rounds.length, 1);
});

test('a backup keeps every round and its scores', () => {
  let game = createGame({ names: ['Anna', 'Bram', 'Cees'], direction: 'up_only', maxCards: 2 }, NOW);
  game = submitTricks(submitBids(game, [0, 0, 0]), [1, 0, 0]);
  game = submitTricks(submitBids(game, [0, 1, 0]), [1, 1, 0]);

  const [restored] = parseBackup(serializeBackup([game], NOW));

  assert.deepEqual(restored, game);
  assert.deepEqual(
    restored!.rounds.map((round) => round.scores),
    game.rounds.map((round) => round.scores),
  );
});

test('a backup with another schema version is refused', () => {
  const text = JSON.stringify({
    format: 'boerenbridge-backup',
    schemaVersion: SCHEMA_VERSION + 1,
    exportedAt: NOW,
    games: [finishedGame()],
  });

  assert.throws(() => parseBackup(text), /opslagversie/);
});

test('a file that is not a backup is refused', () => {
  assert.throws(() => parseBackup('{"games":[]}'), /geldig/);
  assert.throws(() => parseBackup('geen json'), /geldig/);
});

test('importing a backup writes every game through the store', async () => {
  const store = new MemoryStore();
  const [game] = parseBackup(serializeBackup([finishedGame()], NOW));

  const outcome = await importGames(store, [game!]);

  assert.equal(outcome.saved.length, 1);
  assert.equal(outcome.skipped.length, 0);
  assert.equal((await store.list()).length, 1);
  assert.equal((await store.get(game!.id))?.revision, game!.revision);
});

test('importing an older copy leaves newer local progress alone', async () => {
  const store = new MemoryStore();
  const local = { ...finishedGame(), revision: 5 };
  await store.save(local);
  const incoming = { ...local, revision: 4, updatedAt: '2000-01-01T00:00:00.000Z' };

  const outcome = await importGames(store, [incoming]);

  assert.equal(outcome.saved.length, 0);
  assert.equal(outcome.skipped.length, 1);
  assert.equal(outcome.skipped[0]!.id, local.id);
  assert.equal((await store.get(local.id))?.revision, 5);
});

test('importing a newer revision replaces the stored game', async () => {
  const store = new MemoryStore();
  const local = { ...finishedGame(), revision: 5 };
  await store.save(local);
  const incoming = { ...local, revision: 6 };

  const outcome = await importGames(store, [incoming]);

  assert.equal(outcome.saved.length, 1);
  assert.equal(outcome.skipped.length, 0);
  assert.equal((await store.get(local.id))?.revision, 6);
});

test('at an equal revision only a newer updatedAt is accepted', async () => {
  const store = new MemoryStore();
  const local = { ...finishedGame(), revision: 7 };
  await store.save(local);

  const older = await importGames(store, [{ ...local, updatedAt: '2000-01-01T00:00:00.000Z' }]);
  assert.equal(older.saved.length, 0);
  assert.equal(older.skipped.length, 1);

  const newer = await importGames(store, [{ ...local, updatedAt: '2030-01-01T00:00:00.000Z' }]);
  assert.equal(newer.saved.length, 1);
  assert.equal(newer.skipped.length, 0);
});
