import { cardsForRound, calculateScore, totalRounds, validateBids, validateTricks } from './rules.ts';
import { SCHEMA_VERSION, type CompletedRound, type Direction, type Game, type Player } from './types.ts';

export type GameErrorCode =
  | 'PLAYER_COUNT'
  | 'PLAYER_NAME'
  | 'BID_RANGE'
  | 'TRICKS_RANGE'
  | 'BLIND_RULE'
  | 'TRICKS_TOTAL'
  | 'ROUND_NOT_FOUND'
  | 'ROUND_LOCKED'
  | 'GAME_FINISHED';

export class GameError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

export interface SetupInput {
  names: string[];
  direction: Direction;
  maxCards: number;
}

export interface TotalsRow {
  playerId: string;
  name: string;
  total: number;
  cumulative: number[];
}

export function newId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function playerCountError(message: string): GameError {
  return new GameError('PLAYER_COUNT', message);
}

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function checkValues(
  values: number[],
  playerCount: number,
  max: number,
  code: 'BID_RANGE' | 'TRICKS_RANGE',
  label: string,
): void {
  if (values.length !== playerCount) {
    throw new GameError(code, `Er moeten ${playerCount} ${label} ingevuld zijn.`);
  }
  for (const value of values) {
    if (!isIntegerInRange(value, 0, max)) {
      throw new GameError(code, `Elke ${label} moet tussen 0 en ${max} liggen.`);
    }
  }
}

function withRevision(game: Game, patch: Partial<Game>): Game {
  return {
    ...game,
    ...patch,
    setup: patch.setup ?? { ...game.setup, players: game.setup.players.map((player) => ({ ...player })) },
    rounds: (patch.rounds ?? game.rounds).map((round) => ({
      ...round,
      bids: [...round.bids],
      tricks: [...round.tricks],
      scores: [...round.scores],
    })),
    pending: patch.pending === undefined
      ? game.pending
        ? { ...game.pending, bids: game.pending.bids ? [...game.pending.bids] : null }
        : null
      : patch.pending,
    revision: game.revision + 1,
  };
}

export function createGame(input: SetupInput, now: string): Game {
  const names = input.names.map((name) => name.trim());
  if (names.length < 2 || names.length > 8) {
    throw playerCountError('Een spel heeft 2 tot 8 spelers nodig.');
  }
  if (input.direction !== 'up_down' && input.direction !== 'up_only') {
    throw playerCountError('Kies een geldige speelrichting.');
  }
  names.forEach((name, index) => {
    if (name.length < 1 || name.length > 40) {
      throw new GameError('PLAYER_NAME', `Naam ${index + 1} moet 1 tot 40 tekens bevatten.`);
    }
  });

  const maxCards = Number.isInteger(input.maxCards) && input.maxCards > 0 ? input.maxCards : 0;
  const players: Player[] = names.map((name, seat) => ({ id: newId(), name, seat }));
  const firstCards = cardsForRound(1, players.length, input.direction, maxCards);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    phase: 'active',
    setup: {
      players,
      direction: input.direction,
      maxCards,
    },
    rounds: [],
    pending: { round: 1, cards: firstCards, bids: null },
    revision: 1,
  };
}

export function submitBids(game: Game, bids: number[]): Game {
  if (game.pending === null) {
    throw new GameError(
      game.phase === 'finished' ? 'GAME_FINISHED' : 'ROUND_LOCKED',
      game.phase === 'finished' ? 'Dit spel is al afgelopen.' : 'Deze ronde kan niet meer worden ingevuld.',
    );
  }
  if (game.pending.bids !== null) {
    throw new GameError('ROUND_LOCKED', 'De biedingen voor deze ronde zijn al ingevuld.');
  }

  const pending = game.pending;
  const playerCount = game.setup.players.length;
  checkValues(bids, playerCount, pending.cards, 'BID_RANGE', 'bieding');

  const blindRuleError = validateBids(bids, pending.cards);
  if (blindRuleError !== null) {
    throw new GameError('BLIND_RULE', blindRuleError);
  }

  return withRevision(game, {
    pending: { ...pending, bids: [...bids] },
  });
}

