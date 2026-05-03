import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { validatePlayerNames } from '~/lib/game-logic'
import { generateRounds } from '~/lib/rounds'
import {
  createGameRow,
  createPlayerRows,
  createRoundRows,
} from '../queries/games'
import type { DatabaseError, ValidationError } from '~/lib/errors'
import type { SerializedResult } from '~/lib/serialized-result'
import { setCookie } from '@tanstack/react-start/server'

const inputSchema = z.object({
  playerNames: z.array(z.string()),
})

type CreateGameResult = SerializedResult<{ gameId: string }, ValidationError | DatabaseError>

export const createGame = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<CreateGameResult> => {
    const namesResult = validatePlayerNames(data.playerNames)
    if (namesResult.isErr()) return { success: false, error: namesResult.error }

    const names = namesResult.value
    const roundsResult = generateRounds(names.length)
    if (roundsResult.isErr()) return { success: false, error: roundsResult.error }

    const roundPyramid = roundsResult.value
    const gameId = nanoid()
    const now = Date.now()

    const gameResult = createGameRow({ id: gameId, createdAt: now, dealerStartIndex: 0 })
    if (gameResult.isErr()) return { success: false, error: gameResult.error }

    const playerData = names.map((name, i) => ({
      id: nanoid(),
      gameId,
      name,
      turnOrder: i,
      colorIndex: i % 8,
    }))

    const playersResult = createPlayerRows(playerData)
    if (playersResult.isErr()) return { success: false, error: playersResult.error }

    const roundData = roundPyramid.map((cardCount, roundIndex) => ({
      id: nanoid(),
      gameId,
      roundIndex,
      cardCount,
    }))

    const roundsDbResult = createRoundRows(roundData)
    if (roundsDbResult.isErr()) return { success: false, error: roundsDbResult.error }

    setCookie('bb_session_game_id', gameId, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    })

    return { success: true, data: { gameId } }
  })
