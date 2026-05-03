import { ok, err, type Result } from 'neverthrow'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { games, players, rounds, bids, tricks } from '../db/schema'
import type { Game, Player, Round, Bid, Trick } from '../db/schema'
import type { DatabaseError, GameNotFoundError } from '~/lib/errors'
import { Errors } from '~/lib/errors'

export type { Game, Player, Round, Bid, Trick }

export function getGameById(gameId: string): Result<Game, GameNotFoundError | DatabaseError> {
  try {
    const game = db.select().from(games).where(eq(games.id, gameId)).get()
    if (!game) return err(Errors.gameNotFound(gameId))
    return ok(game)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function getPlayersByGame(gameId: string): Result<Player[], DatabaseError> {
  try {
    const result = db.select().from(players).where(eq(players.gameId, gameId)).all()
    return ok(result.sort((a, b) => a.turnOrder - b.turnOrder))
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function getRoundsByGame(gameId: string): Result<Round[], DatabaseError> {
  try {
    const result = db.select().from(rounds).where(eq(rounds.gameId, gameId)).all()
    return ok(result.sort((a, b) => a.roundIndex - b.roundIndex))
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function getBidsByRound(roundId: string): Result<Bid[], DatabaseError> {
  try {
    const result = db.select().from(bids).where(eq(bids.roundId, roundId)).all()
    return ok(result)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function getTricksByRound(roundId: string): Result<Trick[], DatabaseError> {
  try {
    const result = db.select().from(tricks).where(eq(tricks.roundId, roundId)).all()
    return ok(result)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function getAllFinishedGames(): Result<Game[], DatabaseError> {
  try {
    const result = db.select().from(games).where(eq(games.status, 'finished')).all()
    return ok(result.sort((a, b) => b.createdAt - a.createdAt))
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function createGameRow(data: {
  id: string
  createdAt: number
  dealerStartIndex: number
}): Result<Game, DatabaseError> {
  try {
    db.insert(games).values({
      id: data.id,
      createdAt: data.createdAt,
      status: 'active',
      dealerStartIndex: data.dealerStartIndex,
      currentRoundIndex: 0,
    }).run()
    const game = db.select().from(games).where(eq(games.id, data.id)).get()
    if (!game) return err(Errors.database('Game insert failed'))
    return ok(game)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function createPlayerRows(playerData: Array<{
  id: string
  gameId: string
  name: string
  turnOrder: number
  colorIndex: number
}>): Result<void, DatabaseError> {
  try {
    db.insert(players).values(playerData).run()
    return ok(undefined)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function createRoundRows(roundData: Array<{
  id: string
  gameId: string
  roundIndex: number
  cardCount: number
}>): Result<void, DatabaseError> {
  try {
    db.insert(rounds).values(roundData.map(r => ({ ...r, completed: false }))).run()
    return ok(undefined)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function insertBids(bidData: Array<{
  id: string
  roundId: string
  playerId: string
  bidAmount: number
}>): Result<void, DatabaseError> {
  try {
    db.insert(bids).values(bidData).run()
    return ok(undefined)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function insertTricks(trickData: Array<{
  id: string
  roundId: string
  playerId: string
  tricksWon: number
  scoreDelta: number
  cumulativeScore: number
}>): Result<void, DatabaseError> {
  try {
    db.insert(tricks).values(trickData).run()
    return ok(undefined)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function markRoundCompleted(roundId: string): Result<void, DatabaseError> {
  try {
    db.update(rounds).set({ completed: true }).where(eq(rounds.id, roundId)).run()
    return ok(undefined)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function advanceGameRound(gameId: string, nextRoundIndex: number): Result<void, DatabaseError> {
  try {
    db.update(games).set({ currentRoundIndex: nextRoundIndex }).where(eq(games.id, gameId)).run()
    return ok(undefined)
  } catch (e) {
    return err(Errors.database(e))
  }
}

export function finishGame(gameId: string): Result<void, DatabaseError> {
  try {
    db.update(games).set({ status: 'finished' }).where(eq(games.id, gameId)).run()
    return ok(undefined)
  } catch (e) {
    return err(Errors.database(e))
  }
}
