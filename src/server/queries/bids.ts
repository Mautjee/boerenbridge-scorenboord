import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { bids, tricks } from '../db/schema'
import type { DatabaseError } from '@/lib/errors'
import { err, ok, type Result } from 'neverthrow'

export async function createBids(
  roundId: string,
  bidMap: Record<string, number>
): Promise<Result<void, DatabaseError>> {
  try {
    const rows = Object.entries(bidMap).map(([playerId, bidAmount]) => ({
      id: `${roundId}-b${playerId}`,
      roundId,
      playerId,
      bidAmount,
    }))
    await db.insert(bids).values(rows)
    return ok(undefined)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getBidsByRoundId(
  roundId: string
): Promise<Result<Record<string, number>, DatabaseError>> {
  try {
    const rows = await db.select().from(bids).where(eq(bids.roundId, roundId)).all()
    const map: Record<string, number> = {}
    for (const row of rows) {
      map[row.playerId] = row.bidAmount
    }
    return ok(map)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function createTricks(
  roundId: string,
  results: Record<string, { tricksWon: number; scoreDelta: number; cumulativeScore: number }>
): Promise<Result<void, DatabaseError>> {
  try {
    const rows = Object.entries(results).map(([playerId, data]) => ({
      id: `${roundId}-t${playerId}`,
      roundId,
      playerId,
      tricksWon: data.tricksWon,
      scoreDelta: data.scoreDelta,
      cumulativeScore: data.cumulativeScore,
    }))
    await db.insert(tricks).values(rows)
    return ok(undefined)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getTricksByRoundId(
  roundId: string
): Promise<Result<typeof tricks.$inferSelect[], DatabaseError>> {
  try {
    const rows = await db.select().from(tricks).where(eq(tricks.roundId, roundId)).all()
    return ok(rows)
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}

export async function getAllTricksByRoundIds(
  roundIds: string[]
): Promise<Result<typeof tricks.$inferSelect[], DatabaseError>> {
  try {
    if (roundIds.length === 0) return ok([])
    const placeholders = roundIds.map(() => '?').join(',')
    const rows = await db.all<typeof tricks.$inferSelect[]>(
      `SELECT * FROM tricks WHERE round_id IN (${placeholders})`,
      roundIds
    )
    return ok(rows as typeof tricks.$inferSelect[])
  } catch (e) {
    return err({ type: 'DatabaseError', cause: e })
  }
}
