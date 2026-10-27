import { CORRECTIE, SLAGEN, cardsLine } from '../copy.ts';
import { el } from '../dom.ts';
import { actionDock, icon, openKeypad, ribbon, screenHead, stepperRow } from './components.ts';
import { bidsFormState, tricksFormState } from './forms.ts';
import type { GameViewContext } from './types.ts';

export function correctieView(ctx: GameViewContext, roundNumber: number): HTMLElement {
  const game = ctx.game;
  const existing = game.rounds[roundNumber - 1];
  const root = el('div', {});

  if (existing === undefined) {
    root.appendChild(screenHead(CORRECTIE.title(roundNumber), 'Deze ronde bestaat niet.'));
    root.appendChild(
      el(
        'div',
        { class: 'notice' },
        el('span', { class: 'notice__title' }, 'Ronde niet gevonden'),
        el('span', { class: 'notice__body' }, 'Kies een ronde uit het scorebord om te corrigeren.'),
        el('a', { class: 'btn btn--primary', href: `#/spel/${game.id}/scorebord`, style: 'justify-self:center;margin-top:8px' }, CORRECTIE.back),
      ),
    );
    return root;
  }

  const cards = existing.cards;
  const bids = [...existing.bids];
  const tricks = [...existing.tricks];

  root.appendChild(screenHead(CORRECTIE.title(roundNumber), CORRECTIE.subtitle));
  root.appendChild(
    el(
      'div',
      { class: 'round-head' },
      ribbon(roundNumber, cards, 2),
      el('span', { class: 'meta' }, CORRECTIE.roundTitle(roundNumber, cards)),
    ),
  );

  const blindHint = el('div', { class: 'hint', role: 'status', 'aria-live': 'polite', id: 'correctie-blind' });
  const blindText = el('span', {});
  blindHint.append(icon('suit-club', 'hint__icon'), blindText);

  const bidRows = el('div', { class: 'stack bid-grid' });
  game.setup.players.forEach((player, seat) => {
    const row = stepperRow({
      seat: player.seat,
      name: player.name,
      value: bids[seat] ?? 0,
      max: cards,
      decreaseLabel: `Bod van ${player.name} verlagen`,
      increaseLabel: `Bod van ${player.name} verhogen`,
      valueLabel: (value) => `Bod van ${player.name}: ${value}. Open het toetsenbord.`,
      onChange: (value) => {
        bids[seat] = value;
        update();
      },
      onOpen: (current) => {
        openKeypad({
          title: `Bod voor ${player.name}`,
          sub: `${CORRECTIE.bids} · ${cardsLine(cards)}`,
          value: current,
          max: cards,
          unit: 'slagen',
          groupLabel: 'Kies een bod',
          onSelect: (value) => {
            bids[seat] = value;
            row.setValue(value);
            update();
          },
        });
      },
    });
    bidRows.appendChild(row.element);
  });

  const totalHint = el('p', { class: 'field__hint', role: 'status', 'aria-live': 'polite', id: 'correctie-total' });
  const trickRows = el('div', { class: 'stack bid-grid' });
  game.setup.players.forEach((player, seat) => {
    const row = stepperRow({
      seat: player.seat,
      name: player.name,
      sub: `bood ${bids[seat] ?? 0}`,
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
          sub: `${CORRECTIE.tricks} · ${cardsLine(cards)}`,
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
    row.element.dataset.seat = String(seat);
    trickRows.appendChild(row.element);
  });

  const save = el('button', { class: 'btn btn--primary btn--block', type: 'button' }, CORRECTIE.submit);
  const back = el('a', { class: 'btn btn--secondary', href: `#/spel/${game.id}/scorebord` }, CORRECTIE.back);
  save.addEventListener('click', () => {
    void (async () => {
      const bidState = bidsFormState(cards, bids);
      const trickState = tricksFormState(cards, tricks);
      if (!bidState.canSubmit || !trickState.canSubmit) {
        update();
        return;
      }
      await ctx.session.correctRound(roundNumber, bids, tricks);
      window.location.hash = `#/spel/${game.id}/scorebord`;
    })();
  });

  root.appendChild(blindHint);
  root.appendChild(el('section', { class: 'section' }, el('h2', { style: 'margin-bottom:12px' }, CORRECTIE.bids), bidRows));
  root.appendChild(totalHint);
  root.appendChild(el('section', { class: 'section' }, el('h2', { style: 'margin-bottom:12px' }, CORRECTIE.tricks), trickRows));
  root.appendChild(actionDock([back, save]));

  function update(): void {
    const bidState = bidsFormState(cards, bids);
    const trickState = tricksFormState(cards, tricks);
    blindText.textContent = bidState.blocked && bidState.message !== null ? CORRECTIE.blindHint(bidState.message) : 'De biedingen mogen niet samen precies het aantal kaarten zijn.';
    blindHint.className = bidState.blocked ? 'hint hint--danger' : 'hint';
    blindHint.querySelector('use')?.setAttribute('href', bidState.blocked ? '#i-alert' : '#suit-club');
    totalHint.textContent = trickState.hint;
    totalHint.className = trickState.over ? 'field__hint field__hint--danger' : 'field__hint';
    save.disabled = !bidState.canSubmit || !trickState.canSubmit;
    save.setAttribute('aria-describedby', 'correctie-blind correctie-total');
    const inputs = trickRows.querySelectorAll<HTMLElement>('.player-bid__sub');
    inputs.forEach((node, seat) => {
      node.textContent = `bood ${bids[seat] ?? 0}`;
    });
  }

  update();
  return root;
}
