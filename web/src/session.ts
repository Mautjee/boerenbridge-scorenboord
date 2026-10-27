import {
  correctRound,
  createGame,
  submitBids,
  submitTricks,
  undoLastRound,
  type SetupInput,
} from './model.ts';
import type { GameStore } from './store.ts';
import type { Game } from './types.ts';

export class GameSession {
  private state: Game;
  private readonly store: GameStore;

  private constructor(store: GameStore, game: Game) {
    this.store = store;
    this.state = game;
  }

  static async create(store: GameStore, input: SetupInput, now = new Date().toISOString()): Promise<GameSession> {
    const saved = await store.save(createGame(input, now));
    return new GameSession(store, saved);
  }

  static async load(store: GameStore, id: string): Promise<GameSession | null> {
    const game = await store.get(id);
    return game ? new GameSession(store, game) : null;
  }

  get game(): Game {
    return this.state;
  }

  async submitBids(bids: number[]): Promise<Game> {
    return this.persist(submitBids(this.state, bids));
  }

  async submitTricks(tricks: number[]): Promise<Game> {
    return this.persist(submitTricks(this.state, tricks));
  }

  async undoLastRound(): Promise<Game> {
    return this.persist(undoLastRound(this.state));
  }

  async correctRound(round: number, bids: number[], tricks: number[]): Promise<Game> {
    return this.persist(correctRound(this.state, round, bids, tricks));
  }

  private async persist(next: Game): Promise<Game> {
    this.state = await this.store.save(next);
    return this.state;
  }
}
