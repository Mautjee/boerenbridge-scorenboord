import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GameError,
  cardsFor,
  correctRound,
  createGame,
  isComplete,
  leader,
  submitBids,
  submitTricks,
  totals,
  undoLastRound,
  type SetupInput,
} from '../model.ts';
import { calculateScore } from '../rules.ts';
import { SCHEMA_VERSION, type Game } from '../types.ts';

const NOW = '2026-10-27T12:00:00.000Z';

function setup(overrides: Partial<SetupInput> = {}): SetupInput {
  return {
    names: ['Anna', 'Bram', 'Cees', 'Dirk'],
    direction: 'up_down',
    maxCards: 0,
    ...overrides,
  };
}

function completeOne(game: Game): Game {
  const cards = game.pending!.cards;
  const playerCount = game.setup.players.length;
  const bids = new Array<number>(playerCount).fill(0);
  const tricks = new Array<number>(playerCount).fill(0);
  tricks[0] = cards;
  return submitTricks(submitBids(game, bids), tricks);
}

function expectCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof GameError && error.code === code);
}

test('createGame builds one versioned game object with a pending first round', () => {
  const game = createGame(setup(), NOW);

  assert.equal(game.schemaVersion, SCHEMA_VERSION);
  assert.equal(game.phase, 'active');
  assert.equal(game.revision, 1);
  assert.equal(game.createdAt, NOW);
  assert.equal(game.rounds.length, 0);
  assert.equal(game.setup.players.length, 4);
  assert.deepEqual(game.setup.players.map((player) => player.seat), [0, 1, 2, 3]);
  assert.equal(new Set(game.setup.players.map((player) => player.id)).size, 4);
  assert.deepEqual(game.pending, { round: 1, cards: 1, bids: null });
  assert.equal(cardsFor(game, 1), 1);
});

test('createGame rejects too few or too many players and blank names', () => {
  expectCode(() => createGame(setup({ names: ['Anna'] }), NOW), 'PLAYER_COUNT');
  expectCode(
    () => createGame(setup({ names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] }), NOW),
    'PLAYER_COUNT',
  );
  expectCode(() => createGame(setup({ names: ['Anna', '  '] }), NOW), 'PLAYER_NAME');
});

test('submitBids stores the bids without completing the round and does not mutate its input', () => {
  const game = createGame(setup(), NOW);
  const before = JSON.stringify(game);

  const next = submitBids(game, [0, 0, 0, 0]);

  assert.equal(JSON.stringify(game), before);
  assert.deepEqual(next.pending, { round: 1, cards: 1, bids: [0, 0, 0, 0] });
  assert.equal(next.rounds.length, 0);
  assert.equal(next.revision, game.revision + 1);
  expectCode(() => submitBids(next, [0, 0, 0, 0]), 'ROUND_LOCKED');
});

test('submitBids enforces the blind rule, ranges and length', () => {
  const game = createGame(setup(), NOW);

  expectCode(() => submitBids(game, [1, 0, 0, 0]), 'BLIND_RULE');
  expectCode(() => submitBids(game, [2, 0, 0, 0]), 'BID_RANGE');
  expectCode(() => submitBids(game, [0, 0, 0]), 'BID_RANGE');

  const round2 = completeOne(game);
  expectCode(() => submitBids(round2, [1, 1, 0, 0]), 'BLIND_RULE');
  assert.equal(submitBids(round2, [1, 0, 0, 0]).pending!.bids![0], 1);
});

test('submitTricks completes the round atomically and advances the pending round', () => {
  const game = submitBids(createGame(setup(), NOW), [0, 0, 0, 0]);
  const next = submitTricks(game, [1, 0, 0, 0]);

  assert.equal(next.rounds.length, 1);
  const round = next.rounds[0]!;
  assert.equal(round.round, 1);
  assert.equal(round.cards, 1);
  assert.deepEqual(round.bids, [0, 0, 0, 0]);
  assert.deepEqual(round.tricks, [1, 0, 0, 0]);
  assert.deepEqual(
    round.scores,
    [calculateScore(0, 1), calculateScore(0, 0), calculateScore(0, 0), calculateScore(0, 0)],
  );
  assert.deepEqual(next.pending, { round: 2, cards: 2, bids: null });
  assert.equal(next.phase, 'active');
  assert.equal(next.revision, game.revision + 1);
});

test('submitTricks enforces the tricks total and ranges', () => {
  const game = submitBids(createGame(setup(), NOW), [0, 0, 0, 0]);

  expectCode(() => submitTricks(game, [0, 0, 0, 0]), 'TRICKS_TOTAL');
  expectCode(() => submitTricks(game, [2, 0, 0, 0]), 'TRICKS_RANGE');
  expectCode(() => submitTricks(game, [1, 0, 0]), 'TRICKS_RANGE');
  expectCode(() => submitTricks(createGame(setup(), NOW), [1, 0, 0, 0]), 'ROUND_LOCKED');
});

