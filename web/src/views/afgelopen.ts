import { AFGELOPEN, formatLongDate, formatScore } from '../copy.ts';
import { el } from '../dom.ts';
import { totals } from '../model.ts';
import type { Game } from '../types.ts';
import { actionDock, badge, icon, screenHead, toast } from './components.ts';
import type { GameViewContext } from './types.ts';

function copyFallback(text: string): boolean {
  const area = el('textarea', { class: 'visually-hidden' });
  area.value = text;
  document.body.appendChild(area);
  area.focus();
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

async function shareScoreboard(game: Game): Promise<void> {
  const url = `${window.location.origin}/s/${game.id}`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: AFGELOPEN.shareTitle, text: AFGELOPEN.shareText, url });
      toast(AFGELOPEN.shareDone);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }
  }
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url);
      toast(AFGELOPEN.shareCopied);
      return;
    } catch {
      // Fall through to the selection-based copy.
    }
  }
  if (copyFallback(url)) {
    toast(AFGELOPEN.shareCopied);
  } else {
    toast(AFGELOPEN.shareFailed);
  }
}

export function afgelopenView(ctx: GameViewContext): HTMLElement {
  const game = ctx.game;
  const rows = [...totals(game)].sort((a, b) => b.total - a.total);
  const best = rows[0]?.total ?? 0;
  const winners = rows.filter((row) => row.total === best);
  const winner = winners.length === 1 ? winners[0]! : null;
  const second = rows.find((row) => row !== winner);

  const root = el('div', {});
  root.appendChild(screenHead(AFGELOPEN.title, AFGELOPEN.sub(game.rounds.length, formatLongDate(game.updatedAt))));

  const resultGrid = el('div', { class: 'result-grid' });

  const topRow = winner ?? winners[0];
  const winnerSeat = (() => {
    if (topRow === undefined) {
      return 0;
    }
    const player = game.setup.players.find((candidate) => candidate.id === topRow.playerId);
    return player?.seat ?? 0;
  })();
  const winnerName = winner?.name ?? winners.map((row) => row.name).join(' en ');
  const note =
    winner === null
      ? AFGELOPEN.noteTie(best)
      : AFGELOPEN.note(best - (second?.total ?? 0), second?.name ?? '');

  resultGrid.appendChild(
    el(
      'div',
      { class: 'winner-card' },
      el(
        'div',
        { class: 'winner-band' },
        icon('suit-spade', 'winner-band__suit'),
        winner === null ? AFGELOPEN.tieBand : AFGELOPEN.winnerBand,
      ),
      el(
        'div',
        { class: 'winner-body' },
        el(
          'div',
          { class: 'row' },
          badge(winnerSeat),
          el('span', { class: 'meta' }, AFGELOPEN.roundsPlayed(game.rounds.length)),
        ),
        el('h2', { class: 'winner-name' }, winner === null ? 'Gelijkspel' : winnerName),
        el(
          'div',
          { class: 'winner-score' },
          el('span', { class: 'winner-score__value num' }, formatScore(best)),
          el('span', { class: 'winner-score__unit' }, AFGELOPEN.points),
        ),
        el('p', { class: 'winner-note' }, note),
      ),
    ),
  );

  const right = el('div', { class: 'stack--4' });
  const totalsCard = el('div', { class: 'totals' });
  rows.forEach((row, index) => {
    const player = game.setup.players.find((candidate) => candidate.id === row.playerId);
    totalsCard.appendChild(
      el(
        'div',
        { class: 'totals__row' },
        el('span', { class: 'totals__pos' }, String(index + 1)),
        badge(player?.seat ?? index, true),
        el('span', { class: 'totals__name' }, row.name),
        el('span', { class: 'totals__value num' }, formatScore(row.total)),
      ),
    );
  });
  right.appendChild(
    el(
      'section',
      { 'aria-labelledby': 'eindstand' },
      el(
        'div',
        { class: 'section__head' },
        el('h2', { id: 'eindstand' }, AFGELOPEN.finalStandings),
        el('span', { class: 'meta' }, AFGELOPEN.afterRounds(game.rounds.length)),
      ),
      el('div', { class: 'card' }, totalsCard),
    ),
  );

  const share = el(
    'button',
    { class: 'btn btn--primary', type: 'button' },
    icon('i-share', 'undo-btn__glyph'),
    AFGELOPEN.share,
  );
  share.addEventListener('click', () => {
    void shareScoreboard(game);
  });
  const newGame = el('a', { class: 'btn btn--secondary', href: '#/nieuw' }, AFGELOPEN.newGame);
  right.appendChild(actionDock([share, newGame], { inline: true }));
  right.appendChild(el('p', { class: 'field__hint' }, AFGELOPEN.shareHint));

  resultGrid.appendChild(right);
  root.appendChild(resultGrid);
  void ctx;
  return root;
}
