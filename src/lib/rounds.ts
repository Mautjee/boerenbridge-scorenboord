import { ok, err, type Result } from 'neverthrow'
import type { ValidationError } from './errors'
import { Errors } from './errors'

/**
 * Generate the round pyramid for a game.
 * For 4 players: max = 13 → [1,2,3,...,13,...,3,2,1]
 * But practically capped sensibly per player count.
 */
export function generateRounds(playerCount: number): Result<number[], ValidationError> {
  if (playerCount < 2) {
    return err(Errors.validation('playerCount', 'Minimaal 2 spelers vereist'))
  }
  if (playerCount > 26) {
    return err(Errors.validation('playerCount', 'Maximaal 26 spelers toegestaan'))
  }

  // Max cards = floor(52 / playerCount), capped at 13
  const maxCards = Math.min(13, Math.floor(52 / playerCount))

  const ascending = Array.from({ length: maxCards }, (_, i) => i + 1)
  const descending = Array.from({ length: maxCards - 1 }, (_, i) => maxCards - 1 - i)

  return ok([...ascending, ...descending])
}

export function getRoundCardCount(rounds: number[], roundIndex: number): number {
  return rounds[roundIndex] ?? 0
}
