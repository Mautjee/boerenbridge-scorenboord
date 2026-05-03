import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { validateBid } from '~/lib/game-logic'
import {
  getGameById,
  getRoundsByGame,
  getPlayersByGame,
  getBidsByRound,
  insertBids,
} from '../queries/games'
import type { DatabaseError, BlindRuleViolationError, InvalidBidError } from '~/lib/errors'
import { Errors } from '~/lib/errors'
import type { SerializedResult } from '~/lib/serialized-result'

const inputSchema = z.object({
  gameId: z.string(),
  roundIndex: z.number(),
  bids: z.record(z.string(), z.number()),
})

type SubmitBidsResult = SerializedResult<void, BlindRuleViolationError | InvalidBidError | DatabaseError>

export const submitBids = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitBidsResult> => {
    const gameResult = getGameById(data.gameId)
    if (gameResult.isErr()) return { success: false, error: Errors.database(gameResult.error) }

    const roundsResult = getRoundsByGame(data.gameId)
    if (roundsResult.isErr()) return { success: false, error: roundsResult.error }

    const playersResult = getPlayersByGame(data.gameId)
    if (playersResult.isErr()) return { success: false, error: playersResult.error }

    const players = playersResult.value
    const dbRound = roundsResult.value.find(r => r.roundIndex === data.roundIndex)
    if (!dbRound) return { success: false, error: Errors.database('Round not found') }

    const cardCount = dbRound.cardCount

    const game = gameResult.value
    const dealerIndex = (game.dealerStartIndex + data.roundIndex) % players.length
    const lastBidderIndex = dealerIndex
    const orderedPlayers = [...players].sort((a, b) => {
      const aOffset = (a.turnOrder - lastBidderIndex - 1 + players.length) % players.length
      const bOffset = (b.turnOrder - lastBidderIndex - 1 + players.length) % players.length
      return aOffset - bOffset
    })

    const allBids: Record<string, number | null> = { ...data.bids }
    for (let i = 0; i < orderedPlayers.length; i++) {
      const player = orderedPlayers[i]!
      const bid = data.bids[player.id]
      if (bid === undefined || bid === null) {
        return { success: false, error: Errors.invalidBid(player.id, -1, cardCount) }
      }
      const isLast = i === orderedPlayers.length - 1
      const bidResult = validateBid(player.id, bid, allBids, cardCount, isLast)
      if (bidResult.isErr()) return { success: false, error: bidResult.error }
    }

    const existingBids = getBidsByRound(dbRound.id)
    if (existingBids.isOk() && existingBids.value.length > 0) {
      return { success: true, data: undefined }
    }

    const bidData = Object.entries(data.bids).map(([playerId, bidAmount]) => ({
      id: nanoid(),
      roundId: dbRound.id,
      playerId,
      bidAmount: bidAmount as number,
    }))

    const insertResult = insertBids(bidData)
    if (insertResult.isErr()) return { success: false, error: insertResult.error }
    return { success: true, data: undefined }
  })
