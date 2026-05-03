import { createMachine, assign, type ActorRefFrom } from 'xstate'

interface GameMachineContext {
  gameId: string
  currentRoundIndex: number
  totalRounds: number
  dealerIndex: number
  playerIds: string[]
}

export type GameMachineEvents =
  | { type: 'GAME_LOADED' }
  | { type: 'ALL_BIDS_SUBMITTED' }
  | { type: 'ALL_TRICKS_SUBMITTED' }
  | { type: 'ROUND_COMPLETE' }
  | { type: 'NEW_GAME' }

export const gameMachine = createMachine({
  id: 'game',
  initial: 'idle',
  context: {
    gameId: '',
    currentRoundIndex: 0,
    totalRounds: 0,
    dealerIndex: 0,
    playerIds: [],
  } satisfies GameMachineContext,
  types: {
    context: {} as GameMachineContext,
    events: {} as GameMachineEvents,
  },
  states: {
    idle: {
      on: {
        GAME_LOADED: 'active',
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
          on: {
            ROUND_COMPLETE: [
              {
                target: 'bidding',
                guard: 'hasMoreRounds',
                actions: assign({
                  currentRoundIndex: ({ context }) => context.currentRoundIndex + 1,
                  dealerIndex: ({ context }) => (context.dealerIndex + 1) % context.playerIds.length,
                }),
              },
              { target: '#game.finished' },
            ],
          },
        },
      },
    },
    finished: {
      on: {
        NEW_GAME: 'idle',
      },
    },
  },
  guards: {
    hasMoreRounds: ({ context }) => context.currentRoundIndex < context.totalRounds - 1,
  },
})

export type GameMachineActor = ActorRefFrom<typeof gameMachine>