export function submitTricks(game: Game, tricks: number[]): Game {
  const pending = game.pending;
  if (pending === null) {
    throw new GameError(
      game.phase === 'finished' ? 'GAME_FINISHED' : 'ROUND_LOCKED',
      game.phase === 'finished' ? 'Dit spel is al afgelopen.' : 'Deze ronde kan niet meer worden ingevuld.',
    );
  }
  const bids = pending.bids;
  if (bids === null) {
    throw new GameError('ROUND_LOCKED', 'Vul eerst de biedingen voor deze ronde in.');
  }

  const playerCount = game.setup.players.length;
  checkValues(tricks, playerCount, pending.cards, 'TRICKS_RANGE', 'slagen');

  const tricksError = validateTricks(tricks, pending.cards);
  if (tricksError !== null) {
    throw new GameError('TRICKS_TOTAL', tricksError);
  }

  const completed: CompletedRound = {
    round: pending.round,
    cards: pending.cards,
    bids: [...bids],
    tricks: [...tricks],
    scores: bids.map((bid, seat) => calculateScore(bid, tricks[seat]!)),
  };

  const rounds = [...game.rounds, completed];
  const nextRound = pending.round + 1;
  const lastRound = totalRounds(playerCount, game.setup.direction, game.setup.maxCards);

  if (nextRound > lastRound) {
    return withRevision(game, { rounds, pending: null, phase: 'finished' });
  }

  return withRevision(game, {
    rounds,
    phase: 'active',
    pending: {
      round: nextRound,
      cards: cardsForRound(nextRound, playerCount, game.setup.direction, game.setup.maxCards),
      bids: null,
    },
  });
}

export function undoLastRound(game: Game): Game {
  if (game.rounds.length === 0) {
    throw new GameError('ROUND_NOT_FOUND', 'Er is nog geen ronde om ongedaan te maken.');
  }

  const rounds = game.rounds.slice(0, -1).map((round) => ({
    ...round,
    bids: [...round.bids],
    tricks: [...round.tricks],
    scores: [...round.scores],
  }));
  const popped = game.rounds[game.rounds.length - 1]!;

  return withRevision(game, {
    rounds,
    phase: 'active',
    pending: {
      round: popped.round,
      cards: popped.cards,
      bids: [...popped.bids],
    },
  });
}

export function correctRound(game: Game, round: number, bids: number[], tricks: number[]): Game {
  const existing = game.rounds[round - 1];
  if (!Number.isInteger(round) || existing === undefined) {
    throw new GameError('ROUND_NOT_FOUND', 'Deze ronde bestaat niet.');
  }

  const playerCount = game.setup.players.length;
  checkValues(bids, playerCount, existing.cards, 'BID_RANGE', 'bieding');
  checkValues(tricks, playerCount, existing.cards, 'TRICKS_RANGE', 'slagen');

  const blindRuleError = validateBids(bids, existing.cards);
  if (blindRuleError !== null) {
    throw new GameError('BLIND_RULE', blindRuleError);
  }
  const tricksError = validateTricks(tricks, existing.cards);
  if (tricksError !== null) {
    throw new GameError('TRICKS_TOTAL', tricksError);
  }

  const corrected: CompletedRound = {
    round: existing.round,
    cards: existing.cards,
    bids: [...bids],
    tricks: [...tricks],
    scores: bids.map((bid, seat) => calculateScore(bid, tricks[seat]!)),
  };

  const rounds = game.rounds.map((current, index) => (index === round - 1 ? corrected : current));

  return withRevision(game, { rounds });
}

export function totals(game: Game): TotalsRow[] {
  return game.setup.players.map((player) => {
    const cumulative: number[] = [];
    let running = 0;
    for (const round of game.rounds) {
      running += round.scores[player.seat] ?? 0;
      cumulative.push(running);
    }
    return {
      playerId: player.id,
      name: player.name,
      total: running,
      cumulative,
    };
  });
}

export function leader(game: Game): string | null {
  const rows = totals(game);
  if (rows.length === 0) {
    return null;
  }
  const best = Math.max(...rows.map((row) => row.total));
  const leaders = rows.filter((row) => row.total === best);
  return leaders.length === 1 ? leaders[0]!.playerId : null;
}

export function cardsFor(game: Game, round: number): number {
  return cardsForRound(round, game.setup.players.length, game.setup.direction, game.setup.maxCards);
}

export function isComplete(game: Game): boolean {
  return game.phase === 'finished';
}
