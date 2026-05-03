/**
 * Calculate score for a single player's round.
 * Hit: 10 + 2 * tricksWon
 * Miss: -2 * |bid - tricksWon|
 */
export function calculateScore(bid: number, tricksWon: number): number {
  if (bid === tricksWon) {
    return 10 + 2 * tricksWon
  }
  return -2 * Math.abs(bid - tricksWon)
}
