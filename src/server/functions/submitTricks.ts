import { createServerFn } from '@tanstack/react-start'
import { scoreRound } from '@/lib/game-logic'
import { serializeResult } from '@/lib/serialization'
import { getGameById, updateGameStatus } from '../queries/games'
import { getPlayersByGameId } from '../queries/players'
import { getRoundsByGameId, markRoundCompleted } from '../queries/rounds'
import { createTricks, getAllTricksByRoundIds } from '../queries/bids'
import { getSessionGameId } from '../session'
import { ok, err } from 'neverthrow'
import type { GameNotFoundError, DatabaseError, TricksDoNotSumError } from '@/lib/errors'

export const submitTricks = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: { gameId: string; roundIndex: number; tricks: Record<string, number> } }) => {
    const sessionGameId = getSessionGameId()
    if (sessionGameId !== data.gameId) {
      return serializeResult(err<never, GameNotFoundError>({ type: 'GameNotFound', gameId: data.gameId }))
    }

    const gameResult = await getGameById(data.gameId)
    if (gameResult.isErr()) return serializeResult(gameResult)

    const playersResult = await getPlayersByGameId(data.gameId)
    if (playersResult.isErr()) return serializeResult(playersResult)

    const roundsResult = await getRoundsByGameId(data.gameId)
    if (roundsResult.isErr()) return serializeResult(roundsResult)

    const round = roundsResult.value.find((r) => r.roundIndex === data.roundIndex)
    if (!round) {
      return serializeResult(err<never, GameNotFoundError>({ type: 'GameNotFound', gameId: data.gameId }))
    }

    const playerIds = playersResult.value.map((p) => p.id)
    const cardCount = round.cardCount

    const bids: Record<string, number> = {}
    // We need bids for scoring. For simplicity, fetch from DB or assume passed.
    // Actually, bids were stored in DB by submitBids.
    // Let's fetch them via the bids query.
    // I'll import getBidsByRoundId
    const { getBidsByRoundId } = await import('../queries/bids')
    const bidsResult = await getBidsByRoundId(round.id)
    if (bidsResult.isErr()) return serializeResult(bidsResult)

    const bidMap = bidsResult.value

    const scoringResult = scoreRound(bidMap, data.tricks, cardCount, data.roundIndex)
    if (scoringResult.isErr()) return serializeResult(scoringResult)

    // Compute cumulative scores
    const completedRoundIds = roundsResult.value
      .filter((r) => r.completed && r.roundIndex < data.roundIndex)
      .map((r) => r.id)

    const prevTricksResult = await getAllTricksByRoundIds(completedRoundIds)
    if (prevTricksResult.isErr()) return serializeResult(prevTricksResult)

    const cumulative: Record<string, number> = {}
    for (const pid of playerIds) {
      cumulative[pid] = 0
    }
    for (const t of prevTricksResult.value) {
      cumulative[t.playerId] = t.cumulativeScore
    }

    const trickData: Record<string, { tricksWon: number; scoreDelta: number; cumulativeScore: number }> = {}
    for (const pid of playerIds) {
      const delta = scoringResult.value.perPlayer[pid].delta
      cumulative[pid] += delta
      trickData[pid] = {
        tricksWon: data.tricks[pid],
        scoreDelta: delta,
        cumulativeScore: cumulative[pid],
      }
    }

    const createResult = await createTricks(round.id, trickData)
    if (createResult.isErr()) return serializeResult(createResult)

    const markResult = await markRoundCompleted(round.id)
    if (markResult.isErr()) return serializeResult(markResult)

    const isLastRound = data.roundIndex >= roundsResult.value.length - 1
    if (isLastRound) {
      const finishResult = await updateGameStatus(data.gameId, 'finished')
      if (finishResult.isErr()) return serializeResult(finishResult)
      // Clear session cookie
      const { clearSessionGameId } = await import('../session')
      clearSessionGameId()
    } else {
      const advanceResult = await updateGameStatus(data.gameId, 'active', data.roundIndex + 1)
      if (advanceResult.isErr()) return serializeResult(advanceResult)
    }

    return serializeResult(ok(scoringResult.value))
  })
