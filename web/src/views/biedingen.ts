import { BIEDINGEN, cardsLine } from '../copy.ts';
import { el } from '../dom.ts';
import { totalRounds } from '../rules.ts';
import type { Game } from '../types.ts';
import { actionDock, icon, openKeypad, ribbon, screenHead, stepperRow, track } from './components.ts';
import { bidsFormState } from './forms.ts';
import type { GameViewContext } from './types.ts';

function unavailable(game: Game, ctx: GameViewContext): HTMLElement {
  const root = el('div', {});
  root.appendChild(screenHead(BIEDINGEN.title, BIEDINGEN.subtitle));
  root.appendChild(
    el(
      'div',
      { class: 'notice' },
      el('span', { class: 'notice__title' }, 'Deze ronde is al afgerond'),
      el('span', { class: 'notice__body' }, 'Ga naar het scorebord om de tussenstand te bekijken.'),
      el('a', { class: 'btn btn--primary', href: `#/spel/${game.id}/scorebord`, style: 'justify-self:center;margin-top:8px' }, 'Naar scorebord'),
    ),
  );
  void ctx;
  return root;
}

export function biedingenView(ctx: GameViewContext): HTMLElement {
  const game = ctx.game;
  if (game.pending === null || game.pending.bids !== null) {
    return unavailable(game, ctx);
  }

  const pending = game.pending;
  const cards = pending.cards;
  const round = pending.round;
  const total = totalRounds(game.setup.players.length, game.setup.direction, game.setup.maxCards);
  const bids = game.setup.players.map((_, seat) => pending.bids?.[seat] ?? 0);

  const root = el('div', {});
  const split = el('div', { class: 'split' });
  const main = el('div', {});
  split.appendChild(main);

  main.appendChild(screenHead(BIEDINGEN.title, BIEDINGEN.subtitle));
  main.appendChild(
    el(
      'div',
      { class: 'round-head' },
      ribbon(round, cards, 0),
      el('span', { class: 'meta' }, BIEDINGEN.roundOf(round, total)),
    ),
  );
  main.appendChild(track(round, total, 'round-track'));

  const hint = el('div', { class: 'hint', role: 'status', 'aria-live': 'polite', id: 'blind-hint' });
  const hintIcon = icon('suit-club', 'hint__icon');
  const hintText = el('span', {});
  hint.append(hintIcon, hintText);
  main.appendChild(hint);

  const rows = el('div', { class: 'stack bid-grid bid-grid--top' });
  game.setup.players.forEach((player, seat) => {
    const row = stepperRow({
      seat: player.seat,
      name: player.name,
      value: bids[seat] ?? 0,
      max: cards,
      decreaseLabel: BIEDINGEN.decrease(player.name),
      increaseLabel: BIEDINGEN.increase(player.name),
      valueLabel: (value) => BIEDINGEN.value(player.name, value),
      onChange: (value) => {
        bids[seat] = value;
        update();
      },
      onOpen: (current) => {
        openKeypad({
          title: BIEDINGEN.keypadTitle(player.name),
          sub: `${BIEDINGEN.round(round)} · ${cardsLine(cards)}`,
          value: current,
          max: cards,
          unit: BIEDINGEN.keypadUnit,
          groupLabel: BIEDINGEN.keypadGroup,
          onSelect: (value) => {
            bids[seat] = value;
            row.setValue(value);
            update();
          },
        });
      },
    });
    row.element.dataset.seat = String(seat);
    rows.appendChild(row.element);
  });
  main.appendChild(rows);
  main.appendChild(el('p', { class: 'field__hint', style: 'margin-top:12px' }, BIEDINGEN.keypadHint));

  const aside = el('aside', { class: 'split__aside', 'aria-label': BIEDINGEN.summaryTitle });
  const summarySum = el('span', { class: 'summary-row__value num' });
  const summaryRounds = el('span', { class: 'summary-row__value num' });
  aside.appendChild(
    el(
      'div',
      { class: 'card aside-summary' },
      el(
        'div',
        { class: 'section__head' },
        el('h2', {}, BIEDINGEN.summaryTitle),
        el('span', { class: 'chip' }, `${round} / ${total}`),
      ),
      el(
        'div',
        { class: 'summary-rows' },
        el(
          'div',
          { class: 'summary-row' },
          el('span', {}, BIEDINGEN.cardsPerPlayer),
          el('span', { class: 'summary-row__value num' }, String(cards)),
        ),
        el('div', { class: 'summary-row' }, el('span', {}, BIEDINGEN.bidsTogether), summarySum),
        el('div', { class: 'summary-row' }, el('span', {}, BIEDINGEN.roundsLeft), summaryRounds),
      ),
    ),
  );

  const submit = el('button', { class: 'btn btn--primary btn--block', type: 'button' }, BIEDINGEN.submit);
  submit.addEventListener('click', () => {
    void (async () => {
      const state = bidsFormState(cards, bids);
      if (!state.canSubmit) {
        update();
        return;
      }
      await ctx.session.submitBids(bids);
      await ctx.reload();
    })();
  });
  aside.appendChild(actionDock([submit]));
  split.appendChild(aside);
  root.appendChild(split);

  function update(): void {
    const state = bidsFormState(cards, bids);
    hintText.textContent = state.hint;
    hint.className = state.blocked ? 'hint hint--danger' : 'hint';
    if (state.blocked) {
      hint.setAttribute('role', 'alert');
    } else {
      hint.setAttribute('role', 'status');
    }
    hintIcon.querySelector('use')?.setAttribute('href', state.blocked ? '#i-alert' : '#suit-club');
    submit.disabled = !state.canSubmit;
    submit.setAttribute('aria-describedby', 'blind-hint');
    summarySum.textContent = String(state.sum);
    summaryRounds.textContent = BIEDINGEN.roundsLeftValue(Math.max(0, total - round + 1));
  }

  update();
  return root;
}
