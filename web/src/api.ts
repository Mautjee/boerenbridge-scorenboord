import { API } from './copy.ts';
import type { Game } from './types.ts';

export type PublishResult =
  | { ok: true; id: string; revision: number }
  | { ok: false; message: string };

function errorMessage(payload: unknown, fallback: string): string {
  if (payload !== null && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

export async function publish(game: Game): Promise<PublishResult> {
  try {
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, message: errorMessage(payload, API.publishFailed) };
    }
    if (payload === null || typeof payload !== 'object') {
      return { ok: false, message: API.publishFailed };
    }
    const record = payload as { id?: unknown; revision?: unknown };
    if (typeof record.id !== 'string' || typeof record.revision !== 'number') {
      return { ok: false, message: API.publishFailed };
    }
    return { ok: true, id: record.id, revision: record.revision };
  } catch {
    return { ok: false, message: API.offline };
  }
}

export async function fetchSnapshot(id: string): Promise<Game | { error: string }> {
  try {
    const response = await fetch(`/api/games/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { error: errorMessage(payload, API.fetchFailed) };
    }
    if (payload === null || typeof payload !== 'object') {
      return { error: API.fetchFailed };
    }
    return payload as Game;
  } catch {
    return { error: API.offline };
  }
}

export function shareUrl(id: string): string {
  return `${window.location.origin}/s/${encodeURIComponent(id)}`;
}
