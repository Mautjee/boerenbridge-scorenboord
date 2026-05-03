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
  cause: unknown
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
