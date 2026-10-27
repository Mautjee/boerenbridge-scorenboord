import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame } from '../model.ts';
import { GameSession } from '../session.ts';
import { IndexedDbStore, MemoryStore, openGameStore } from '../store.ts';
import type { Game } from '../types.ts';
import { FakeIndexedDB } from './fake-idb.ts';

const NOW = '2026-10-27T12:00:00.000Z';

function makeGame(names: string[] = ['Anna', 'Bram', 'Cees', 'Dirk']): Game {
  return createGame({ names, direction: 'up_down', maxCards: 0 }, NOW);
}

function fakeFactory(indexedDb: FakeIndexedDB): IDBFactory {
  return indexedDb as unknown as IDBFactory;
}

async function pause(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 2));
}

test('MemoryStore round-trips games, lists newest first and clears', async () => {
  const store = new MemoryStore();
  const first = makeGame();
  const second = makeGame(['Eva', 'Femke']);

  const savedFirst = await store.save(first);
  assert.notEqual(savedFirst.updatedAt, '');
  assert.equal(savedFirst.id, first.id);
  await pause();
  await store.save(second);

  const listed = await store.list();
  assert.equal(listed.length, 2);
  assert.equal(listed[0]!.id, second.id);
  assert.equal((await store.get(first.id))?.setup.players.length, 4);
  assert.equal(await store.get('does-not-exist'), null);

  await store.remove(first.id);
  assert.equal(await store.get(first.id), null);
  await store.clear();
  assert.deepEqual(await store.list(), []);
});

test('IndexedDbStore uses the games store, sets updatedAt and survives a new store instance', async () => {
  const indexedDb = new FakeIndexedDB();
  const store = new IndexedDbStore('boerenbridge', fakeFactory(indexedDb));
  const game = makeGame();

  const saved = await store.save(game);
  assert.equal(saved.id, game.id);
  assert.equal(saved.revision, game.revision);
  assert.notEqual(saved.updatedAt, '');

  const reopened = new IndexedDbStore('boerenbridge', fakeFactory(indexedDb));
  const loaded = await reopened.get(game.id);
  assert.equal(loaded?.id, game.id);
  assert.equal(loaded?.schemaVersion, 2);
  assert.equal((await reopened.list()).length, 1);

  await reopened.remove(game.id);
  assert.equal(await store.get(game.id), null);
  await store.save(game);
  await store.clear();
  assert.deepEqual(await store.list(), []);
});

test('IndexedDbStore hides games stored under another schema version', async () => {
  const indexedDb = new FakeIndexedDB();
  const store = new IndexedDbStore('boerenbridge', fakeFactory(indexedDb));
  await store.list();

  const games = indexedDb.seed('boerenbridge').stores.get('games');
  assert.ok(games);
  const game = makeGame();
  games.put({ ...game, id: 'oude-versie', schemaVersion: game.schemaVersion - 1 });
  await pause();

  assert.deepEqual(await store.list(), []);
  assert.equal(await store.get('oude-versie'), null);

  await store.save(game);
  const listed = await store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.id, game.id);
});

test('IndexedDbStore round-trips the meta store', async () => {
  const indexedDb = new FakeIndexedDB();
  const store = new IndexedDbStore('boerenbridge', fakeFactory(indexedDb));

  assert.equal(await store.getMeta('storagePersisted'), null);
  await store.setMeta('storagePersisted', 'true');
  assert.equal(await store.getMeta('storagePersisted'), 'true');
});

test('openGameStore falls back to MemoryStore with a reason when IndexedDB is unavailable', async () => {
  const broken = {
    open(): never {
      throw new Error('geen opslag');
    },
  } as unknown as IDBFactory;

  const result = await openGameStore('boerenbridge', broken);
  assert.equal(result.fallback, true);
  assert.equal(result.reason, 'geen opslag');
  assert.ok(result.store instanceof MemoryStore);
});

test('GameSession persists every mutation through the store', async () => {
  const store = new MemoryStore();
  const session = await GameSession.create(store, {
    names: ['Anna', 'Bram', 'Cees', 'Dirk'],
    direction: 'up_down',
    maxCards: 0,
  }, NOW);
  const id = session.game.id;

  await session.submitBids([0, 0, 0, 0]);
  assert.deepEqual((await store.get(id))?.pending?.bids, [0, 0, 0, 0]);

  await session.submitTricks([1, 0, 0, 0]);
  assert.equal((await store.get(id))?.rounds.length, 1);
  assert.equal((await store.get(id))?.pending?.round, 2);

  await session.undoLastRound();
  const undone = await store.get(id);
  assert.equal(undone?.rounds.length, 0);
  assert.deepEqual(undone?.pending?.bids, [0, 0, 0, 0]);

  await session.submitTricks([1, 0, 0, 0]);
  await session.correctRound(1, [0, 0, 0, 0], [0, 1, 0, 0]);
  const corrected = await store.get(id);
  assert.deepEqual(corrected?.rounds[0]?.tricks, [0, 1, 0, 0]);
  assert.equal(corrected?.revision, session.game.revision);
});

test('GameSession reloads a persisted game from IndexedDB', async () => {
  const indexedDb = new FakeIndexedDB();
  const factory = fakeFactory(indexedDb);
  const store = new IndexedDbStore('boerenbridge', factory);
  const session = await GameSession.create(store, {
    names: ['Anna', 'Bram', 'Cees', 'Dirk'],
    direction: 'up_down',
    maxCards: 0,
  }, NOW);
  const id = session.game.id;
  await session.submitBids([0, 0, 0, 0]);
  await session.submitTricks([1, 0, 0, 0]);

  const reopenedStore = new IndexedDbStore('boerenbridge', factory);
  const reopened = await GameSession.load(reopenedStore, id);
  assert.equal(reopened?.game.rounds.length, 1);
  assert.deepEqual(reopened?.game.rounds[0]?.scores, session.game.rounds[0]?.scores);
  assert.deepEqual(reopened?.game.pending, { round: 2, cards: 2, bids: null });
  assert.equal(await GameSession.load(reopenedStore, 'does-not-exist'), null);
});
