import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bidsFormState, tricksFormState } from '../views/forms.ts';
import { GameSession } from '../session.ts';
import { IndexedDbStore, MemoryStore } from '../store.ts';
import { totals } from '../model.ts';
import type { Game } from '../types.ts';
import { FakeIndexedDB } from './fake-idb.ts';

const NOW = '2026-10-27T12:00:00.000Z';

function fakeFactory(indexedDb: FakeIndexedDB): IDBFactory {
  return indexedDb as unknown as IDBFactory;
}

async function playRound(session: GameSession, tricksForFirst = true): Promise<Game> {
  const cards = session.game.pending!.cards;
  const playerCount = session.game.setup.players.length;
  const bids = new Array<number>(playerCount).fill(0);
  const tricks = new Array<number>(playerCount).fill(0);
  tricks[tricksForFirst ? 0 : 1] = cards;
  await session.submitBids(bids);
  return session.submitTricks(tricks);
}

test('the bidding form blocks the blind rule with a specific Dutch message', () => {
  const blocked = bidsFormState(5, [2, 1, 1, 1]);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.canSubmit, false);
  assert.match(blocked.message ?? '', /Biedingen mogen niet samen exact 5 zijn/);
  assert.match(blocked.hint, /Samen bieden jullie 5 slagen/);
  assert.match(blocked.hint, /biedingen mogen niet samen exact 5 zijn/);

  const allowed = bidsFormState(5, [2, 1, 1, 0]);
  assert.equal(allowed.blocked, false);
  assert.equal(allowed.canSubmit, true);
  assert.equal(allowed.message, null);
  assert.match(allowed.hint, /mogen niet samen precies 5 zijn/);
});

test('the tricks form blocks an under- and over-count and enables an exact match', () => {
  const under = tricksFormState(5, [1, 1, 1, 0]);
  assert.equal(under.matched, false);
  assert.equal(under.canSubmit, false);
  assert.equal(under.hint, 'Nog 2 slagen te verdelen.');

  const over = tricksFormState(5, [2, 2, 1, 1]);
  assert.equal(over.total, 6);
  assert.equal(over.over, true);
  assert.equal(over.canSubmit, false);
  assert.match(over.hint, /Je hebt 6 van 5 slagen ingevuld/);
  assert.deepEqual(over.segments, ['on', 'on', 'on', 'on', 'over']);

  const exact = tricksFormState(5, [2, 1, 1, 1]);
  assert.equal(exact.matched, true);
  assert.equal(exact.canSubmit, true);
  assert.equal(exact.hint, 'Klopt. Rond de ronde af als iedereen het eens is.');
  assert.deepEqual(exact.segments, ['on', 'on', 'on', 'on', 'on']);
});

test('undo through the session restores the round and persists the reopened game', async () => {
  const store = new MemoryStore();
  const session = await GameSession.create(store, {
    names: ['Anna', 'Bram', 'Cees', 'Dirk'],
    direction: 'up_down',
    maxCards: 0,
  }, NOW);

  await playRound(session);
  assert.equal((await store.get(session.game.id))?.rounds.length, 1);

  await session.undoLastRound();
  const persisted = await store.get(session.game.id);
  assert.equal(persisted?.rounds.length, 0);
  assert.equal(persisted?.phase, 'active');
  assert.deepEqual(persisted?.pending?.bids, [0, 0, 0, 0]);
});

test('correcting round 3 after seven rounds recomputes totals and survives reload', async () => {
  const indexedDb = new FakeIndexedDB();
  const factory = fakeFactory(indexedDb);
  const store = new IndexedDbStore('boerenbridge', factory);
  const session = await GameSession.create(store, {
    names: ['Anna', 'Bram', 'Cees', 'Dirk'],
    direction: 'up_down',
    maxCards: 0,
  }, NOW);

  for (let round = 0; round < 7; round++) {
    await playRound(session);
  }
  const before = await store.get(session.game.id);
  assert.equal(before?.rounds.length, 7);
  const beforeTotals = totals(before!).map((row) => row.total);
  const laterRounds = before!.rounds.slice(3);

  await session.correctRound(3, [0, 0, 0, 0], [0, 3, 0, 0]);
  const corrected = await store.get(session.game.id);
  assert.equal(corrected?.rounds.length, 7);
  assert.deepEqual(corrected?.rounds[2]?.tricks, [0, 3, 0, 0]);
  assert.deepEqual(corrected?.rounds[2]?.scores, [10, -9, 10, 10]);
  assert.deepEqual(corrected?.rounds.slice(3), laterRounds);

  const reloaded = await GameSession.load(new IndexedDbStore('boerenbridge', factory), session.game.id);
  assert.notEqual(reloaded, null);
  const afterTotals = totals(reloaded!.game).map((row) => row.total);
  const expected = reloaded!.game.setup.players.map((player) =>
    reloaded!.game.rounds.reduce((sum, round) => sum + (round.scores[player.seat] ?? 0), 0),
  );
  assert.deepEqual(afterTotals, expected);
  assert.notDeepEqual(afterTotals, beforeTotals);
  assert.deepEqual(totals(reloaded!.game).map((row) => row.cumulative.length), [7, 7, 7, 7]);
});

test('a completed round is readable from a fresh store instance', async () => {
  const indexedDb = new FakeIndexedDB();
  const factory = fakeFactory(indexedDb);
  const store = new IndexedDbStore('boerenbridge', factory);
  const session = await GameSession.create(store, {
    names: ['Anna', 'Bram', 'Cees', 'Dirk'],
    direction: 'up_down',
    maxCards: 0,
  }, NOW);

  await playRound(session);
  const reloaded = await GameSession.load(new IndexedDbStore('boerenbridge', factory), session.game.id);
  assert.equal(reloaded?.game.rounds.length, 1);
  assert.deepEqual(reloaded?.game.rounds[0]?.bids, [0, 0, 0, 0]);
  assert.deepEqual(reloaded?.game.rounds[0]?.tricks, [1, 0, 0, 0]);
  assert.deepEqual(reloaded?.game.pending, { round: 2, cards: 2, bids: null });
});
