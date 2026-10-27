import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  calculateScore,
  cardsForRound,
  roundSequence,
  totalRounds,
  validateBids,
  validateTricks,
} from '../rules.ts';
import { SCHEMA_VERSION, type Direction } from '../types.ts';

interface RoundSequenceCase {
  numPlayers: number;
  direction: Direction;
  maxCards: number;
  expected: number[];
}

interface TotalRoundsCase {
  numPlayers: number;
  direction: Direction;
  maxCards: number;
  expected: number;
}

interface CardsForRoundCase {
  round: number;
  numPlayers: number;
  direction: Direction;
  maxCards: number;
  expected: number;
}

interface CalculateScoreCase {
  bid: number;
  tricksWon: number;
  expected: number;
}

interface ValidateBidsCase {
  bids: number[];
  cardsPerPlayer: number;
  valid: boolean;
}

interface ValidateTricksCase {
  tricks: number[];
  cardsPerPlayer: number;
  valid: boolean;
}

interface RuleVectors {
  roundSequence: RoundSequenceCase[];
  totalRounds: TotalRoundsCase[];
  cardsForRound: CardsForRoundCase[];
  calculateScore: CalculateScoreCase[];
  validateBids: ValidateBidsCase[];
  validateTricks: ValidateTricksCase[];
}

const vectors = JSON.parse(
  readFileSync(new URL('../../../testdata/rule-vectors.json', import.meta.url), 'utf8'),
) as RuleVectors;

test('roundSequence matches the shared vectors', () => {
  assert.ok(vectors.roundSequence.length > 0);
  for (const vector of vectors.roundSequence) {
    assert.deepEqual(
      roundSequence(vector.numPlayers, vector.direction, vector.maxCards),
      vector.expected,
      `roundSequence(${vector.numPlayers}, ${vector.direction}, ${vector.maxCards})`,
    );
  }
});

test('totalRounds matches the shared vectors', () => {
  assert.ok(vectors.totalRounds.length > 0);
  for (const vector of vectors.totalRounds) {
    assert.equal(
      totalRounds(vector.numPlayers, vector.direction, vector.maxCards),
      vector.expected,
      `totalRounds(${vector.numPlayers}, ${vector.direction}, ${vector.maxCards})`,
    );
  }
});

test('cardsForRound matches the shared vectors', () => {
  assert.ok(vectors.cardsForRound.length > 0);
  for (const vector of vectors.cardsForRound) {
    assert.equal(
      cardsForRound(vector.round, vector.numPlayers, vector.direction, vector.maxCards),
      vector.expected,
      `cardsForRound(${vector.round}, ${vector.numPlayers}, ${vector.direction}, ${vector.maxCards})`,
    );
  }
});

test('calculateScore matches the shared vectors', () => {
  assert.ok(vectors.calculateScore.length > 0);
  for (const vector of vectors.calculateScore) {
    assert.equal(
      calculateScore(vector.bid, vector.tricksWon),
      vector.expected,
      `calculateScore(${vector.bid}, ${vector.tricksWon})`,
    );
  }
});

test('validateBids matches the shared vectors', () => {
  assert.ok(vectors.validateBids.length > 0);
  for (const vector of vectors.validateBids) {
    assert.equal(
      validateBids(vector.bids, vector.cardsPerPlayer) === null,
      vector.valid,
      `validateBids([${vector.bids.join(',')}], ${vector.cardsPerPlayer})`,
    );
  }
});

test('validateTricks matches the shared vectors', () => {
  assert.ok(vectors.validateTricks.length > 0);
  for (const vector of vectors.validateTricks) {
    assert.equal(
      validateTricks(vector.tricks, vector.cardsPerPlayer) === null,
      vector.valid,
      `validateTricks([${vector.tricks.join(',')}], ${vector.cardsPerPlayer})`,
    );
  }
});

test('the schema version constant matches testdata/schema-version.txt', () => {
  const text = readFileSync(new URL('../../../testdata/schema-version.txt', import.meta.url), 'utf8').trim();
  assert.equal(String(SCHEMA_VERSION), text);
});
