import { APP_NAME, COMMON, STATUS } from './copy.ts';
import { clear, el } from './dom.ts';
import { parseRoute, screenForGame, type Route } from './router.ts';
import { GameSession } from './session.ts';
import { openGameStore, type GameStore } from './store.ts';
import { afgelopenView } from './views/afgelopen.ts';
import { biedingenView } from './views/biedingen.ts';
import { correctieView } from './views/correctie.ts';
import { nieuwSpelView } from './views/nieuwspel.ts';
import { scorebordView } from './views/scorebord.ts';
import { slagenView } from './views/slagen.ts';
import { spellenView } from './views/spellen.ts';
import { actionDock, screenHead } from './views/components.ts';

interface AppState {
  store: GameStore;
  fallback: boolean;
  reason?: string;
}

let state: AppState | null = null;
let root: HTMLElement | null = null;

function paintStatus(): void {
  const chip = document.getElementById('status');
  if (chip === null || state === null) {
    return;
  }
  const info = state.fallback ? STATUS.storage : navigator.onLine ? STATUS.online : STATUS.offline;
  chip.className = state.fallback ? 'status status--danger' : 'status';
  chip.setAttribute('aria-label', info.aria);
  clear(chip);
  const dotClass = state.fallback
    ? 'status__dot status__dot--danger'
    : navigator.onLine
      ? 'status__dot status__dot--synced'
      : 'status__dot';
  chip.appendChild(el('span', { class: dotClass }));
  chip.appendChild(document.createTextNode(info.text));
  if (info.more.length > 0) {
    chip.appendChild(el('span', { class: 'status__more' }, info.more));
  }
}

function setTitle(title: string): void {
  document.title = `${title} · ${APP_NAME}`;
}

function focusHeading(): void {
  if (root === null) {
    return;
  }
  const heading = root.querySelector('h1');
  if (heading instanceof HTMLElement) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

function errorView(message: string): HTMLElement {
  const view = el('div', {});
  view.appendChild(screenHead('Er ging iets mis', message));
  view.appendChild(actionDock([el('a', { class: 'btn btn--primary', href: '#/' }, COMMON.backToGames)], { inline: true }));
  return view;
}

function missingView(): HTMLElement {
  const view = el('div', {});
  view.appendChild(screenHead(COMMON.notFoundTitle, COMMON.notFoundBody));
  view.appendChild(actionDock([el('a', { class: 'btn btn--primary', href: '#/' }, COMMON.backToGames)], { inline: true }));
  return view;
}

async function renderGameRoute(route: Route, app: AppState): Promise<HTMLElement> {
  if (route.name !== 'game' && route.name !== 'scorebord' && route.name !== 'correctie') {
    return missingView();
  }
  const game = await app.store.get(route.id);
  if (game === null) {
    return missingView();
  }
  const session = await GameSession.load(app.store, route.id);
  if (session === null) {
    return missingView();
  }
  const ctx = {
    store: app.store,
    reload: render,
    session,
    game: session.game,
  };

  if (route.name === 'scorebord') {
    setTitle(route.name === 'scorebord' ? 'Scorebord' : APP_NAME);
    return scorebordView(ctx);
  }
  if (route.name === 'correctie') {
    setTitle(`Ronde ${route.round} corrigeren`);
    return correctieView(ctx, route.round);
  }

  const screen = screenForGame(session.game);
  switch (screen) {
    case 'biedingen':
      setTitle('Biedingen');
      return biedingenView(ctx);
    case 'slagen':
      setTitle('Slagen');
      return slagenView(ctx);
    case 'afgelopen':
      setTitle('Afgelopen');
      return afgelopenView(ctx);
    case 'scorebord':
      setTitle('Scorebord');
      return scorebordView(ctx);
  }
}

async function render(): Promise<void> {
  if (state === null || root === null) {
    return;
  }
  const route = parseRoute(window.location.hash);
  if (
    route.name === 'spellen' &&
    window.location.hash !== '' &&
    window.location.hash !== '#' &&
    window.location.hash !== '#/'
  ) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  }

  clear(root);
  try {
    let view: HTMLElement;
    switch (route.name) {
      case 'spellen':
        setTitle('Spellen');
        view = spellenView(await state.store.list(), { store: state.store, reload: render });
        break;
      case 'nieuw':
        setTitle('Nieuw spel');
        view = nieuwSpelView({ store: state.store, reload: render });
        break;
      case 'game':
      case 'scorebord':
      case 'correctie':
        view = await renderGameRoute(route, state);
        break;
    }
    root.appendChild(view);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    root.appendChild(errorView(message));
  }
  window.scrollTo(0, 0);
  focusHeading();
}

export async function boot(): Promise<void> {
  const main = document.getElementById('main');
  if (main === null) {
    throw new Error('#main ontbreekt in de shell');
  }
  root = main;
  const opened = await openGameStore();
  state = { store: opened.store, fallback: opened.fallback, ...(opened.reason === undefined ? {} : { reason: opened.reason }) };
  paintStatus();
  window.addEventListener('hashchange', () => {
    void render();
  });
  window.addEventListener('online', paintStatus);
  window.addEventListener('offline', paintStatus);
  await render();
}

void boot();
