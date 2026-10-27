import { validateBids } from '../rules.ts';
import { BIEDINGEN, SLAGEN } from '../copy.ts';

export interface BidsFormState {
  sum: number;
  cards: number;
  blocked: boolean;
  message: string | null;
  hint: string;
  canSubmit: boolean;
}

export interface TricksFormState {
  total: number;
  cards: number;
  matched: boolean;
  over: boolean;
  message: string | null;
  hint: string;
  canSubmit: boolean;
  segments: Array<'on' | 'over' | ''>;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function bidsFormState(cards: number, bids: number[]): BidsFormState {
  const total = sum(bids);
  const message = validateBids(bids, cards);
  const blocked = message !== null;
  return {
    sum: total,
    cards,
    blocked,
    message,
    hint: blocked
      ? BIEDINGEN.hintBlocked(total, message)
      : BIEDINGEN.hintIdle(total, cards),
    canSubmit: !blocked,
  };
}

export function tricksFormState(cards: number, tricks: number[]): TricksFormState {
  const total = sum(tricks);
  const over = total > cards;
  const matched = total === cards;
  let message: string | null = null;
  if (over) {
    message = SLAGEN.hintOver(total, cards, total - cards);
  } else if (!matched) {
    message = SLAGEN.hintRemaining(cards - total);
  }

  const segments: Array<'on' | 'over' | ''> = [];
  for (let index = 0; index < cards; index++) {
    if (index >= total) {
      segments.push('');
    } else if (over && index === cards - 1) {
      segments.push('over');
    } else {
      segments.push('on');
    }
  }

  return {
    total,
    cards,
    matched,
    over,
    message,
    hint: matched ? SLAGEN.hintReady : (message ?? ''),
    canSubmit: matched,
    segments,
  };
}
