import { SLAGEN, cardsLine, formatDelta } from '../copy.ts';
import { el } from '../dom.ts';
import { totalRounds } from '../rules.ts';
import type { CompletedRound, Game } from '../types.ts';
import { actionDock, badge, icon, openKeypad, ribbon, screenHead, stepperRow, track } from './components.ts';
import { tricksFormState } from './forms.ts';
import type { GameViewContext } from './types.ts';

function unavailable(game: Game): HTMLElement {
  const root = el('div', {});
  root.appendChild(screenHead(SLAGEN.title, SLAGEN.subtitle));
  root.appendChild(
    el(
      'div',
      { class: 'notice' },
      el('span', { class: 'notice__title' }, 'Vul eerst de biedingen in'),
      el('span', { class: 'notice__body' }, 'De slagen kunnen pas worden ingevuld als de biedingen bekend zijn.'),
      el('a', { class: 'btn btn--primary', href: `#/spel/${game.id}`, style: 'justify-self:center;margin-top:8px' }, 'Naar de biedingen'),
    ),
  );
  return root;
}

export function slagenView(ctx: GameViewContext): HTMLElement {
  const game = ctx.game;
  if (game.pending === null || game.pending.bids === null) {
    return unavailable(game);
  }

  const pending = game.pending;
  if (pending.bids === null) {
    return unavailable(game);
  }
  const cards = pending.cards;
  const round = pending.round;
  const bids = pending.bids;
  const total = totalRounds(game.setup.players.length, game.setup.direction, game.setup.maxCards);
  const tricks = game.setup.players.map(() => 0);

  const root = el('div', {});
  root.appendChild(screenHead(SLAGEN.title, SLAGEN.subtitle));
  root.appendChild(
    el(
      'div',
      { class: 'round-head' },
      ribbon(round, cards, 3),
      el('span', { class: 'meta' }, SLAGEN.roundOf(round, total)),
    ),
  );
  root.appendChild(track(round, total, 'round-track'));

  const split = el('div', { class: 'split' });
  const main = el('div', {});
  split.appendChild(main);

  const counter = el('div', { class: 'card total-counter' });
  const totalValue = el('span', { class: 'total-counter__value num', 'aria-live': 'polite' });
  const target = el('span', { class: 'total-counter__target' }, SLAGEN.target(cards));
  const segments = el('div', { class: 'segments', 'aria-hidden': 'true' });
  const hint = el('p', { class: 'field__hint', role: 'status', 'aria-live': 'polite', id: 'tricks-hint' });
  counter.append(
    el(
      'div',
      { class: 'total-counter__row' },
      el('span', { class: 'meta' }, SLAGEN.totalLabel),
      el('span', { class: 'meta' }, SLAGEN.cardsPerPlayer(cards)),
    ),
    el('div', { class: 'total-counter__pair' }, totalValue, target),
    segments,
    hint,
  );
  main.appendChild(counter);

  const rows = el('div', { class: 'stack bid-grid bid-grid--top' });
  game.setup.players.forEach((player, seat) => {
    const row = stepperRow({
      seat: player.seat,
      name: player.name,
      sub: SLAGEN.bidSub(bids[seat] ?? 0),
      value: tricks[seat] ?? 0,
      max: cards,
      decreaseLabel: SLAGEN.decrease(player.name),
      increaseLabel: SLAGEN.increase(player.name),
      valueLabel: (value) => SLAGEN.value(player.name, value),
      onChange: (value) => {
        tricks[seat] = value;
        update();
      },
      onOpen: (current) => {
        openKeypad({
          title: SLAGEN.keypadTitle(player.name),
          sub: `${SLAGEN.round(round)} · ${cardsLine(cards)}`,
          value: current,
          max: cards,
          unit: SLAGEN.keypadUnit,
          groupLabel: SLAGEN.keypadGroup,
          onSelect: (value) => {
            tricks[seat] = value;
            row.setValue(value);
            update();
          },
        });
      },
    });
    rows.appendChild(row.element);
  });
  main.appendChild(rows);
  main.appendChild(el('p', { class: 'field__hint', style: 'margin-top:12px' }, 'Tik op een getal om het direct in te voeren.'));

  const aside = el('aside', { class: 'split__aside', 'aria-label': SLAGEN.summaryTitle });
  const bidRows = el('div', { class: 'summary-rows' });
  game.setup.players.forEach((player, seat) => {
    bidRows.appendChild(
      el(
        'div',
        { class: 'summary-row' },
        el(
          'span',
          { class: 'summary-row__who' },
          badge(player.seat, true),
          el('span', {}, player.name),
        ),
        el('span', { class: 'summary-row__value num' }, String(bids[seat] ?? 0)),
      ),
    );
  });
  aside.appendChild(
    el(
      'div',
      { class: 'card aside-summary' },
      el('div', { class: 'section__head' }, el('h2', {}, SLAGEN.summaryTitle), el('span', { class: 'chip' }, `Ronde ${round}`)),
      bidRows,
    ),
  );

  const submit = el('button', { class: 'btn btn--primary btn--block', type: 'button' }, SLAGEN.submit);
  submit.addEventListener('click', () => {
    void (async () => {
      const state = tricksFormState(cards, tricks);
      if (!state.canSubmit) {
        update();
        return;
      }
      const completed = await ctx.session.submitTricks(tricks);
      const played = completed.rounds[completed.rounds.length - 1];
      if (played !== undefined) {
        showResult(played, completed.phase === 'finished');
      }
    })();
  });
  aside.appendChild(actionDock([submit]));
  split.appendChild(aside);
  root.appendChild(split);

  function paintSegments(state: ReturnType<typeof tricksFormState>): void {
    segments.replaceChildren();
    for (const segment of state.segments) {
      const className =
        segment === 'on'
          ? 'segments__seg segments__seg--on'
          : segment === 'over'
            ? 'segments__seg segments__seg--over'
            : 'segments__seg';
      segments.appendChild(el('span', { class: className }));
    }
  }

  function update(): void {
    const state = tricksFormState(cards, tricks);
    totalValue.textContent = String(state.total);
    totalValue.className =
      state.matched
        ? 'total-counter__value total-counter__value--ok num'
        : state.over
          ? 'total-counter__value total-counter__value--over num'
          : 'total-counter__value num';
    hint.textContent = state.hint;
    hint.className = state.over ? 'field__hint field__hint--danger' : 'field__hint';
    if (state.over) {
      hint.setAttribute('role', 'alert');
    } else {
      hint.setAttribute('role', 'status');
    }
    submit.disabled = !state.canSubmit;
    submit.setAttribute('aria-describedby', 'tricks-hint');
    paintSegments(state);
  }

  function showResult(completed: CompletedRound, finished: boolean): void {
    root.replaceChildren();
    root.appendChild(screenHead(SLAGEN.title, SLAGEN.subtitle));
    root.appendChild(
      el(
        'div',
        { class: 'round-head' },
        ribbon(completed.round, completed.cards, 3),
        el('span', { class: 'meta' }, SLAGEN.roundOf(completed.round, total)),
      ),
    );
    root.appendChild(track(completed.round, total, 'round-track'));

    const banner = el(
      'div',
      { class: 'result-banner', role: 'status', 'aria-live': 'polite' },
      icon('i-check', 'result-banner__glyph'),
      el(
        'div',
        {},
        el('h2', { class: 'result-banner__title' }, SLAGEN.resultTitle(completed.round)),
        el('p', { class: 'result-banner__body' }, SLAGEN.resultBody(finished ? null : completed.round + 1)),
      ),
    );
    root.appendChild(banner);

    const resultRows = el('div', { class: 'stack bid-grid' });
    game.setup.players.forEach((player, seat) => {
      const score = completed.scores[seat] ?? 0;
      const deltaClass =
        score > 0 ? 'delta delta--plus' : score < 0 ? 'delta delta--minus' : 'delta delta--zero';
      resultRows.appendChild(
        el(
          'div',
          { class: 'player-bid' },
          badge(player.seat),
          el(
            'span',
            { class: 'player-bid__who' },
            el('span', { class: 'player-bid__name' }, player.name),
            el('span', { class: 'player-bid__sub' }, SLAGEN.resultScore(completed.bids[seat] ?? 0, completed.tricks[seat] ?? 0)),
          ),
          el('span', { class: deltaClass }, formatDelta(score)),
        ),
      );
    });
    root.appendChild(resultRows);

    const undo = el('button', { class: 'btn btn--secondary', type: 'button' }, SLAGEN.undo);
    undo.addEventListener('click', () => {
      void (async () => {
        await ctx.session.undoLastRound();
        await ctx.reload();
      })();
    });
    const scoreboard = el('a', { class: 'btn btn--primary btn--block', href: `#/spel/${game.id}/scorebord` }, SLAGEN.toScoreboard);
    root.appendChild(actionDock([undo, scoreboard]));
  }

  update();
  return root;
}