test('undoLastRound pops the last round, reopens the game and keeps the bids for re-entry', () => {
  let game = createGame(setup(), NOW);
  for (let i = 0; i < 3; i++) {
    game = completeOne(game);
  }

  const undone = undoLastRound(game);

  assert.equal(undone.rounds.length, 2);
  assert.equal(undone.phase, 'active');
  assert.deepEqual(undone.pending, { round: 3, cards: 3, bids: [0, 0, 0, 0] });
  assert.equal(undone.revision, game.revision + 1);
  expectCode(() => undoLastRound(createGame(setup(), NOW)), 'ROUND_NOT_FOUND');
});

test('correctRound(3) after seven rounds changes only round 3 and recomputes totals', () => {
  let game = createGame(setup(), NOW);
  for (let i = 0; i < 7; i++) {
    game = completeOne(game);
  }
  const before = game;
  const laterRounds = before.rounds.slice(3);

  const corrected = correctRound(before, 3, [0, 0, 0, 0], [0, 3, 0, 0]);

  assert.equal(corrected.rounds.length, 7);
  assert.deepEqual(corrected.rounds[2]!.tricks, [0, 3, 0, 0]);
  assert.deepEqual(corrected.rounds[2]!.scores, [10, -9, 10, 10]);
  assert.deepEqual(corrected.rounds.slice(3), laterRounds);
  assert.equal(JSON.stringify(before.rounds[2]!.tricks), JSON.stringify([3, 0, 0, 0]));
  assert.equal(corrected.revision, before.revision + 1);

  const expectedTotals = corrected.setup.players.map((player) =>
    corrected.rounds.reduce((sum, round) => sum + round.scores[player.seat]!, 0),
  );
  assert.deepEqual(
    totals(corrected).map((row) => row.total),
    expectedTotals,
  );
  assert.deepEqual(
    totals(corrected).map((row) => row.cumulative.length),
    [7, 7, 7, 7],
  );
});

test('correctRound validates the round, the blind rule and the tricks total', () => {
  let game = createGame(setup(), NOW);
  for (let i = 0; i < 3; i++) {
    game = completeOne(game);
  }

  expectCode(() => correctRound(game, 9, [0, 0, 0, 0], [0, 0, 0, 0]), 'ROUND_NOT_FOUND');
  expectCode(() => correctRound(game, 2, [1, 1, 0, 0], [2, 0, 0, 0]), 'BLIND_RULE');
  expectCode(() => correctRound(game, 2, [0, 0, 0, 0], [1, 0, 0, 0]), 'TRICKS_TOTAL');
});

test('the last round finishes the game, undo reopens it and correcting it keeps it finished', () => {
  let game = createGame(setup({ direction: 'up_only', maxCards: 1 }), NOW);
  assert.equal(game.pending!.cards, 1);

  game = completeOne(game);
  assert.equal(game.rounds.length, 1);
  assert.equal(game.pending, null);
  assert.equal(game.phase, 'finished');
  assert.equal(isComplete(game), true);
  expectCode(() => submitBids(game, [0, 0, 0, 0]), 'GAME_FINISHED');

  const reopened = undoLastRound(game);
  assert.equal(reopened.phase, 'active');
  assert.equal(reopened.pending!.round, 1);
  assert.equal(isComplete(reopened), false);

  const finishedAgain = submitTricks(reopened, [1, 0, 0, 0]);
  const corrected = correctRound(finishedAgain, 1, [0, 0, 0, 0], [0, 1, 0, 0]);
  assert.equal(corrected.phase, 'finished');
  assert.equal(corrected.pending, null);
  assert.deepEqual(corrected.rounds[0]!.scores, [10, -3, 10, 10]);
});

test('totals and leader follow the score data', () => {
  let game = createGame(setup({ direction: 'up_only', maxCards: 2 }), NOW);
  assert.deepEqual(totals(game).map((row) => row.total), [0, 0, 0, 0]);
  assert.equal(leader(game), null);

  game = completeOne(game);
  const rows = totals(game);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.total), [-3, 10, 10, 10]);
  assert.deepEqual(rows[0]!.cumulative, [-3]);
  assert.equal(leader(game), null);

  const duel = createGame(setup({ names: ['Anna', 'Bram'], direction: 'up_only', maxCards: 1 }), NOW);
  const won = submitTricks(submitBids(duel, [0, 0]), [0, 1]);
  assert.equal(leader(won), won.setup.players[0]!.id);
});
