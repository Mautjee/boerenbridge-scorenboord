import { Result, ok, err } from 'neverthrow'
import type { ValidationError, InvalidBidError, BlindRuleViolationError, TricksDoNotSumError } from './errors'

export interface RoundResult {
  roundIndex: number
  cardCount: number
  perPlayer: Record<string, {
    bid: number
    tricksWon: number
    delta: number
    hit: boolean
  }>
}

export function generateRounds(playerCount: number): Result<number[], ValidationError> {
  if (playerCount < 2) {
    return err({ type: 'ValidationError', field: 'playerCount', message: 'Minimaal 2 spelers nodig' })
  }

  const maxCards = Math.min(13, Math.floor(52 / playerCount))
  const rounds: number[] = []

  for (let i = 1; i <= maxCards; i++) {
    rounds.push(i)
  }
  for (let i = maxCards - 1; i >= 1; i--) {
    rounds.push(i)
  }

  return ok(rounds)
}

export function validateBid(
  playerId: string,
  bid: number,
  allBids: Record<string, number | null>,
  cardCount: number,
  isLastBidder: boolean
): Result<number, InvalidBidError | BlindRuleViolationError> {
  if (bid < 0 || bid > cardCount) {
    return err({ type: 'InvalidBid', playerId, bid, max: cardCount })
  }

  if (isLastBidder) {
    const otherBidsSum = Object.entries(allBids)
      .filter(([id]) => id !== playerId)
      .reduce((sum, [, b]) => sum + (b ?? 0), 0)

    const forbiddenBid = cardCount - otherBidsSum

    if (forbiddenBid >= 0 && forbiddenBid <= cardCount && bid === forbiddenBid) {
      return err({ type: 'BlindRuleViolation', forbiddenBid, attemptedBid: bid })
    }
  }

  return ok(bid)
}

export function calculateScore(bid: number, tricksWon: number): number {
  if (bid === tricksWon) {
    return 10 + 2 * tricksWon
  }
  return -2 * Math.abs(bid - tricksWon)
}

export function validateTricks(
  tricks: Record<string, number>,
  cardCount: number
): Result<Record<string, number>, TricksDoNotSumError> {
  const total = Object.values(tricks).reduce((sum, t) => sum + t, 0)

  if (total !== cardCount) {
    return err({ type: 'TricksDoNotSum', expected: cardCount, actual: total })
  }

  return ok(tricks)
}

export function scoreRound(
  bids: Record<string, number>,
  tricks: Record<string, number>,
  cardCount: number,
  roundIndex: number
): Result<RoundResult, TricksDoNotSumError> {
  const tricksValidation = validateTricks(tricks, cardCount)
  if (tricksValidation.isErr()) {
    return err(tricksValidation.error)
  }

  const perPlayer: RoundResult['perPlayer'] = {}

  for (const playerId of Object.keys(bids)) {
    const bid = bids[playerId]
    const tricksWon = tricks[playerId]
    const delta = calculateScore(bid, tricksWon)
    const hit = bid === tricksWon

    perPlayer[playerId] = { bid, tricksWon, delta, hit }
  }

  return ok({ roundIndex, cardCount, perPlayer })
}
