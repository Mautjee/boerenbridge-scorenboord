import { downloadText, importGames, parseBackup, serializeBackup } from '../backup.ts';
import { APP_VERSION, PWA, SPELS, cardsLine, formatCardDate, namesLine } from '../copy.ts';
import { el, type Child } from '../dom.ts';
import { totals } from '../model.ts';
import { storageEstimateText } from '../pwa.ts';
import { totalRounds } from '../rules.ts';
import { SCHEMA_VERSION, type Game } from '../types.ts';
import { actionDock, badge, chip, confirmAction, emptyCard, icon, screenHead, toast, track } from './components.ts';
import type { ViewContext } from './types.ts';

function playerLabel(game: Game): string {
  return namesLine(game.setup.players.map((player) => player.name));
}

function openLink(game: Game, ...children: Child[]): HTMLAnchorElement {
  const href = game.phase === 'finished' ? `#/spel/${game.id}/scorebord` : `#/spel/${game.id}`;
  const label =
    game.phase === 'finished'
      ? `Scorebord bekijken van ${playerLabel(game)}`
      : `Verder spelen met ${playerLabel(game)}`;
  return el('a', { class: 'game-card__open', href, 'aria-label': label }, ...children);
}

function deleteButton(game: Game, ctx: ViewContext): HTMLButtonElement {
  const button = el(
    'button',
    {
      class: 'icon-btn game-card__delete',
      type: 'button',
      'aria-label': `Spel van ${playerLabel(game)} verwijderen`,
      title: 'Spel verwijderen',
    },
    icon('i-close', 'icon-btn__glyph'),
  );
  button.addEventListener('click', () => {
    confirmAction({
      title: SPELS.deleteTitle,
      body: SPELS.deleteBody(playerLabel(game)),
      confirmLabel: SPELS.deleteConfirm,
      danger: true,
      onConfirm: () => {
        void (async () => {
          await ctx.store.remove(game.id);
          await ctx.reload();
        })();
      },
    });
  });
  return button;
}

function avatarRow(game: Game): HTMLElement {
  return el(
    'div',
    { class: 'avatar-row', 'aria-hidden': 'true' },
    game.setup.players.map((player) => badge(player.seat, true)),
  );
}

function activeCard(game: Game, ctx: ViewContext): HTMLElement {
  const total = totalRounds(game.setup.players.length, game.setup.direction, game.setup.maxCards);
  const pendingRound = game.pending?.round ?? game.rounds.length + 1;
  const pendingCards = game.pending?.cards ?? game.rounds[game.rounds.length - 1]?.cards ?? 0;
  const progress = el(
    'div',
    { class: 'round-progress' },
    el(
      'div',
      { class: 'round-progress__line' },
      el('span', {}, `Ronde ${pendingRound} van ${total}`),
      el('span', {}, cardsLine(pendingCards)),
    ),
    track(game.rounds.length, total),
  );
  return el(
    'article',
    { class: 'game-card' },
    openLink(
      game,
      el(
        'div',
        { class: 'game-card__body' },
        el('div', { class: 'game-card__players' }, playerLabel(game)),
        progress,
        el(
          'div',
          { class: 'game-card__bottom' },
          avatarRow(game),
          el('span', { class: 'game-card__cta' }, SPELS.playOn, icon('i-chevron', 'chevron')),
        ),
      ),
    ),
    el(
      'div',
      { class: 'game-card__top' },
      chip(SPELS.activeChip, 'accent'),
      el('span', { class: 'meta game-card__date' }, formatCardDate(game.updatedAt)),
      deleteButton(game, ctx),
    ),
  );
}

