import { createServerFn } from '@tanstack/react-start'
import { serializeResult } from '@/lib/serialization'
import { getGameById, getActiveGame, getAllFinishedGames } from '../queries/games'
import { getPlayersByGameId } from '../queries/players'
import { getRoundsByGameId } from '../queries/rounds'
import { getBidsByRoundId, getAllTricksByRoundIds } from '../queries/bids'
import { getSessionGameId } from '../session'
import { ok, err } from 'neverthrow'
import type { GameNotFoundError, DatabaseError } from '@/lib/errors'
import type { GameSnapshot } from '@/stores/gameStore'

export const getGameState = createServerFn({ method: 'GET' })
  .handler(async ({ data }: { data: { gameId: string } }) => {
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

    const game = gameResult.value
    const players = playersResult.value
    const rounds = roundsResult.value

    const roundIds = rounds.filter((r) => r.completed).map((r) => r.id)
    const tricksResult = await getAllTricksByRoundIds(roundIds)
    if (tricksResult.isErr()) return serializeResult(tricksResult)

    const cumulativeScores: Record<string, number> = {}
    for (const p of players) {
      cumulativeScores[p.id] = 0
    }

    const completedRounds = rounds
      .filter((r) => r.completed)
      .map((r) => {
        const perPlayer: Record<string, { bid: number; tricksWon: number; delta: number; hit: boolean }> = {}
        const roundTricks = tricksResult.value.filter((t) => t.roundId === r.id)

        // We need bids too for completed rounds
        // Since we don't have them in the loop context, let's fetch them all at once
        return { roundIndex: r.roundIndex, cardCount: r.cardCount, perPlayer }
      })

    // To properly reconstruct completed rounds with bids, we'd need to fetch all bids.
    // For simplicity, let's fetch bids for each completed round.
    for (const r of rounds.filter((r) => r.completed)) {
      const bidsResult = await getBidsByRoundId(r.id)
      if (bidsResult.isErr()) return serializeResult(bidsResult)
      const roundTricks = tricksResult.value.filter((t) => t.roundId === r.id)

      const perPlayer: Record<string, { bid: number; tricksWon: number; delta: number; hit: boolean }> = {}
      for (const p of players) {
        const bid = bidsResult.value[p.id] ?? 0
        const trick = roundTricks.find((t) => t.playerId === p.id)
        const tricksWon = trick?.tricksWon ?? 0
        const delta = trick?.scoreDelta ?? 0
        const hit = bid === tricksWon
        perPlayer[p.id] = { bid, tricksWon, delta, hit }
        cumulativeScores[p.id] = trick?.cumulativeScore ?? 0
      }
      const cr = completedRounds.find((cr) => cr.roundIndex === r.roundIndex)
      if (cr) cr.perPlayer = perPlayer
    }

    const currentRound = rounds.find((r) => r.roundIndex === game.currentRoundIndex)
    let currentBids: Record<string, number> | null = null
    if (currentRound && !currentRound.completed) {
      const bidsResult = await getBidsByRoundId(currentRound.id)
      if (bidsResult.isOk()) {
        const b = bidsResult.value
        if (Object.keys(b).length > 0) {
          currentBids = b
        }
      }
    }

    let phase: GameSnapshot['phase'] = 'bidding'
    if (game.status === 'finished') {
      phase = 'finished'
    } else if (currentRound?.completed) {
      phase = 'bidding'
    } else if (currentBids && Object.keys(currentBids).length === players.length) {
      phase = 'awaiting_tricks'
    } else {
      phase = 'bidding'
    }

    const snapshot: GameSnapshot = {
      game: {
        id: game.id,
        createdAt: game.createdAt.toISOString(),
        status: game.status,
        dealerStartIndex: game.dealerStartIndex,
        currentRoundIndex: game.currentRoundIndex,
      },
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        turnOrder: p.turnOrder,
        colorIndex: p.colorIndex,
      })),
      rounds: rounds.map((r) => r.cardCount),
      currentRoundIndex: game.currentRoundIndex,
      completedRounds,
      cumulativeScores,
      currentBids,
      phase,
    }

    return serializeResult(ok(snapshot))
  })

export const getActiveGameForSession = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sessionGameId = getSessionGameId()
    if (!sessionGameId) {
      return serializeResult(ok(null))
    }

    const gameResult = await getGameById(sessionGameId)
    if (gameResult.isErr()) {
      return serializeResult(ok(null))
    }

    if (gameResult.value.status !== 'active') {
      return serializeResult(ok(null))
    }

    return serializeResult(ok({ gameId: sessionGameId }))
  })

export const getHistory = createServerFn({ method: 'GET' })
  .handler(async () => {
    const gamesResult = await getAllFinishedGames()
    if (gamesResult.isErr()) return serializeResult(gamesResult)

    const history = []
    for (const game of gamesResult.value) {
      const playersResult = await getPlayersByGameId(game.id)
      if (playersResult.isErr()) continue

      const roundsResult = await getRoundsByGameId(game.id)
      if (roundsResult.isErr()) continue

      const roundIds = roundsResult.value.filter((r) => r.completed).map((r) => r.id)
      const tricksResult = await getAllTricksByRoundIds(roundIds)
      if (tricksResult.isErr()) continue

      const playerScores: Record<string, number> = {}
      for (const p of playersResult.value) {
        playerScores[p.id] = 0
      }
      for (const t of tricksResult.value) {
        playerScores[t.playerId] = t.cumulativeScore
      }

      let winnerId = ''
      let winnerScore = -Infinity
      for (const [pid, score] of Object.entries(playerScores)) {
        if (score > winnerScore) {
          winnerScore = score
          winnerId = pid
        }
      }

      const winner = playersResult.value.find((p) => p.id === winnerId)

      history.push({
        gameId: game.id,
        date: game.createdAt.toISOString(),
        playerNames: playersResult.value.map((p) => p.name),
        winnerName: winner?.name ?? 'Onbekend',
        winnerScore,
      })
    }

    return serializeResult(ok(history))
  })
