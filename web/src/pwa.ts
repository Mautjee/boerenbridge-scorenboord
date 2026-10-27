import { PWA } from './copy.ts';
import { el } from './dom.ts';

const PERSIST_KEY = 'boerenbridge.storagePersisted';

let updateBar: HTMLElement | null = null;
let reloading = false;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 kB';
  }
  const units = ['B', 'kB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toLocaleString('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[index]}`;
}

export async function storageEstimateText(): Promise<string> {
  const storage = navigator.storage;
  if (typeof storage?.estimate !== 'function') {
    return PWA.storageUnknown;
  }
  try {
    const estimate = await storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    if (quota <= 0) {
      return formatBytes(usage);
    }
    return PWA.storageUsage(formatBytes(usage), formatBytes(quota));
  } catch {
    return PWA.storageUnknown;
  }
}

export function requestPersistenceOnce(): void {
  try {
    if (localStorage.getItem(PERSIST_KEY) !== null) {
      return;
    }
    localStorage.setItem(PERSIST_KEY, 'asked');
  } catch {
    return;
  }
  const storage = navigator.storage;
  if (typeof storage?.persist !== 'function') {
    return;
  }
  void storage.persist().then(
    (granted) => {
      try {
        localStorage.setItem(PERSIST_KEY, granted ? 'granted' : 'denied');
      } catch {
        // The marker is a courtesy; a denied request is not an error.
      }
    },
    () => {
      try {
        localStorage.setItem(PERSIST_KEY, 'error');
      } catch {
        // Ignore storage failures; persistence is best-effort.
      }
    },
  );
}

function messageBar(text: string, aria: string, tone: 'update' | 'danger'): HTMLElement {
  if (updateBar !== null) {
    updateBar.remove();
  }
  const bar = el('div', {
    class: `update-bar update-bar--${tone}`,
    role: 'status',
    'aria-live': 'polite',
    'aria-label': aria,
  });
  const label = el('span', { class: 'update-bar__text' }, text);
  bar.appendChild(label);
  updateBar = bar;
  return bar;
}

function showUpdateBar(onReload: () => void): void {
  const bar = messageBar(PWA.updateAvailable, PWA.updateAria, 'update');
  const reloadButton = el('button', { class: 'btn btn--primary btn--sm', type: 'button' }, PWA.reload);
  reloadButton.addEventListener('click', onReload);
  bar.appendChild(reloadButton);
  document.body.appendChild(bar);
}

function showPrecacheFailure(): void {
  const bar = messageBar(PWA.precacheFailed, PWA.precacheFailedAria, 'danger');
  document.body.appendChild(bar);
}

function listenForWorkerUpdates(registration: ServiceWorkerRegistration): void {
  const promptIfReady = (worker: ServiceWorker | null): void => {
    if (worker === null || navigator.serviceWorker.controller === null) {
      return;
    }
    showUpdateBar(() => {
      reloading = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  };

  promptIfReady(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (installing === null) {
      return;
    }
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') {
        promptIfReady(installing);
      }
    });
  });
}

export function registerPwa(): void {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    return;
  }

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: unknown; failures?: unknown } | null;
    if (data === null || typeof data !== 'object' || data.type !== 'PRECACHE_RESULT') {
      return;
    }
    const failures = Array.isArray(data.failures)
      ? data.failures.filter(
          (entry): entry is { url: string; error: string } =>
            entry !== null &&
            typeof entry === 'object' &&
            typeof (entry as { url?: unknown }).url === 'string' &&
            typeof (entry as { error?: unknown }).error === 'string',
        )
      : [];
    for (const failure of failures) {
      console.warn(`[pwa] ${failure.url}: ${failure.error}`);
    }
    const coreFailed = failures.some(
      (failure) => failure.url === '/' || failure.url === '/static/app.js' || failure.url === '/static/app.css',
    );
    if (coreFailed) {
      showPrecacheFailure();
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      return;
    }
    reloading = false;
    window.location.reload();
  });

  void navigator.serviceWorker
    .register('/static/sw.js', { scope: '/' })
    .then((registration) => listenForWorkerUpdates(registration))
    .catch((error: unknown) => {
      console.warn('[pwa] service worker registratie mislukt', error);
    });
}
