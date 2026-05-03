import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { generateRounds } from '@/lib/game-logic'
import { serializeResult } from '@/lib/serialization'
import { createGameRow, getGameById, updateGameStatus } from '../queries/games'
import { createPlayers } from '../queries/players'
import { createRounds, getRoundsByGameId } from '../queries/rounds'
import { getBidsByRoundId, getAllTricksByRoundIds } from '../queries/bids'
import { setSessionGameId, getSessionGameId } from '../session'
import { ok, err } from 'neverthrow'
import type { ValidationError, DatabaseError } from '@/lib/errors'

export const createGame = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: { playerNames: string[] } }) => {
    const names = data.playerNames.map((n) => n.trim()).filter(Boolean)

    if (names.length < 2) {
      return serializeResult(err<never, ValidationError>({
        type: 'ValidationError',
        field: 'playerNames',
        message: 'Minimaal 2 spelers nodig',
      }))
    }
    if (names.length > 26) {
      return serializeResult(err<never, ValidationError>({
        type: 'ValidationError',
        field: 'playerNames',
        message: 'Maximaal 26 spelers toegestaan',
      }))
    }
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      return serializeResult(err<never, ValidationError>({
        type: 'ValidationError',
        field: 'playerNames',
        message: 'Dubbele namen zijn niet toegestaan',
      }))
    }

    const roundsResult = generateRounds(names.length)
    if (roundsResult.isErr()) {
      return serializeResult(roundsResult)
    }

    const gameId = nanoid(12)
    const now = new Date()

    const gameResult = await createGameRow({ id: gameId, createdAt: now, dealerStartIndex: 0 })
    if (gameResult.isErr()) return serializeResult(gameResult)

    const playersResult = await createPlayers(gameId, names)
    if (playersResult.isErr()) return serializeResult(playersResult)

    const roundsResult2 = await createRounds(gameId, roundsResult.value)
    if (roundsResult2.isErr()) return serializeResult(roundsResult2)

    setSessionGameId(gameId)

    return serializeResult(ok({ gameId }))
  })
