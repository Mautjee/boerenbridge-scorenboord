declare const __PRECACHE__: string[];
declare const __CACHE_NAME__: string;

interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEventLike extends Event {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

interface MessageEventLike extends Event {
  data: unknown;
}

interface ClientLike {
  postMessage(message: unknown): void;
}

interface WorkerScope {
  addEventListener(type: string, listener: (event: Event) => void): void;
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    matchAll(options?: { type?: string; includeUncontrolled?: boolean }): Promise<ClientLike[]>;
  };
  location: Location;
}

const worker = self as unknown as WorkerScope;
const CACHE_NAME = __CACHE_NAME__;
const CORE_URLS = ['/', '/static/app.js', '/static/app.css'];

function logFailure(url: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[sw] precache mislukt voor ${url}: ${message}`);
}

worker.addEventListener('install', (event) => {
  const installEvent = event as ExtendableEventLike;
  installEvent.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const failures: Array<{ url: string; error: string }> = [];
      for (const url of __PRECACHE__) {
        try {
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          await cache.put(url, response);
        } catch (error) {
          logFailure(url, error);
          failures.push({
            url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const clients = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'PRECACHE_RESULT', cache: CACHE_NAME, failures });
      }
    })(),
  );
});

worker.addEventListener('activate', (event) => {
  const activateEvent = event as ExtendableEventLike;
  activateEvent.waitUntil(
    (async () => {
      const names = await caches.keys();
      for (const name of names) {
        if (name !== CACHE_NAME) {
          await caches.delete(name);
        }
      }
      await worker.clients.claim();
    })(),
  );
});

function isNavigation(request: Request): boolean {
  return request.mode === 'navigate';
}

async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('netwerktimeout')), 2000);
      }),
    ]);
    const path = new URL(request.url).pathname;
    if (response.ok && (path === '/' || path === '/index.html')) {
      await cache.put('/', response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await caches.match('/');
    if (cached !== undefined) {
      return cached;
    }
    return new Response('Offline en geen opgeslagen app gevonden.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached !== undefined) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

worker.addEventListener('fetch', (event) => {
  const fetchEvent = event as FetchEventLike;
  const request = fetchEvent.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== worker.location.origin) {
    return;
  }
  if (url.pathname === '/static/sw.js') {
    return;
  }
  fetchEvent.respondWith(isNavigation(request) ? networkFirst(request) : cacheFirst(request));
});

worker.addEventListener('message', (event) => {
  const message = (event as MessageEventLike).data;
  if (message !== null && typeof message === 'object' && 'type' in message) {
    const type = (message as { type?: unknown }).type;
    if (type === 'SKIP_WAITING') {
      void worker.skipWaiting();
    }
  }
});

export { CORE_URLS };
