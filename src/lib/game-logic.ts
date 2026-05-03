import { ok, err, type Result } from 'neverthrow'
import type {
  InvalidBidError,
  BlindRuleViolationError,
  TricksDoNotSumError,
  ValidationError,
} from './errors'
import { Errors } from './errors'
import { calculateScore } from './scoring'

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

/**
 * Validate a single bid.
 * The last bidder (dealer/blind) may not bid the forbidden value
 * (which would make the total sum equal to cardCount).
 */
export function validateBid(
  playerId: string,
  bid: number,
  allBids: Record<string, number | null>,
  cardCount: number,
  isLastBidder: boolean,
): Result<number, InvalidBidError | BlindRuleViolationError> {
  if (bid < 0 || bid > cardCount || !Number.isInteger(bid)) {
    return err(Errors.invalidBid(playerId, bid, cardCount))
  }

  if (isLastBidder) {
    const otherBidsSum = Object.entries(allBids)
      .filter(([id]) => id !== playerId)
      .reduce((sum, [, b]) => sum + (b ?? 0), 0)

    const forbidden = cardCount - otherBidsSum

    if (forbidden >= 0 && forbidden <= cardCount && bid === forbidden) {
      return err(Errors.blindRuleViolation(forbidden, bid))
    }
  }

  return ok(bid)
}

/**
 * Compute the forbidden bid for the last bidder given other bids so far.
 * Returns null if no forbidden bid exists (sum already exceeds or meets cardCount).
 */
export function computeForbiddenBid(
  otherBids: (number | null)[],
  cardCount: number,
): number | null {
  const sum = otherBids.reduce<number>((s, b) => s + (b ?? 0), 0)
  const forbidden = cardCount - sum
  if (forbidden >= 0 && forbidden <= cardCount) return forbidden
  return null
}

/**
 * Validate that the sum of all tricks equals the card count.
 */
export function validateTricks(
  tricks: Record<string, number>,
  cardCount: number,
): Result<Record<string, number>, TricksDoNotSumError> {
  const total = Object.values(tricks).reduce((s, t) => s + t, 0)
  if (total !== cardCount) {
    return err(Errors.tricksDoNotSum(cardCount, total))
  }
  return ok(tricks)
}

/**
 * Score a complete round.
 */
export function scoreRound(
  bids: Record<string, number>,
  tricks: Record<string, number>,
  cardCount: number,
  roundIndex: number,
): Result<RoundResult, TricksDoNotSumError> {
  return validateTricks(tricks, cardCount).map((validTricks) => {
    const perPlayer: RoundResult['perPlayer'] = {}
    for (const playerId of Object.keys(bids)) {
      const bid = bids[playerId] ?? 0
      const tricksWon = validTricks[playerId] ?? 0
      const delta = calculateScore(bid, tricksWon)
      perPlayer[playerId] = { bid, tricksWon, delta, hit: bid === tricksWon }
    }
    return { roundIndex, cardCount, perPlayer }
  })
}

/**
 * Validate all player names for game creation.
 */
export function validatePlayerNames(names: string[]): Result<string[], ValidationError> {
  if (names.length < 2) {
    return err(Errors.validation('players', 'Minimaal 2 spelers vereist'))
  }
  if (names.length > 26) {
    return err(Errors.validation('players', 'Maximaal 26 spelers toegestaan'))
  }
  for (const name of names) {
    if (!name.trim()) {
      return err(Errors.validation('players', 'Spelernaam mag niet leeg zijn'))
    }
  }
  const lower = names.map(n => n.trim().toLowerCase())
  const unique = new Set(lower)
  if (unique.size !== lower.length) {
    return err(Errors.validation('players', 'Spelernamen moeten uniek zijn'))
  }
  return ok(names.map(n => n.trim()))
}
