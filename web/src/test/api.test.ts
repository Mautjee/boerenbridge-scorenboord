import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchSnapshot, publish } from '../api.ts';
import { API } from '../copy.ts';
import { createGame } from '../model.ts';
import type { Game } from '../types.ts';

const NOW = '2026-10-27T12:00:00.000Z';
const realFetch = globalThis.fetch;

function game(): Game {
  return createGame({ names: ['Sanne', 'Mauro'], direction: 'up_only', maxCards: 1 }, NOW);
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): void {
  globalThis.fetch = handler as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('publish reports a freshly created snapshot as success', async () => {
  const published = game();
  mockFetch(async () => jsonResponse(201, { id: published.id, revision: published.revision }));

  const result = await publish(published);

  assert.deepEqual(result, { ok: true, id: published.id, revision: published.revision });
});

test('publish treats 409 as success because the stored copy is this-or-newer', async () => {
  const published = game();
  mockFetch(async () =>
    jsonResponse(409, { error: 'Dit spel is al gepubliceerd met een nieuwere versie.' }),
  );

  const result = await publish(published);

  assert.deepEqual(result, { ok: true, id: published.id, revision: published.revision });
});

test('publish keeps every other non-OK response a failure with the server message', async () => {
  mockFetch(async () => jsonResponse(400, { error: 'Ongeldige JSON.' }));

  const result = await publish(game());

  assert.deepEqual(result, { ok: false, message: 'Ongeldige JSON.' });
});

test('publish reports a network failure as offline', async () => {
  mockFetch(async () => {
    throw new TypeError('fetch failed');
  });

  const result = await publish(game());

  assert.deepEqual(result, { ok: false, message: API.offline });
});

test('fetchSnapshot accepts a snapshot in the current schema', async () => {
  const stored = game();
  mockFetch(async () => jsonResponse(200, stored));

  const result = await fetchSnapshot(stored.id);

  assert.deepEqual(result, stored);
});

test('fetchSnapshot rejects a snapshot from another schema version', async () => {
  const stored = game();
  mockFetch(async () => jsonResponse(200, { ...stored, schemaVersion: stored.schemaVersion + 1 }));

  const result = await fetchSnapshot(stored.id);

  assert.deepEqual(result, { error: API.wrongSchema });
});
