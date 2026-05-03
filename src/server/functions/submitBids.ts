import { createServerFn } from '@tanstack/react-start'
import { validateBid } from '@/lib/game-logic'
import { serializeResult } from '@/lib/serialization'
import { getGameById } from '../queries/games'
import { getPlayersByGameId } from '../queries/players'
import { getRoundsByGameId } from '../queries/rounds'
import { createBids } from '../queries/bids'
import { getSessionGameId } from '../session'
import { ok, err } from 'neverthrow'
import type { BlindRuleViolationError, InvalidBidError, DatabaseError, GameNotFoundError } from '@/lib/errors'

export const submitBids = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: { gameId: string; roundIndex: number; bids: Record<string, number> } }) => {
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
    const dealerIndex = gameResult.value.dealerStartIndex
    const lastBidderId = playerIds[(data.roundIndex + dealerIndex) % playerIds.length]

    const allBids: Record<string, number | null> = {}
    for (const pid of playerIds) {
      allBids[pid] = data.bids[pid] ?? null
    }

    for (const pid of playerIds) {
      const bid = data.bids[pid]
      if (bid === undefined || bid === null) {
        return serializeResult(err<never, InvalidBidError>({
          type: 'InvalidBid',
          playerId: pid,
          bid: -1,
          max: cardCount,
        }))
      }
      const validation = validateBid(pid, bid, allBids, cardCount, pid === lastBidderId)
      if (validation.isErr()) {
        return serializeResult(validation)
      }
    }

    const createResult = await createBids(round.id, data.bids)
    if (createResult.isErr()) return serializeResult(createResult)

    return serializeResult(ok(undefined))
  })
