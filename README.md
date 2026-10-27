# Boerenbridge Scorebord

Een Boerenbridge-scorebord dat op één telefoon aan tafel werkt, ook zonder internet.
De app is een installeerbare PWA; de Go-server is er voor publiceren, delen en gezondheid.

## Wat het doet

- 2 tot 8 spelers, piramide of alleen omhoog, optioneel een maximum aantal kaarten.
- Biedingen en slagen invoeren met steppers en een toetsenblok; de blinde regel wordt live
  gecontroleerd en blokkeert een ongeldige ronde.
- Tussenstand, per-ronde-matrix, ongedaan maken en een gespeelde ronde corrigeren.
- Alles wordt direct in IndexedDB op het apparaat bewaard; de app werkt volledig offline.
- Een afgelopen potje kan als alleen-lezen pagina gedeeld worden (`/s/{id}`) en als JSON
  worden geëxporteerd of teruggezet.

## Spelregels

- Ronde 1: 1 kaart per speler, ronde 2: 2 kaarten, ... tot `floor(52 / spelers)`, dan
  weer omlaag (piramide) of stoppen bij de top (alleen omhoog).
- **Blinde regel**: de biedingen mogen samen niet precies het aantal kaarten zijn.
- **Bod gehaald**: `10 + 3 × bod`.
- **Bod niet gehaald**: `-3 × |bod - slagen|`.
- Het totaal aantal slagen moet gelijk zijn aan het aantal kaarten per speler.

## Ontwikkelen

Vereisten: Node 22 en Go 1.23.

```bash
npm ci
npm run build
npm test
npm run verify:budgets

CGO_ENABLED=0 go build ./...
CGO_ENABLED=0 go test ./...
ADDR=:8080 DB_PATH=./data/snapshots.sqlite go run ./cmd/server
```

Open http://localhost:8080. De server opent `data/snapshots.sqlite` (leeg, `schema_version=2`);
hij leest nooit de oude database.

De gebouwde client staat in `internal/assets/static/`. Die map is gegenereerd en gecommit,
zodat `go build` zonder Node werkt. Draai `npm run build` na elke wijziging in `web/`.

## Server

- `POST /api/games` — snapshot publiceren (max. 64 KiB, alleen `application/json`).
- `GET /api/games/{id}` — snapshot ophalen.
- `GET /s/{id}` — alleen-lezen scorebord, server-gerenderd en zonder JavaScript.
- `GET /healthz` — `status`, `commit`, `version`, `schema_version`.
- `./boerenbridge -dbinfo` — `schema_version=2 snapshots=0` zonder HTTP.

## Docker

```bash
docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -t boerenbridge .
docker run -p 8080:8080 -v boerenbridge_data:/data boerenbridge
```

De image bouwt en test de client in een Node-stage, bouwt daarna de Go-binary met
`CGO_ENABLED=0`, en kopieert alleen de binary naar de runtime-image. De assets zitten via
`go:embed` in de binary.

## Architectuur

De client is de bron van waarheid: `web/src/model.ts` en `web/src/rules.ts` bezitten het
spel, `web/src/store.ts` bewaart elke mutatie in IndexedDB. De Go-server bewaart
gepubliceerde snapshots in SQLite en rendert de share-pagina. Er is geen HTMX, geen
DuckDB, geen CDN en geen tweede spellogica op de server.

Zie `AGENTS.md` voor de volledige conventies en `docs/spec-v2.md` voor de specificatie.
