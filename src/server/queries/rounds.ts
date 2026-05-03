import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { rounds } from '../db/schema'
import type { DatabaseError } from '@/lib/errors'
import { err, ok, type Result } from 'neverthrow'

export async function createRounds(
  gameId: string,
  cardCounts: number[]
): Promise<Result<void, DatabaseError>> {
  try {
    const rows = cardCounts.map((cardCount, i) => ({
      id: `${gameId}-r${i}`,
      gameId,
      roundIndex: i,
      cardCount,
      completed: false,
    }))
    await db.insert(rounds).values(rows)
    return ok(undefined)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getRoundsByGameId(
  gameId: string
): Promise<Result<typeof rounds.$inferSelect[], DatabaseError>> {
  try {
    const rows = await db.select().from(rounds).where(eq(rounds.gameId, gameId)).orderBy(rounds.roundIndex).all()
    return ok(rows)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function markRoundCompleted(
  roundId: string
): Promise<Result<void, DatabaseError>> {
  try {
    await db.update(rounds).set({ completed: true }).where(eq(rounds.id, roundId))
    return ok(undefined)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}
