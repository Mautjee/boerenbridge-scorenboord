import { openGameStore } from './store.ts';
import type { GameStore } from './store.ts';

export interface AppBoot {
  store: GameStore;
  fallback: boolean;
  reason?: string;
}

export async function boot(): Promise<AppBoot> {
  return openGameStore();
}
