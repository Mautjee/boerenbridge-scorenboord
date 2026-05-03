import { create } from 'zustand'
import type { Player } from '~/server/db/schema'
import type { RoundResult } from '~/lib/game-logic'
import type { GameSnapshot, GamePhase } from '~/server/types'

interface GameStore {
  // Hydrated from server
  gameId: string | null
  players: Player[]
  rounds: number[]
  currentRoundIndex: number
  history: RoundResult[]
  cumulativeScores: Record<string, number>

  // Transient bid/tricks entry state
  bidDraft: Record<string, number | null>
  tricksDraft: Record<string, number | null>

  // UI state
  phase: GamePhase
  isSubmitting: boolean
  lastRoundDeltas: Record<string, number> | null

  // Actions
  setPlayers: (players: Player[]) => void
  hydrateFromServer: (snapshot: GameSnapshot) => void
  setBidDraft: (playerId: string, value: number | null) => void
  setTricksDraft: (playerId: string, value: number | null) => void
  setIsSubmitting: (v: boolean) => void
  applyRoundResult: (result: RoundResult) => void
  reset: () => void
}

const initialState = {
  gameId: null,
  players: [],
  rounds: [],
  currentRoundIndex: 0,
  history: [],
  cumulativeScores: {},
  bidDraft: {},
  tricksDraft: {},
  phase: 'bidding' as GamePhase,
  isSubmitting: false,
  lastRoundDeltas: null,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setPlayers: (players) => set({ players }),

  hydrateFromServer: (snapshot) => {
    const bidDraft: Record<string, number | null> = {}
    const tricksDraft: Record<string, number | null> = {}
    for (const player of snapshot.players) {
      bidDraft[player.id] = snapshot.currentBids?.[player.id] ?? null
      tricksDraft[player.id] = null
    }
    set({
      gameId: snapshot.game.id,
      players: snapshot.players,
      rounds: snapshot.rounds,
      currentRoundIndex: snapshot.currentRoundIndex,
      history: snapshot.completedRounds,
      cumulativeScores: snapshot.cumulativeScores,
      phase: snapshot.phase,
      bidDraft,
      tricksDraft,
      lastRoundDeltas: null,
    })
  },

  setBidDraft: (playerId, value) =>
    set((state) => ({ bidDraft: { ...state.bidDraft, [playerId]: value } })),

  setTricksDraft: (playerId, value) =>
    set((state) => ({ tricksDraft: { ...state.tricksDraft, [playerId]: value } })),

  setIsSubmitting: (v) => set({ isSubmitting: v }),

  applyRoundResult: (result) =>
    set((state) => {
      const newCumulative = { ...state.cumulativeScores }
      const deltas: Record<string, number> = {}
      for (const [playerId, data] of Object.entries(result.perPlayer)) {
        newCumulative[playerId] = (newCumulative[playerId] ?? 0) + data.delta
        deltas[playerId] = data.delta
      }
      return {
        history: [...state.history, result],
        cumulativeScores: newCumulative,
        currentRoundIndex: state.currentRoundIndex + 1,
        lastRoundDeltas: deltas,
        bidDraft: {},
        tricksDraft: {},
        phase: 'bidding',
      }
    }),

  reset: () => set(initialState),
}))
