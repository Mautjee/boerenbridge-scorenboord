import { PWA } from './copy.ts';
import type { GameStore } from './store.ts';
import { SCHEMA_VERSION, type Game } from './types.ts';

export const BACKUP_FORMAT = 'boerenbridge-backup';

interface BackupFile {
  format: string;
  schemaVersion: number;
  exportedAt: string;
  games: Game[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumberArray(value: unknown, length: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  );
}

function isBackupGame(value: unknown): value is Game {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || typeof value.id !== 'string') {
    return false;
  }
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    return false;
  }
  if (value.phase !== 'active' && value.phase !== 'finished') {
    return false;
  }
  const setup = value.setup;
  if (!isRecord(setup) || !Array.isArray(setup.players) || setup.players.length < 2 || setup.players.length > 8) {
    return false;
  }
  const seats = new Set<number>();
  for (const player of setup.players) {
    if (!isRecord(player) || typeof player.id !== 'string' || typeof player.name !== 'string') {
      return false;
    }
    if (typeof player.seat !== 'number' || !Number.isInteger(player.seat)) {
      return false;
    }
    seats.add(player.seat);
  }
  if (seats.size !== setup.players.length) {
    return false;
  }
  if (setup.direction !== 'up_down' && setup.direction !== 'up_only') {
    return false;
  }
  if (typeof setup.maxCards !== 'number') {
    return false;
  }
  if (!Array.isArray(value.rounds) || typeof value.revision !== 'number') {
    return false;
  }
  const playerCount = setup.players.length;
  for (const round of value.rounds) {
    if (!isRecord(round) || typeof round.round !== 'number' || typeof round.cards !== 'number') {
      return false;
    }
    if (!isNumberArray(round.bids, playerCount) || !isNumberArray(round.tricks, playerCount)) {
      return false;
    }
    if (!isNumberArray(round.scores, playerCount)) {
      return false;
    }
  }
  if (value.pending === null) {
    return value.phase === 'finished';
  }
  if (!isRecord(value.pending)) {
    return false;
  }
  if (typeof value.pending.round !== 'number' || typeof value.pending.cards !== 'number') {
    return false;
  }
  return value.pending.bids === null || isNumberArray(value.pending.bids, playerCount);
}

export function serializeBackup(games: Game[], now = new Date().toISOString()): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    games,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseBackup(text: string): Game[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(PWA.backupInvalid);
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error(PWA.backupInvalid);
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(PWA.backupVersion(Number(parsed.schemaVersion)));
  }
  if (!Array.isArray(parsed.games)) {
    throw new Error(PWA.backupInvalid);
  }
  if (parsed.games.length === 0) {
    throw new Error(PWA.backupEmpty);
  }
  const games: Game[] = [];
  for (const entry of parsed.games) {
    if (!isBackupGame(entry)) {
      throw new Error(PWA.backupInvalid);
    }
    games.push(entry);
  }
  return games;
}

export async function importGames(store: GameStore, games: Game[]): Promise<Game[]> {
  const saved: Game[] = [];
  for (const game of games) {
    saved.push(await store.save(game));
  }
  return saved;
}

export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
