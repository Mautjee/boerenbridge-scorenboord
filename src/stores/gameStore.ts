import { create } from 'zustand'
import type { RoundResult } from '@/lib/game-logic'

export interface Player {
  id: string
  name: string
  turnOrder: number
  colorIndex: number
}

export interface GameSnapshot {
  game: {
    id: string
    createdAt: string
    status: 'active' | 'finished'
    dealerStartIndex: number
    currentRoundIndex: number
  }
  players: Player[]
  rounds: number[]
  currentRoundIndex: number
  completedRounds: RoundResult[]
  cumulativeScores: Record<string, number>
  currentBids: Record<string, number> | null
  phase: 'bidding' | 'awaiting_tricks' | 'finished'
}

type GamePhase = 'idle' | 'active_bidding' | 'active_awaiting_tricks' | 'active_scoring' | 'finished'

interface GameStore {
  gameId: string | null
  players: Player[]
  rounds: number[]
  currentRoundIndex: number
  history: RoundResult[]
  cumulativeScores: Record<string, number>
  bidDraft: Record<string, number | null>
  tricksDraft: Record<string, number | null>
  phase: GamePhase
  isSubmitting: boolean
  lastRoundDeltas: Record<string, number> | null

  setPlayers: (players: Player[]) => void
  hydrateFromServer: (snapshot: GameSnapshot) => void
  setBidDraft: (playerId: string, value: number | null) => void
  setTricksDraft: (playerId: string, value: number | null) => void
  applyRoundResult: (result: RoundResult) => void
  setPhase: (phase: GamePhase) => void
  setIsSubmitting: (val: boolean) => void
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
  phase: 'idle' as GamePhase,
  isSubmitting: false,
  lastRoundDeltas: null,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setPlayers: (players) => set({ players }),

  hydrateFromServer: (snapshot) => {
    const bidDraft: Record<string, number | null> = {}
    const tricksDraft: Record<string, number | null> = {}

    for (const p of snapshot.players) {
      bidDraft[p.id] = snapshot.currentBids?.[p.id] ?? null
      tricksDraft[p.id] = null
    }

    let phase: GamePhase = 'idle'
    if (snapshot.phase === 'finished') {
      phase = 'finished'
    } else if (snapshot.phase === 'awaiting_tricks') {
      phase = 'active_awaiting_tricks'
    } else if (snapshot.phase === 'bidding') {
      phase = 'active_bidding'
    }

    set({
      gameId: snapshot.game.id,
      players: snapshot.players,
      rounds: snapshot.rounds,
      currentRoundIndex: snapshot.currentRoundIndex,
      history: snapshot.completedRounds,
      cumulativeScores: snapshot.cumulativeScores,
      bidDraft,
      tricksDraft,
      phase,
      isSubmitting: false,
      lastRoundDeltas: null,
    })
  },

  setBidDraft: (playerId, value) =>
    set((state) => ({
      bidDraft: { ...state.bidDraft, [playerId]: value },
    })),

  setTricksDraft: (playerId, value) =>
    set((state) => ({
      tricksDraft: { ...state.tricksDraft, [playerId]: value },
    })),

  applyRoundResult: (result) =>
    set((state) => {
      const newCumulative = { ...state.cumulativeScores }
      const deltas: Record<string, number> = {}
      for (const [pid, data] of Object.entries(result.perPlayer)) {
        newCumulative[pid] = (newCumulative[pid] ?? 0) + data.delta
        deltas[pid] = data.delta
      }
      return {
        history: [...state.history, result],
        cumulativeScores: newCumulative,
        currentRoundIndex: state.currentRoundIndex + 1,
        bidDraft: {},
        tricksDraft: {},
        lastRoundDeltas: deltas,
      }
    }),

  setPhase: (phase) => set({ phase }),

  setIsSubmitting: (val) => set({ isSubmitting: val }),

  reset: () => set(initialState),
}))
