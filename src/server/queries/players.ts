import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { players } from '../db/schema'
import type { DatabaseError } from '@/lib/errors'
import { err, ok, type Result } from 'neverthrow'

export async function createPlayers(
  gameId: string,
  names: string[]
): Promise<Result<void, DatabaseError>> {
  try {
    const rows = names.map((name, i) => ({
      id: `${gameId}-p${i}`,
      gameId,
      name,
      turnOrder: i,
      colorIndex: i % 8,
    }))
    await db.insert(players).values(rows)
    return ok(undefined)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getPlayersByGameId(
  gameId: string
): Promise<Result<typeof players.$inferSelect[], DatabaseError>> {
  try {
    const rows = await db.select().from(players).where(eq(players.gameId, gameId)).orderBy(players.turnOrder).all()
    return ok(rows)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}
