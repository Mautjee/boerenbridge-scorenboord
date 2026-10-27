import type { Game } from './types.ts';

export type Route =
  | { name: 'spellen' }
  | { name: 'nieuw' }
  | { name: 'game'; id: string }
  | { name: 'scorebord'; id: string }
  | { name: 'correctie'; id: string; round: number };

export type GameScreen = 'biedingen' | 'slagen' | 'scorebord' | 'afgelopen';

export function parseRoute(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const parts = path.split('/').filter((part) => part.length > 0).map(decodeURIComponent);

  if (parts.length === 0) {
    return { name: 'spellen' };
  }
  if (parts.length === 1 && parts[0] === 'nieuw') {
    return { name: 'nieuw' };
  }
  if (parts[0] === 'spel' && parts.length === 2 && parts[1] !== undefined) {
    return { name: 'game', id: parts[1] };
  }
  if (parts[0] === 'spel' && parts.length === 3 && parts[1] !== undefined && parts[2] === 'scorebord') {
    return { name: 'scorebord', id: parts[1] };
  }
  if (
    parts[0] === 'spel' &&
    parts.length === 4 &&
    parts[1] !== undefined &&
    parts[2] === 'correctie' &&
    parts[3] !== undefined
  ) {
    const round = Number.parseInt(parts[3], 10);
    if (Number.isInteger(round) && round >= 1) {
      return { name: 'correctie', id: parts[1], round };
    }
  }

  return { name: 'spellen' };
}

export function formatRoute(route: Route): string {
  switch (route.name) {
    case 'spellen':
      return '#/';
    case 'nieuw':
      return '#/nieuw';
    case 'game':
      return `#/spel/${encodeURIComponent(route.id)}`;
    case 'scorebord':
      return `#/spel/${encodeURIComponent(route.id)}/scorebord`;
    case 'correctie':
      return `#/spel/${encodeURIComponent(route.id)}/correctie/${route.round}`;
  }
}

export function screenForGame(game: Game): GameScreen {
  if (game.phase === 'finished') {
    return 'afgelopen';
  }
  if (game.pending === null) {
    return 'scorebord';
  }
  if (game.pending.bids === null) {
    return 'biedingen';
  }
  return 'slagen';
}

export function sameRoute(a: Route, b: Route): boolean {
  return formatRoute(a) === formatRoute(b);
}
