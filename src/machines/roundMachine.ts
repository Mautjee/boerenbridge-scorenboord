import { createMachine, assign } from 'xstate'

interface RoundMachineContext {
  cardCount: number
  bids: Record<string, number | null>
  tricks: Record<string, number | null>
  blindPlayerIndex: number
  forbiddenBid: number | null
}

export type RoundMachineEvents =
  | { type: 'BID_ENTERED'; playerId: string; bid: number }
  | { type: 'ALL_BIDS_SUBMITTED' }
  | { type: 'PROCEED' }
  | { type: 'TRICK_ENTERED'; playerId: string; tricks: number }
  | { type: 'TRICKS_VALID' }
  | { type: 'SUBMIT' }

export const roundMachine = createMachine({
  id: 'round',
  initial: 'collecting_bids',
  context: {
    cardCount: 0,
    bids: {},
    tricks: {},
    blindPlayerIndex: 0,
    forbiddenBid: null,
  } satisfies RoundMachineContext,
  types: {
    context: {} as RoundMachineContext,
    events: {} as RoundMachineEvents,
  },
  states: {
    collecting_bids: {
      on: {
        BID_ENTERED: {
          actions: assign({
            bids: ({ context, event }) => ({
              ...context.bids,
              [event.playerId]: event.bid,
            }),
          }),
        },
        ALL_BIDS_SUBMITTED: 'locked_bids',
      },
    },
    locked_bids: {
      on: {
        PROCEED: 'collecting_tricks',
      },
    },
    collecting_tricks: {
      on: {
        TRICK_ENTERED: {
          actions: assign({
            tricks: ({ context, event }) => ({
              ...context.tricks,
              [event.playerId]: event.tricks,
            }),
          }),
        },
        TRICKS_VALID: 'ready_to_submit',
        SUBMIT: {
          target: 'done',
          guard: ({ context }) => {
            const total = Object.values(context.tricks).reduce((sum, t) => sum + (t ?? 0), 0)
            return total === context.cardCount
          },
        },
      },
    },
    ready_to_submit: {
      on: {
        SUBMIT: 'done',
        TRICK_ENTERED: {
          actions: assign({
            tricks: ({ context, event }) => ({
              ...context.tricks,
              [event.playerId]: event.tricks,
            }),
          }),
        },
      },
    },
    done: {
      type: 'final',
    },
  },
})
