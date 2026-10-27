import type { Direction } from './types.ts';

export function roundSequence(numPlayers: number, direction: Direction, maxCards: number): number[] {
  const naturalMax = Math.floor(52 / numPlayers);
  let peak = naturalMax;
  if (maxCards > 0 && maxCards < peak) {
    peak = maxCards;
  }

  const seq: number[] = [];
  if (direction === 'up_only') {
    for (let i = 1; i <= peak; i++) {
      seq.push(i);
    }
  } else {
    for (let i = 1; i <= peak; i++) {
      seq.push(i);
    }
    for (let i = peak - 1; i >= 1; i--) {
      seq.push(i);
    }
  }

  return seq;
}

export function totalRounds(numPlayers: number, direction: Direction, maxCards: number): number {
  return roundSequence(numPlayers, direction, maxCards).length;
}

export function cardsForRound(
  roundNum: number,
  numPlayers: number,
  direction: Direction,
  maxCards: number,
): number {
  const seq = roundSequence(numPlayers, direction, maxCards);
  if (roundNum < 1 || roundNum > seq.length) {
    return 0;
  }
  return seq[roundNum - 1]!;
}

export function calculateScore(bid: number, tricksWon: number): number {
  if (bid === tricksWon) {
    return 10 + 3 * bid;
  }
  return -3 * Math.abs(bid - tricksWon);
}

export function validateBids(bids: number[], cardsPerPlayer: number): string | null {
  const total = bids.reduce((sum, bid) => sum + bid, 0);
  if (total === cardsPerPlayer) {
    return `Biedingen mogen niet samen exact ${cardsPerPlayer} zijn (blinde regel).`;
  }
  return null;
}

export function validateTricks(tricks: number[], cardsPerPlayer: number): string | null {
  const total = tricks.reduce((sum, trick) => sum + trick, 0);
  if (total !== cardsPerPlayer) {
    return `Het totaal aantal slagen (${total}) moet gelijk zijn aan het aantal kaarten per speler (${cardsPerPlayer}).`;
  }
  return null;
}
