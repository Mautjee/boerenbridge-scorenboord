import type { GameSession } from '../session.ts';
import type { GameStore } from '../store.ts';
import type { Game } from '../types.ts';

export interface ViewContext {
  store: GameStore;
  reload: () => Promise<void>;
}

export interface GameViewContext extends ViewContext {
  session: GameSession;
  game: Game;
}
