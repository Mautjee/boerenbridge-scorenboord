import { SCHEMA_VERSION, type Game } from './types.ts';

export interface GameStore {
  list(): Promise<Game[]>;
  get(id: string): Promise<Game | null>;
  save(game: Game): Promise<Game>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface StoreOpenResult {
  store: GameStore;
  fallback: boolean;
  reason?: string;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-verzoek mislukt'));
  });
}

function cloneGame(game: Game): Game {
  return {
    ...game,
    setup: {
      ...game.setup,
      players: game.setup.players.map((player) => ({ ...player })),
    },
    rounds: game.rounds.map((round) => ({
      ...round,
      bids: [...round.bids],
      tricks: [...round.tricks],
      scores: [...round.scores],
    })),
    pending: game.pending ? { ...game.pending, bids: game.pending.bids ? [...game.pending.bids] : null } : null,
  };
}

function isCurrentSchema(game: Game): boolean {
  return game.schemaVersion === SCHEMA_VERSION;
}

function newestFirst(a: Game, b: Game): number {
  const byUpdate = b.updatedAt.localeCompare(a.updatedAt);
  if (byUpdate !== 0) {
    return byUpdate;
  }
  const byCreated = b.createdAt.localeCompare(a.createdAt);
  return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id);
}

export class MemoryStore implements GameStore {
  private readonly games = new Map<string, Game>();

  async list(): Promise<Game[]> {
    return Array.from(this.games.values()).map(cloneGame).sort(newestFirst);
  }

  async get(id: string): Promise<Game | null> {
    const game = this.games.get(id);
    return game ? cloneGame(game) : null;
  }

  async save(game: Game): Promise<Game> {
    const saved = { ...cloneGame(game), updatedAt: new Date().toISOString() };
    this.games.set(saved.id, saved);
    return cloneGame(saved);
  }

  async remove(id: string): Promise<void> {
    this.games.delete(id);
  }

  async clear(): Promise<void> {
    this.games.clear();
  }
}

export class IndexedDbStore implements GameStore {
  private readonly dbName: string;
  private readonly factory: IDBFactory;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName = 'boerenbridge', factory: IDBFactory = globalThis.indexedDB) {
    this.dbName = dbName;
    this.factory = factory;
  }

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise !== null) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('games')) {
          const games = db.createObjectStore('games', { keyPath: 'id' });
          games.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB kon niet worden geopend'));
      request.onblocked = () => reject(new Error('IndexedDB is geblokkeerd door een ander tabblad'));
    });

    return this.dbPromise;
  }

  async list(): Promise<Game[]> {
    const db = await this.open();
    const request = db.transaction('games', 'readonly').objectStore('games').getAll() as IDBRequest<Game[]>;
    const games = await requestToPromise(request);
    return games.filter(isCurrentSchema).map(cloneGame).sort(newestFirst);
  }

  async get(id: string): Promise<Game | null> {
    const db = await this.open();
    const request = db.transaction('games', 'readonly').objectStore('games').get(id) as IDBRequest<Game | undefined>;
    const game = await requestToPromise(request);
    return game !== undefined && isCurrentSchema(game) ? cloneGame(game) : null;
  }

  async save(game: Game): Promise<Game> {
    const db = await this.open();
    const saved = { ...cloneGame(game), updatedAt: new Date().toISOString() };
    const request = db.transaction('games', 'readwrite').objectStore('games').put(saved) as IDBRequest<IDBValidKey>;
    await requestToPromise(request);
    return cloneGame(saved);
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    const request = db.transaction('games', 'readwrite').objectStore('games').delete(id) as IDBRequest<undefined>;
    await requestToPromise(request);
  }

  async clear(): Promise<void> {
    const db = await this.open();
    const request = db.transaction('games', 'readwrite').objectStore('games').clear() as IDBRequest<undefined>;
    await requestToPromise(request);
  }

  async getMeta(key: string): Promise<string | null> {
    const db = await this.open();
    const request = db.transaction('meta', 'readonly').objectStore('meta').get(key) as IDBRequest<
      { key: string; value: string } | undefined
    >;
    const row = await requestToPromise(request);
    return row ? row.value : null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    const db = await this.open();
    const request = db.transaction('meta', 'readwrite').objectStore('meta').put({ key, value }) as IDBRequest<IDBValidKey>;
    await requestToPromise(request);
  }
}

export async function openGameStore(dbName = 'boerenbridge', factory?: IDBFactory): Promise<StoreOpenResult> {
  const indexedDbStore = new IndexedDbStore(dbName, factory);
  try {
    await indexedDbStore.list();
    return { store: indexedDbStore, fallback: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'IndexedDB is niet beschikbaar';
    return { store: new MemoryStore(), fallback: true, reason };
  }
}
