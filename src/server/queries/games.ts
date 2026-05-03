import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { games } from '../db/schema'
import type { GameNotFoundError, DatabaseError } from '@/lib/errors'
import { err, ok, type Result } from 'neverthrow'

export async function createGameRow(data: {
  id: string
  createdAt: Date
  dealerStartIndex: number
}): Promise<Result<void, DatabaseError>> {
  try {
    await db.insert(games).values({
      id: data.id,
      createdAt: data.createdAt,
      status: 'active',
      dealerStartIndex: data.dealerStartIndex,
      currentRoundIndex: 0,
    })
    return ok(undefined)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getGameById(
  id: string
): Promise<Result<typeof games.$inferSelect, GameNotFoundError | DatabaseError>> {
  try {
    const game = await db.select().from(games).where(eq(games.id, id)).get()
    if (!game) {
      return err({ type: 'GameNotFound', gameId: id })
    }
    return ok(game)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function updateGameStatus(
  id: string,
  status: 'active' | 'finished',
  currentRoundIndex?: number
): Promise<Result<void, DatabaseError>> {
  try {
    await db
      .update(games)
      .set({ status, ...(currentRoundIndex !== undefined ? { currentRoundIndex } : {}) })
      .where(eq(games.id, id))
    return ok(undefined)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getActiveGame(): Promise<Result<typeof games.$inferSelect | null, DatabaseError>> {
  try {
    const game = await db.select().from(games).where(eq(games.status, 'active')).get()
    return ok(game ?? null)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getAllFinishedGames(): Promise<Result<typeof games.$inferSelect[], DatabaseError>> {
  try {
    const rows = await db.select().from(games).where(eq(games.status, 'finished')).all()
    return ok(rows)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}
