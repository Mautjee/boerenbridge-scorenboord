import { setup, assign } from 'xstate'

export interface RoundMachineContext {
  cardCount: number
  bids: Record<string, number | null>
  tricks: Record<string, number | null>
  blindPlayerIndex: number
  forbiddenBid: number | null
  playerIds: string[]
}

export type RoundMachineEvent =
  | { type: 'BID_ENTERED'; playerId: string; value: number | null }
  | { type: 'ALL_BIDS_SUBMITTED' }
  | { type: 'PROCEED' }
  | { type: 'TRICK_ENTERED'; playerId: string; value: number | null }
  | { type: 'SUBMIT' }
  | { type: 'RESET'; context: Partial<RoundMachineContext> }

function computeForbiddenBid(bids: Record<string, number | null>, cardCount: number, blindPlayerId: string): number | null {
  const sum = Object.entries(bids)
    .filter(([id]) => id !== blindPlayerId)
    .reduce((s, [, b]) => s + (b ?? 0), 0)
  const forbidden = cardCount - sum
  if (forbidden >= 0 && forbidden <= cardCount) return forbidden
  return null
}

export const roundMachine = setup({
  types: {
    context: {} as RoundMachineContext,
    events: {} as RoundMachineEvent,
  },
  guards: {
    allBidsValid: ({ context }) => {
      return context.playerIds.every(id => context.bids[id] !== null && context.bids[id] !== undefined)
    },
    tricksValid: ({ context }) => {
      const total = Object.values(context.tricks).reduce<number>((s, t) => s + (t ?? 0), 0)
      const allEntered = context.playerIds.every(id => context.tricks[id] !== null && context.tricks[id] !== undefined)
      return allEntered && total === context.cardCount
    },
  },
  actions: {
    setBid: assign(({ context, event }) => {
      if (event.type !== 'BID_ENTERED') return context
      const bids = { ...context.bids, [event.playerId]: event.value }
      const blindPlayerId = context.playerIds[context.blindPlayerIndex] ?? ''
      const forbiddenBid = computeForbiddenBid(bids, context.cardCount, blindPlayerId)
      return { ...context, bids, forbiddenBid }
    }),
    setTrick: assign(({ context, event }) => {
      if (event.type !== 'TRICK_ENTERED') return context
      return { ...context, tricks: { ...context.tricks, [event.playerId]: event.value } }
    }),
    resetContext: assign(({ context, event }) => {
      if (event.type !== 'RESET') return context
      return { ...context, ...event.context }
    }),
  },
}).createMachine({
  id: 'round',
  initial: 'collecting_bids',
  context: {
    cardCount: 0,
    bids: {},
    tricks: {},
    blindPlayerIndex: 0,
    forbiddenBid: null,
    playerIds: [],
  },
  states: {
    collecting_bids: {
      on: {
        BID_ENTERED: {
          actions: 'setBid',
        },
        ALL_BIDS_SUBMITTED: {
          guard: 'allBidsValid',
          target: 'locked_bids',
        },
        RESET: {
          actions: 'resetContext',
        },
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
          actions: 'setTrick',
        },
        SUBMIT: {
          guard: 'tricksValid',
          target: 'done',
        },
      },
    },
    done: {
      type: 'final',
    },
  },
})
