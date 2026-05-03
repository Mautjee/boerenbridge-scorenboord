import type { RoundResult } from '~/lib/game-logic'
import type { Player, Game } from '~/server/db/schema'

export interface GameSnapshot {
  game: Game
  players: Player[]
  rounds: number[]
  currentRoundIndex: number
  completedRounds: RoundResult[]
  cumulativeScores: Record<string, number>
  currentBids: Record<string, number> | null
  phase: 'bidding' | 'awaiting_tricks' | 'finished'
}

export type GamePhase = GameSnapshot['phase']
