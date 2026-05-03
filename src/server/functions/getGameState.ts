import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getGameById,
  getRoundsByGame,
  getPlayersByGame,
  getBidsByRound,
  getTricksByRound,
} from '../queries/games'
import type { GameSnapshot } from '../types'
import type { RoundResult } from '~/lib/game-logic'
import type { DatabaseError, GameNotFoundError } from '~/lib/errors'
import type { SerializedResult } from '~/lib/serialized-result'

const inputSchema = z.object({ gameId: z.string() })

export const getGameState = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SerializedResult<GameSnapshot, GameNotFoundError | DatabaseError>> => {
    const gameResult = getGameById(data.gameId)
    if (gameResult.isErr()) return { success: false, error: gameResult.error }

    const game = gameResult.value

    const playersResult = getPlayersByGame(data.gameId)
    if (playersResult.isErr()) return { success: false, error: playersResult.error }

    const roundsResult = getRoundsByGame(data.gameId)
    if (roundsResult.isErr()) return { success: false, error: roundsResult.error }

    const dbRounds = roundsResult.value
    const rounds = dbRounds.map(r => r.cardCount)

    const completedRounds: RoundResult[] = []
    const cumulativeScores: Record<string, number> = {}

    for (const player of playersResult.value) {
      cumulativeScores[player.id] = 0
    }

    for (const dbRound of dbRounds) {
      if (!dbRound.completed) continue

      const bidsResult = getBidsByRound(dbRound.id)
      const tricksResult = getTricksByRound(dbRound.id)

      if (bidsResult.isErr() || tricksResult.isErr()) continue

      const bidsMap: Record<string, number> = {}
      for (const b of bidsResult.value) bidsMap[b.playerId] = b.bidAmount

      const tricksMap: Record<string, { tricksWon: number; scoreDelta: number; cumulativeScore: number }> = {}
      for (const t of tricksResult.value) {
        tricksMap[t.playerId] = { tricksWon: t.tricksWon, scoreDelta: t.scoreDelta, cumulativeScore: t.cumulativeScore }
        cumulativeScores[t.playerId] = t.cumulativeScore
      }

      const perPlayer: RoundResult['perPlayer'] = {}
      for (const playerId of Object.keys(bidsMap)) {
        const bid = bidsMap[playerId] ?? 0
        const trickData = tricksMap[playerId]
        if (!trickData) continue
        perPlayer[playerId] = {
          bid,
          tricksWon: trickData.tricksWon,
          delta: trickData.scoreDelta,
          hit: bid === trickData.tricksWon,
        }
      }

      completedRounds.push({
        roundIndex: dbRound.roundIndex,
        cardCount: dbRound.cardCount,
        perPlayer,
      })
    }

    let currentBids: Record<string, number> | null = null
    let phase: GameSnapshot['phase'] = 'bidding'

    if (game.status === 'finished') {
      phase = 'finished'
    } else {
      const currentDbRound = dbRounds.find(r => r.roundIndex === game.currentRoundIndex)
      if (currentDbRound) {
        const bidsResult = getBidsByRound(currentDbRound.id)
        if (bidsResult.isOk() && bidsResult.value.length > 0) {
          currentBids = {}
          for (const b of bidsResult.value) currentBids[b.playerId] = b.bidAmount
          phase = 'awaiting_tricks'
        }
      }
    }

    return {
      success: true,
      data: {
        game,
        players: playersResult.value,
        rounds,
        currentRoundIndex: game.currentRoundIndex,
        completedRounds,
        cumulativeScores,
        currentBids,
        phase,
      },
    }
  })
