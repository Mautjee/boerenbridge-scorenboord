import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { scoreRound } from '~/lib/game-logic'
import type { RoundResult } from '~/lib/game-logic'
import {
  getGameById,
  getRoundsByGame,
  getBidsByRound,
  getTricksByRound,
  insertTricks,
  markRoundCompleted,
  advanceGameRound,
  finishGame,
} from '../queries/games'
import type { DatabaseError, TricksDoNotSumError } from '~/lib/errors'
import { Errors } from '~/lib/errors'
import type { SerializedResult } from '~/lib/serialized-result'
import { setCookie } from '@tanstack/react-start/server'

const inputSchema = z.object({
  gameId: z.string(),
  roundIndex: z.number(),
  tricks: z.record(z.string(), z.number()),
})

type SubmitTricksResult = SerializedResult<RoundResult, TricksDoNotSumError | DatabaseError>

export const submitTricks = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitTricksResult> => {
    const gameResult = getGameById(data.gameId)
    if (gameResult.isErr()) return { success: false, error: Errors.database(gameResult.error) }

    const roundsResult = getRoundsByGame(data.gameId)
    if (roundsResult.isErr()) return { success: false, error: roundsResult.error }

    const dbRound = roundsResult.value.find(r => r.roundIndex === data.roundIndex)
    if (!dbRound) return { success: false, error: Errors.database('Round not found') }

    const bidsResult = getBidsByRound(dbRound.id)
    if (bidsResult.isErr()) return { success: false, error: bidsResult.error }

    const bidsMap: Record<string, number> = {}
    for (const bid of bidsResult.value) {
      bidsMap[bid.playerId] = bid.bidAmount
    }

    const roundResult = scoreRound(bidsMap, data.tricks, dbRound.cardCount, data.roundIndex)
    if (roundResult.isErr()) return { success: false, error: roundResult.error }

    const result = roundResult.value

    const prevCumulative: Record<string, number> = {}
    const prevRounds = roundsResult.value.filter(r => r.roundIndex < data.roundIndex && r.completed)
    for (const prevRound of prevRounds) {
      const prevTricks = getTricksByRound(prevRound.id)
      if (prevTricks.isOk()) {
        for (const t of prevTricks.value) {
          prevCumulative[t.playerId] = t.cumulativeScore
        }
      }
    }

    const trickData = Object.entries(result.perPlayer).map(([playerId, p]) => ({
      id: nanoid(),
      roundId: dbRound.id,
      playerId,
      tricksWon: p.tricksWon,
      scoreDelta: p.delta,
      cumulativeScore: (prevCumulative[playerId] ?? 0) + p.delta,
    }))

    const insertResult = insertTricks(trickData)
    if (insertResult.isErr()) return { success: false, error: insertResult.error }

    markRoundCompleted(dbRound.id)

    const allRounds = roundsResult.value
    const isLastRound = data.roundIndex >= allRounds.length - 1

    if (isLastRound) {
      finishGame(data.gameId)
      setCookie('bb_session_game_id', '', { httpOnly: true, path: '/', maxAge: 0 })
    } else {
      advanceGameRound(data.gameId, data.roundIndex + 1)
    }

    return { success: true, data: result }
  })
