# boerenbridge-scorenboord

Een lokaal-first Boerenbridge-scorebord: één PWA die zonder netwerk een heel potje kan
spelen, en een kleine Go-server voor publiceren, delen en gezondheid.

## Architectuur

```
Browser (geïnstalleerde PWA, offline-first)
  ├─ web/index.html + app.js + app.css        de enige renderer
  ├─ IndexedDB (database `boerenbridge`)      de bron van waarheid
  ├─ web/src/rules.ts                         runtime-regels, 1:1 port van internal/game
  └─ web/src/api.ts                           optioneel publiceren/ophalen

Go-server (één statisch binary, CGO_ENABLED=0)
  ├─ go:embed internal/assets/static          de gebouwde client
  ├─ POST /api/games, GET /api/games/{id}     snapshot-store (SQLite)
  ├─ GET /s/{id}                              alleen-lezen deelpagina zonder JavaScript
  ├─ GET /healthz                             status + commit + versie + schema_version
  └─ echte 404 voor al het andere
```

- De client is de bron van waarheid. Een publish- of netwerkfout mag nooit het scoren of
  invoeren blokkeren.
- De server bewaart snapshots als JSON in SQLite (`internal/db/store.go`). De store start
  leeg met `schema_version = 2`; een andere versie wordt geweigerd, niet geconverteerd.
- Er is geen migratie, geen importeur voor de oude database en geen compatibility-laag.
  De oude `data/db.sqlite` is uit de repo verwijderd; de host-volume wordt bij de deploy
  één keer geback-upt voordat hij leeg begint.
- De regels staan twee keer in de repo, met opzet: `internal/game/game.go` is de
  referentie en `web/src/rules.ts` is de runtime. `testdata/rule-vectors.json` is het
  contract tussen beide testsuites.

## Stack

- Client: TypeScript + esbuild, plain DOM, geen framework, geen runtime-dependency.
- Opslag: IndexedDB op het apparaat; SQLite (`modernc.org/sqlite`, pure Go) op de server.
- PWA: gegenereerde service worker uit de buildoutput, PNG-iconen, offline shell.
- Server: Go 1.23, `html/template` alleen voor de share-pagina, `go:embed` voor assets.
- Taal: Nederlands; alle UI-copy staat in `web/src/copy.ts`.

## Commands

```bash
npm ci
npm run build          # app.js, app.css, sw.js, manifest, icons, precache.json
npm test               # node --test op de TypeScript-bron en de gedeelde vectors
npm run verify:budgets # gzip-budgetten en precache-totaal
npm run icons          # eenmalig PNG's genereren uit web/pwa/*.svg (Playwright)

CGO_ENABLED=0 go build ./...
CGO_ENABLED=0 go test ./...
ADDR=:8080 DB_PATH=./data/snapshots.sqlite go run ./cmd/server
go run ./cmd/server -dbinfo   # schema_version=2 snapshots=0
```

De browsercontroles (`scripts/verify/*.mjs`) gebruiken Playwright en verwachten een
Chromium-installatie. Ze starten zelf een statische server voor de gebouwde assets.

## Structuur

```
cmd/server/               HTTP: assets, API, share, healthz, -dbinfo
internal/assets/          go:embed van de gegenereerde client
internal/db/              snapshot-store met expliciete schema_version
internal/game/            referentieregels + vector-tests
internal/handlers/        api, share, health, foutafhandeling
internal/version/         versie en commit (ldflags)
web/src/                  app, router, model, regels, opslag, PWA, views
web/pwa/                  manifest-bron en icoonbronnen
scripts/                  build, icoongeneratie, browserverificatie
testdata/                 rule-vectors.json en schema-version.txt
docs/                     spec en design (horen niet in de image)
```

`internal/assets/static/` wordt gegenereerd door `npm run build` en is gecommit, zodat
`go build` zonder Node werkt. Handmatig bewerken is verboden; draai de build opnieuw.

## Spelregels (belangrijk voor implementatie)

- Ronde 1: iedereen krijgt 1 kaart, ronde 2: 2 kaarten, ... tot max
  (`floor(52 / aantal spelers)`), dan weer omlaag (piramide); of alleen omhoog.
- Blinde regel: de biedingen mogen NIET optellen tot exact het aantal kaarten van die ronde.
- Slagen: het totaal aantal gewonnen slagen moet gelijk zijn aan het aantal kaarten per speler.
- Punten als je bod haalt: `10 + 3 × bod`.
- Punten als je bod NIET haalt: `-3 × |bod - slagen|`.

## Conventions

- Alle UI-teksten in het Nederlands, in `web/src/copy.ts`; geen Engelse UI-woorden.
- Geen CDN, geen webfont, geen icon pack, geen framework, geen analytics.
- Alle assets zijn same-origin en precachebaar.
- Houd de client de baas: de server is back-up en deeloppervlak, geen spellogica.
- De service worker wordt nooit met de hand onderhouden; de precache-lijst komt uit de build.
- `data/` hoort niet in de image; `DB_PATH` wijst in de container naar
  `/data/snapshots.sqlite`.

## Deployment

De app draait als één container op poort 8080. De deploy is een aparte stage; deze repo
bevat geen DNS-, TLS- of Dokploy-configuratie. `/healthz` is het bewijs dat een deploy
leeft: het geeft `status`, `commit`, `version` en `schema_version`.

## Geschiedenis

Deze repository bevatte eerder twee apps in één: een Go + HTMX + SQLite-server en een
DuckDB-WASM-client achter `/offline`. Beide zijn in deze architectuur vervangen. De HTMX-
templates, `static/offline.js`, de oude handmatige service worker en de CDN-assets zijn
verwijderd. `.hermes/plans/` is bewaard gebleven als historie.
