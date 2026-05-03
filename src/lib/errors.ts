// Typed error hierarchy — no thrown exceptions in business logic

export interface GameNotFoundError {
  type: 'GameNotFound'
  gameId: string
}

export interface InvalidBidError {
  type: 'InvalidBid'
  playerId: string
  bid: number
  max: number
}

export interface BlindRuleViolationError {
  type: 'BlindRuleViolation'
  forbiddenBid: number
  attemptedBid: number
}

export interface TricksDoNotSumError {
  type: 'TricksDoNotSum'
  expected: number
  actual: number
}

export interface DatabaseError {
  type: 'DatabaseError'
  cause: string
}

export interface ValidationError {
  type: 'ValidationError'
  field: string
  message: string
}

export interface RoundAlreadyCompletedError {
  type: 'RoundAlreadyCompleted'
  roundIndex: number
}

export type AppError =
  | GameNotFoundError
  | InvalidBidError
  | BlindRuleViolationError
  | TricksDoNotSumError
  | DatabaseError
  | ValidationError
  | RoundAlreadyCompletedError

// Constructors
export const Errors = {
  gameNotFound: (gameId: string): GameNotFoundError => ({ type: 'GameNotFound', gameId }),
  invalidBid: (playerId: string, bid: number, max: number): InvalidBidError => ({ type: 'InvalidBid', playerId, bid, max }),
  blindRuleViolation: (forbiddenBid: number, attemptedBid: number): BlindRuleViolationError => ({ type: 'BlindRuleViolation', forbiddenBid, attemptedBid }),
  tricksDoNotSum: (expected: number, actual: number): TricksDoNotSumError => ({ type: 'TricksDoNotSum', expected, actual }),
  database: (cause: unknown): DatabaseError => ({ type: 'DatabaseError', cause: String(cause) }),
  validation: (field: string, message: string): ValidationError => ({ type: 'ValidationError', field, message }),
  roundAlreadyCompleted: (roundIndex: number): RoundAlreadyCompletedError => ({ type: 'RoundAlreadyCompleted', roundIndex }),
}
