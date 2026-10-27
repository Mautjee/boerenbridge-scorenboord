export type Direction = 'up_down' | 'up_only';
export type GamePhase = 'active' | 'finished';

export const SCHEMA_VERSION = 2;

export interface Player {
  id: string;
  name: string;
  seat: number;
}

export interface CompletedRound {
  round: number;
  cards: number;
  bids: number[];
  tricks: number[];
  scores: number[];
}

export interface PendingRound {
  round: number;
  cards: number;
  bids: number[] | null;
}

export interface Game {
  schemaVersion: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  phase: GamePhase;
  setup: {
    players: Player[];
    direction: Direction;
    maxCards: number;
  };
  rounds: CompletedRound[];
  pending: PendingRound | null;
  revision: number;
}
