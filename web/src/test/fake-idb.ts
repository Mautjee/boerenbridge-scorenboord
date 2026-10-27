type RequestHandler = (() => unknown) | null;

export class FakeRequest<T> {
  result: T = undefined as T;
  error: Error | null = null;
  onsuccess: RequestHandler = null;
  onerror: RequestHandler = null;
  onupgradeneeded: RequestHandler = null;
  onblocked: RequestHandler = null;
}

export class FakeObjectStore {
  readonly keyPath: string;
  private readonly rows = new Map<unknown, Record<string, unknown>>();

  constructor(keyPath: string) {
    this.keyPath = keyPath;
  }

  createIndex(): void {
    return undefined;
  }

  put(value: Record<string, unknown>): FakeRequest<unknown> {
    const key = value[this.keyPath];
    this.rows.set(key, value);
    const request = new FakeRequest<unknown>();
    request.result = key;
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }

  get(key: unknown): FakeRequest<unknown> {
    const request = new FakeRequest<unknown>();
    request.result = this.rows.get(key);
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }

  getAll(): FakeRequest<unknown[]> {
    const request = new FakeRequest<unknown[]>();
    request.result = Array.from(this.rows.values());
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }

  delete(key: unknown): FakeRequest<undefined> {
    this.rows.delete(key);
    const request = new FakeRequest<undefined>();
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }

  clear(): FakeRequest<undefined> {
    this.rows.clear();
    const request = new FakeRequest<undefined>();
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }
}

export class FakeDatabase {
  readonly name: string;
  readonly stores = new Map<string, FakeObjectStore>();

  constructor(name: string) {
    this.name = name;
  }

  get objectStoreNames(): { contains: (name: string) => boolean } {
    return { contains: (name: string) => this.stores.has(name) };
  }

  createObjectStore(name: string, options?: { keyPath?: string }): FakeObjectStore {
    const store = new FakeObjectStore(options?.keyPath ?? 'id');
    this.stores.set(name, store);
    return store;
  }

  transaction(name: string): { objectStore: (storeName: string) => FakeObjectStore } {
    const store = this.stores.get(name);
    if (store === undefined) {
      throw new Error(`Onbekende object store: ${name}`);
    }
    return {
      objectStore: (storeName: string): FakeObjectStore => {
        const found = this.stores.get(storeName);
        if (found === undefined) {
          throw new Error(`Onbekende object store: ${storeName}`);
        }
        return found;
      },
    };
  }

  close(): void {
    return undefined;
  }
}

export class FakeIndexedDB {
  private readonly databases = new Map<string, FakeDatabase>();

  open(name: string): FakeRequest<FakeDatabase> {
    const request = new FakeRequest<FakeDatabase>();
    queueMicrotask(() => {
      let database = this.databases.get(name);
      const isNew = database === undefined;
      if (database === undefined) {
        database = new FakeDatabase(name);
        this.databases.set(name, database);
      }
      request.result = database;
      if (isNew) {
        request.onupgradeneeded?.();
      }
      request.onsuccess?.();
    });
    return request;
  }

  seed(name: string): FakeDatabase {
    let database = this.databases.get(name);
    if (database === undefined) {
      database = new FakeDatabase(name);
      this.databases.set(name, database);
    }
    return database;
  }
}
