import { SCOREBORD, formatScore } from '../copy.ts';
import { el } from '../dom.ts';
import { leader, totals, type TotalsRow } from '../model.ts';
import { totalRounds } from '../rules.ts';
import type { CompletedRound, Game, Player } from '../types.ts';
import { actionDock, badge, confirmAction, icon, screenHead, suitForSeat } from './components.ts';
import type { GameViewContext } from './types.ts';

function sortedTotals(game: Game): TotalsRow[] {
  return [...totals(game)].sort((a, b) => b.total - a.total);
}

function roundSummary(round: CompletedRound, players: Player[]): string {
  const best = Math.max(...round.scores);
  const names = players.filter((player) => (round.scores[player.seat] ?? 0) === best).map((player) => player.name);
  return SCOREBORD.roundSub(names, best);
}

function rankingRows(game: Game, rows: TotalsRow[], leaderId: string | null): HTMLElement {
  const list = el('div', { class: 'rank-list' });
  rows.forEach((row, index) => {
    const player = game.setup.players.find((candidate) => candidate.id === row.playerId);
    const seat = player?.seat ?? index;
    const isLeader = leaderId !== null && row.playerId === leaderId;
    list.appendChild(
      el(
        'div',
        { class: `rank-row${isLeader ? ' rank-row--leader' : ''}` },
        el('span', { class: 'rank-row__pos' }, String(index + 1)),
        badge(seat),
        el(
          'span',
          { class: 'rank-row__who' },
          el('span', { class: 'rank-row__name' }, row.name),
          isLeader
            ? el('span', { class: 'rank-row__mark' }, game.phase === 'finished' ? SCOREBORD.winnerMark : SCOREBORD.leaderMark)
            : null,
        ),
        el('span', { class: 'rank-row__total num' }, formatScore(row.total)),
      ),
    );
  });
  return list;
}

function matrix(game: Game, rows: TotalsRow[]): HTMLElement {
  const table = el('table', { class: 'matrix' });
  table.appendChild(el('caption', { class: 'visually-hidden' }, SCOREBORD.matrixCaption));
  const headRow = el('tr', {}, el('th', { scope: 'col' }, SCOREBORD.player));
  for (const round of game.rounds) {
    headRow.appendChild(
      el(
        'th',
        { scope: 'col' },
        el('span', { class: 'num' }, String(round.round)),
        el('span', { class: 'matrix__cards' }, String(round.cards)),
      ),
    );
  }
  headRow.appendChild(el('th', { scope: 'col' }, SCOREBORD.total));
  table.appendChild(el('thead', {}, headRow));

  const body = el('tbody', {});
  for (const row of rows) {
    const player = game.setup.players.find((candidate) => candidate.id === row.playerId);
    const seat = player?.seat ?? 0;
    const cells = el('tr', {});
    const suit = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    suit.setAttribute('class', 'matrix__suit');
    suit.setAttribute('style', `fill: var(--player-${(seat % 8) + 1})`);
    suit.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#${suitForSeat(seat)}`);
    suit.appendChild(use);
    cells.appendChild(el('td', {}, el('span', { class: 'matrix__name' }, suit, row.name)));
    for (const round of game.rounds) {
      cells.appendChild(el('td', {}, formatScore(round.scores[seat] ?? 0)));
    }
    cells.appendChild(el('td', { class: 'matrix__total' }, formatScore(row.total)));
    body.appendChild(cells);
  }
  table.appendChild(body);

  return el('div', { class: 'matrix-wrap' }, table);
}