function finishedCard(game: Game, ctx: ViewContext): HTMLElement {
  const rows = totals(game);
  const best = Math.max(...rows.map((row) => row.total), 0);
  const winners = rows.filter((row) => row.total === best);
  const winner = winners.length === 1 ? winners[0]!.name : null;
  const winnerLine =
    winner === null
      ? el(
          'div',
          { class: 'winner-line' },
          el('span', { class: 'winner-line__name' }, 'Gelijkspel'),
          el('span', { class: 'winner-line__score num' }, String(best)),
          el('span', { class: 'winner-line__pts' }, 'punten'),
        )
      : el(
          'div',
          { class: 'winner-line' },
          el('span', { class: 'winner-line__name' }, `${winner} wint`),
          el('span', { class: 'winner-line__score num' }, String(best)),
          el('span', { class: 'winner-line__pts' }, 'punten'),
        );

  return el(
    'article',
    { class: 'game-card' },
    openLink(
      game,
      el(
        'div',
        { class: 'game-card__body' },
        el('div', { class: 'game-card__players' }, playerLabel(game)),
        winnerLine,
        el(
          'div',
          { class: 'game-card__bottom' },
          avatarRow(game),
          el('span', { class: 'game-card__cta' }, SPELS.viewScoreboard, icon('i-chevron', 'chevron')),
        ),
      ),
    ),
    el(
      'div',
      { class: 'game-card__top' },
      chip(SPELS.finishedChip),
      el('span', { class: 'meta game-card__date' }, formatCardDate(game.updatedAt)),
      deleteButton(game, ctx),
    ),
  );
}

function appFooter(ctx: ViewContext): HTMLElement {
  const estimate = el('span', { class: 'app-footer__estimate' }, PWA.storageUnknown);
  const line = el('p', { class: 'app-footer__line' }, `versie ${APP_VERSION} · opslag v${SCHEMA_VERSION} · `);
  line.appendChild(estimate);
  void storageEstimateText().then((text) => {
    estimate.textContent = text;
  });

  const exportButton = el(
    'button',
    { class: 'btn btn--secondary btn--sm', type: 'button', 'aria-label': PWA.exportAria },
    PWA.export,
  );
  exportButton.addEventListener('click', () => {
    void (async () => {
      try {
        const games = await ctx.store.list();
        const date = new Date().toISOString().slice(0, 10);
        downloadText(serializeBackup(games), PWA.exportFileName(date));
        toast(PWA.exportDone);
      } catch {
        toast(PWA.exportFailed);
      }
    })();
  });

  const fileInput = el('input', { type: 'file', class: 'visually-hidden' });
  fileInput.accept = 'application/json,.json';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file === undefined) {
      return;
    }
    void (async () => {
      try {
        const text = await file.text();
        const imported = parseBackup(text);
        const outcome = await importGames(ctx.store, imported);
        toast(
          outcome.skipped.length === 0
            ? PWA.importDone(outcome.saved.length)
            : PWA.importKept(outcome.saved.length, outcome.skipped.length),
        );
        await ctx.reload();
      } catch (error) {
        toast(error instanceof Error ? error.message : PWA.importFailed);
      } finally {
        fileInput.value = '';
      }
    })();
  });

  const importButton = el(
    'button',
    { class: 'btn btn--secondary btn--sm', type: 'button', 'aria-label': PWA.importAria },
    PWA.import,
  );
  importButton.addEventListener('click', () => fileInput.click());

  const actions = el('div', { class: 'app-footer__actions' }, exportButton, importButton, fileInput);
  return el('footer', { class: 'app-footer' }, line, actions);
}

export function spellenView(games: Game[], ctx: ViewContext): HTMLElement {
  const active = games.filter((game) => game.phase === 'active');
  const finished = games.filter((game) => game.phase === 'finished');
  const ordered = [...active, ...finished];

  const root = el('div', {});
  const action = el('a', { class: 'btn btn--primary screen-action', href: '#/nieuw' }, SPELS.newGame);
  root.appendChild(screenHead(SPELS.title, SPELS.subtitle, action));

  if (ordered.length === 0) {
    root.appendChild(emptyCard(SPELS.emptyTitle, SPELS.emptyBody));
  } else {
    const list = el('div', { class: 'game-list' });
    for (const game of ordered) {
      list.appendChild(game.phase === 'active' ? activeCard(game, ctx) : finishedCard(game, ctx));
    }
    root.appendChild(list);
  }

  root.appendChild(
    actionDock([el('a', { class: 'btn btn--primary', href: '#/nieuw' }, SPELS.newGame)], { mobileOnly: true }),
  );
  root.appendChild(appFooter(ctx));
  return root;
}
