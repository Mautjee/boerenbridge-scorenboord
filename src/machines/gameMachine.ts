import { setup, assign, fromPromise } from 'xstate'
import type { RoundResult } from '~/lib/game-logic'

export interface GameMachineContext {
  gameId: string
  currentRoundIndex: number
  totalRounds: number
  dealerIndex: number
  playerIds: string[]
}

export type GameMachineEvent =
  | { type: 'GAME_LOADED'; context: Partial<GameMachineContext> }
  | { type: 'ALL_BIDS_SUBMITTED' }
  | { type: 'ALL_TRICKS_SUBMITTED'; result: RoundResult }
  | { type: 'ROUND_COMPLETE' }
  | { type: 'NEW_GAME' }

export const gameMachine = setup({
  types: {
    context: {} as GameMachineContext,
    events: {} as GameMachineEvent,
  },
  guards: {
    hasMoreRounds: ({ context }) =>
      context.currentRoundIndex < context.totalRounds - 1,
  },
  actions: {
    advanceDealerIndex: assign({
      dealerIndex: ({ context }) =>
        (context.dealerIndex + 1) % Math.max(context.playerIds.length, 1),
    }),
    advanceRoundIndex: assign({
      currentRoundIndex: ({ context }) => context.currentRoundIndex + 1,
    }),
    loadContext: assign(({ context, event }) => {
      if (event.type !== 'GAME_LOADED') return context
      return { ...context, ...event.context }
    }),
  },
}).createMachine({
  id: 'game',
  initial: 'idle',
  context: {
    gameId: '',
    currentRoundIndex: 0,
    totalRounds: 0,
    dealerIndex: 0,
    playerIds: [],
  },
  states: {
    idle: {
      on: {
        GAME_LOADED: {
          target: 'active',
          actions: 'loadContext',
        },
      },
    },
    active: {
      initial: 'bidding',
      states: {
        bidding: {
          on: {
            ALL_BIDS_SUBMITTED: 'awaiting_tricks',
          },
        },
        awaiting_tricks: {
          on: {
            ALL_TRICKS_SUBMITTED: 'scoring',
          },
        },
        scoring: {
          always: [
            {
              guard: 'hasMoreRounds',
              target: 'bidding',
              actions: ['advanceRoundIndex', 'advanceDealerIndex'],
            },
            {
              target: '#game.finished',
            },
          ],
        },
      },
    },
    finished: {
      on: {
        NEW_GAME: 'idle',
      },
    },
  },
})