export function scorebordView(ctx: GameViewContext): HTMLElement {
  const game = ctx.game;
  const rows = sortedTotals(game);
  const leaderId = leader(game);
  const leaderName = leaderId === null ? null : rows.find((row) => row.playerId === leaderId)?.name ?? null;
  const played = game.rounds.length;
  const total = totalRounds(game.setup.players.length, game.setup.direction, game.setup.maxCards);
  const best = rows[0]?.total ?? 0;

  const undo = el(
    'button',
    {
      class: 'btn btn--secondary btn--sm undo-btn',
      type: 'button',
      'aria-label': SCOREBORD.undoLabel,
    },
    icon('i-undo', 'undo-btn__glyph'),
    SCOREBORD.undo,
  );
  if (played === 0) {
    undo.setAttribute('disabled', '');
  }
  undo.addEventListener('click', () => {
    if (played === 0) {
      return;
    }
    void (async () => {
      await ctx.session.undoLastRound();
      await ctx.reload();
    })();
  });

  const root = el('div', {});
  const sub =
    played === 0
      ? SCOREBORD.emptySub
      : game.phase === 'finished'
        ? SCOREBORD.finishedSub(total, leaderName, best)
        : SCOREBORD.progressSub(played, total, leaderName);
  root.appendChild(screenHead(SCOREBORD.title, sub, undo));

  if (game.phase === 'finished') {
    const body =
      leaderName === null
        ? SCOREBORD.finishedBodyTie(best)
        : SCOREBORD.finishedBody(
            leaderName,
            best,
            rows.find((row) => row.playerId !== leaderId)?.name ?? '',
            best - (rows.find((row) => row.playerId !== leaderId)?.total ?? 0),
          );
    root.appendChild(
      el(
        'div',
        { style: 'margin-bottom:20px' },
        el(
          'div',
          { class: 'card card--accent' },
          el(
            'div',
            { class: 'section__head', style: 'margin-bottom:4px' },
            el('h2', { class: 'result-banner__title' }, SCOREBORD.finishedTitle),
            el(
              'span',
              { class: 'chip chip--accent' },
              leaderName === null ? SCOREBORD.tieChip : SCOREBORD.winnerChip(leaderName),
            ),
          ),
          el('p', { class: 'result-banner__body' }, body),
        ),
      ),
    );
  }

  const split = el('div', { class: 'split split--score' });
  const left = el('div', { class: 'stack--4' });
  const standings = el('section', { 'aria-labelledby': 'tussenstand' });
  standings.appendChild(
    el(
      'div',
      { class: 'section__head' },
      el('h2', { id: 'tussenstand' }, SCOREBORD.standings),
      el('span', { class: 'meta' }, game.phase === 'finished' ? SCOREBORD.finalStandings : SCOREBORD.standingsAfter(played)),
    ),
  );
  standings.appendChild(el('div', { class: 'card', 'aria-live': 'polite' }, rankingRows(game, rows, leaderId)));
  left.appendChild(standings);

  if (played === 0) {
    left.appendChild(
      el(
        'div',
        { class: 'notice' },
        el('span', { class: 'notice__title' }, SCOREBORD.emptyNoticeTitle),
        el('span', { class: 'notice__body' }, SCOREBORD.emptyNoticeBody),
      ),
    );
  }
  split.appendChild(left);

  const right = el('div', { class: 'stack--4' });
  if (played > 0) {
    const roundsSection = el('section', { 'aria-labelledby': 'per-ronde' });
    roundsSection.appendChild(
      el(
        'div',
        { class: 'section__head' },
        el('h2', { id: 'per-ronde' }, SCOREBORD.perRound),
        el('span', { class: 'meta' }, SCOREBORD.roundsMeta(played)),
      ),
    );
    roundsSection.appendChild(el('p', { class: 'field__hint scroll-hint', style: 'margin-bottom:8px' }, SCOREBORD.scrollHint));
    roundsSection.appendChild(matrix(game, rows));
    right.appendChild(roundsSection);

    const listSection = el('section', { 'aria-labelledby': 'rondes' });
    listSection.appendChild(
      el(
        'div',
        { class: 'section__head' },
        el('h2', { id: 'rondes' }, SCOREBORD.rounds),
        el('span', { class: 'meta' }, SCOREBORD.roundsMeta(played)),
      ),
    );
    const roundList = el('div', { class: 'round-list' });
    for (const round of [...game.rounds].reverse()) {
      const correct = el('button', { class: 'round-correct', type: 'button', 'aria-label': SCOREBORD.correctLabel(round.round) }, SCOREBORD.correct);
      correct.addEventListener('click', () => {
        const go = (): void => {
          window.location.hash = `#/spel/${game.id}/correctie/${round.round}`;
        };
        if (round.round < game.rounds.length) {
          confirmAction({
            title: SCOREBORD.correctTitle(round.round),
            sub: SCOREBORD.correctSub(round.round),
            body: SCOREBORD.correctBody(round.round),
            confirmLabel: SCOREBORD.correctConfirm,
            onConfirm: go,
          });
        } else {
          go();
        }
      });
      roundList.appendChild(
        el(
          'div',
          { class: 'round-row' },
          el(
            'span',
            { class: 'round-row__copy' },
            el('span', { class: 'round-row__title' }, SCOREBORD.roundTitle(round.round, round.cards)),
            el('span', { class: 'round-row__sub' }, roundSummary(round, game.setup.players)),
          ),
          correct,
        ),
      );
    }
    listSection.appendChild(el('div', { class: 'card' }, roundList));
    right.appendChild(listSection);
  }
  split.appendChild(right);
  root.appendChild(split);

  const primary =
    game.phase === 'finished'
      ? el('a', { class: 'btn btn--primary', href: `#/spel/${game.id}` }, SCOREBORD.viewResult)
      : el('a', { class: 'btn btn--primary', href: `#/spel/${game.id}` }, played === 0 ? SCOREBORD.firstRound : SCOREBORD.nextRound);
  root.appendChild(actionDock([primary], { inline: true }));
  return root;
}
