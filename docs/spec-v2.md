---
issue: SOOT-33 (parent), SOOT-34 (this gate)
status: ready for design + build
branch: soot-33-pwa-v2
base: main @ dfc3b2886747df379ad46c52d54e423ea5acaec8 (2026-08-11)
re-verified: 2026-10-27
revision: 2 (clean slate — no migration, parent rev 8)
supersedes: templates/, static/offline.js, static/sw.js, internal/handlers/handlers.go
---

# boerenbridge v2 — spec

One local-first PWA replaces the server-rendered Go+HTMX app and the DuckDB-WASM
`/offline` app. The client owns state, rules and rendering. Go owns HTTP, published
snapshots, and a read-only share page. A game survives airplane mode, a closed tab, and a
dead server.

**Success:** open the app once on a phone, add it to the home screen, enable airplane
mode, play a full 2–8 player pyramid game, close the app, reopen it — the scoreboard is
still there. No CDN, no 30 MB download, no second code path.

---

## 0. How to read this document

- §1 is the decision record: what we build and what we delete. It is normative.
- §2 is the re-verified diagnosis. Every claim from the work order is marked
  **confirmed**, **corrected**, or **not reproducible**, with the command and output.
- §3 is the target shape: layout, data model, signatures, contracts.
- §4 is the file-by-file change list with the owning build unit (3.1–3.4). No file is
  owned by two units without a stated ordering reason.
- §5 is the clean-slate reset: back up once, start empty, explicit `schema_version`.
- §6 restates AC-1…AC-26 as executable checks with a named owner stage.
- §7 is out of scope. §8 is open questions. §9 is the handoff note per stage.

Commands assume the repo root. `$PWD` is the checkout path. Go commands use the Docker
fallback from §2.10 because **no Go toolchain exists on this host or in the build
sandbox**.

---

## 1. Decision record (ADR)

### 1.1 Context

Two applications share one repo:

1. `cmd/server` — Go + `html/template` + HTMX + Tailwind-from-CDN + server SQLite. Every
   scoreboard interaction is an HTTP round-trip. No game list, no resume, no undo.
2. `/offline` — `static/offline.js` (1,085 lines), a second full implementation of the
   rules and UI on DuckDB-WASM, in memory, with no persistence call and no service worker
   registration of its own.

Neither survives the condition a scoreboard must survive: no network at the table. The
installed PWA (`start_url: /offline`) opens the second app, which cannot persist a game.
The browser app needs a live server. The service worker's precache is all-or-nothing
across nine CDN URLs. This is an architecture problem, not a bug queue.

### 1.2 D1 — Local-first client, thin Go API

**Decision.** The installed app is a static shell (`index.html` + `app.js` + `app.css`)
that owns the game object, the rules and all rendering. IndexedDB is the source of truth.
The Go server serves the shell and stores *published copies* of snapshots.

```
Browser (installed PWA)
  index.html + app.js + app.css + sw.js      same-origin, precached
  state:   one Game object -> IndexedDB on every mutation
  rules:   web/src/rules.ts                  runtime rule engine
  render:  plain DOM view functions
  api:     optional publish / fetch / share

Go (single static binary, CGO_ENABLED=0)
  go:embed all:static -> /, /static/*
  POST /api/games, GET /api/games/{id}       snapshot store (SQLite)
  GET  /s/{id}                               read-only HTML, zero JS
  GET  /healthz                              commit + version
```

**Alternatives rejected.**

- *Keep HTMX and add a write queue.* The source of truth would be the server while the
  device is offline — exactly the failing condition. Replaying queued form POSTs across a
  reload needs client-side IDs, idempotency keys, ordering and conflict rules, and it
  still keeps two renderers. Strictly more moving parts than owning state locally.
- *Static hosting only, no server.* Loses the share link and the backup target, and the
  Go surface is ~400 lines. Keep it. Consequence: the app must work when the server is
  unreachable — the server is never on the critical path.
- *A sync server.* §8.3 rules out multi-device play. Publishing is a manual snapshot
  share, not sync.

**Consequence.** One writer (the browser). The server never computes a score on the
serving path.

### 1.3 D2 — No framework

**Decision.** Plain TypeScript, bundled by esbuild as a dev dependency only. One
`app.js`, one `app.css`.

**Why.** Six screens, one state object, hash routing, no server data fetching on the
render path. A framework adds a build chain, a bundle, a component model and a
reconciliation layer to solve problems this app does not have. There is no virtual DOM
because the app re-renders one screen from one object in <1 ms.

**Alternatives rejected.** React/Vue/Svelte/Solid/Preact (bundle + build + paradigm for
six screens); Web Components (shadow DOM fights the global token sheet and the player
palette); alpine.js/htmx (runtime dependency, DOM-as-state).

### 1.4 D3 — IndexedDB, not DuckDB / sql.js / OPFS-SQLite

**Decision.** One IndexedDB database with two object stores (`games`, `meta`), one
`put` per mutation.

**Why.** A game is ≤8 players × ≤51 rounds × 3 small ints ≈ 12 KB of structured data.
IndexedDB is native, transactional, persistent on iOS Safari 16+ and Android Chrome,
costs zero bytes to download, and stores structured objects without a serializer. We do
not need SQL: the only queries are "all games", "one game by id", "delete one".

**Rejected with numbers.**

- DuckDB-WASM — ~30 MB, 120 s timeout, in-memory only in the current code, broken on
  mobile (§2.2). Out.
- `sql.js` — ~1.5 MB WASM plus a manual export-to-disk step, to store 12 KB. Out.
- OPFS-SQLite — still a WASM download, plus worker/COOP-COEP constraints, plus a schema
  with nothing to join. Out.
- `localStorage` — synchronous, 5 MB, string-only. Out.

**Consequence.** No SQL, no OPFS, no COOP/COEP, no SharedArrayBuffer. The header block
that exists only for DuckDB threads is deleted.

### 1.5 D4 — One rule engine at runtime; Go stays as the reference

**Decision.** `web/src/rules.ts` is the only rule engine in the shipped app. Go's
`internal/game` stays in the repo as the reference implementation and the source of
`testdata/rule-vectors.json`. It is never on the serving path, and no other package
imports it.

**Why.** §1.8 says keep the tested Go rules. The cheapest honest way to keep them is: the
Go package produces the frozen vectors; the TS port is tested against those same vectors
in both suites. Drift becomes a red test, not a bug at the table.

**Guard.** The Go HTTP handlers must not call `game.CalculateScore`. Publish validation
checks *structure and arithmetic invariants* (array lengths, contiguous rounds, tricks sum
= cards, bids sum ≠ cards) — not scoring. If a future change adds scoring to the server,
that is a second engine and the Quality gate must reject it.

### 1.6 D5 — The service worker is generated, never hand-maintained

**Decision.** `scripts/build.mjs` emits the precache list from the explicit build outputs
plus `/`, embeds it in `sw.js` as a define, and also writes
`internal/assets/static/precache.json` for auditors. Cache name is
`boerenbridge-<content-hash>`.

**Why.** The current list is hand-maintained and all-or-nothing across nine CDN URLs
(§2.3). A generated list cannot drift from what shipped, and a per-URL install loop with
error reporting cannot fail silently.

### 1.7 Delete list (normative)

Deleted by unit 3.4 unless marked otherwise:

| Deleted | Why |
|---|---|
| `templates/` (all 12 `.html`) | server-rendered game screens; one renderer only |
| `templates/offline.html` | the second app's shell |
| `static/offline.js` | second rule engine + DuckDB queries (1,085 lines) |
| old `static/sw.js` content | replaced by the generated SW; the whole root `static/` directory disappears and the build output lives under `internal/assets/static/` |
| `static/icon-192.svg`, `static/icon-512.svg` | replaced by PNG 192/512/maskable + apple-touch 180 (unit 3.3) |
| `static/.gitkeep` | the root `static/` directory is removed entirely |
| `html/template` import + `SetTemplates` | no templates |
| HTMX (`unpkg.com/htmx.org@1.9.10`) | server fragments + PWA conflict (§2.5) |
| `cdn.tailwindcss.com` | browser JIT compiler; the CDN and the `type="text/tailwindcss"` block |
| `chart.js` (`cdn.jsdelivr.net`) | 200 KB for a chart we redraw as inline SVG in ≤40 lines |
| DuckDB-WASM + Apache Arrow (`cdn.jsdelivr.net`) | §1.4 |
| COOP/COEP header block (`internal/handlers/handlers.go:107–108`) | existed only for DuckDB threads |
| `GET /` catch-all | unknown paths must 404, not render the home page (§2.8) |
| `build.sh` | build moves to `npm run build` + `go build` |
| `COPY templates/` and `COPY static/` in the `Dockerfile` | those directories no longer exist; assets are embedded |

Kept (do not delete): `internal/game/game.go`, `internal/game/game_test.go` (rewritten to
read vectors), `internal/db` (rewritten, same package path), `PROMPT.md`, `.hermes/`,
`.pi/`, `.grove/`.

### 1.8 Consequences

- The shipped app has no server dependency. Killing the Go process must not break a
  cached session (AC-11).
- The server is a backup/share surface, not a source of truth. A publish failure must
  never block scoring or round entry.
- Two rule *implementations* remain in the repo, on purpose: one runtime, one reference.
  The vector file is the contract between them.
- The old `data/db.sqlite` is not shipped in the image (`.dockerignore` already excludes
  `data/`) and is not the real data (§2.9). It is deleted from the tree in 3.4; the host
  volume is backed up once and wiped (§5). Nothing converts it.

---

## 2. Re-verified diagnosis — 2026-10-27

Working tree at `dfc3b28`, branch `soot-33-pwa-v2` created from it. All commands were run
from the repo root on this host; Go commands were run in `golang:1.23-alpine` because no
Go toolchain is installed (§2.10).

### 2.1 Line counts and the two apps — confirmed with one correction

```
$ wc -l cmd/server/main.go internal/db/db.go internal/game/game.go \
        internal/game/game_test.go internal/handlers/handlers.go \
        static/offline.js static/sw.js static/manifest.json templates/*.html
     56 cmd/server/main.go
    298 internal/db/db.go
     81 internal/game/game.go
    201 internal/game/game_test.go
    613 internal/handlers/handlers.go
   1085 static/offline.js
     56 static/sw.js
     23 static/manifest.json
     94 templates/bids.html
     93 templates/game.html
     41 templates/gameover.html
      3 templates/gameover_composite.html
    166 templates/index.html
    118 templates/offline.html
     18 templates/player_row.html
    142 templates/scoreboard.html
    141 templates/scoreboard_oob.html
     46 templates/summary.html
      3 templates/summary_composite.html
    110 templates/tricks.html
```

| Claim | Verdict |
|---|---|
| Two apps, two rule engines, two persistence stories | **confirmed** as two code paths; only the server has a database, and it is empty (§2.8) |
| `templates/` = 12 files | **confirmed** (`ls templates/*.html \| wc -l` → `12`) |
| `templates/` = 1,000+ lines of markup | **corrected**: 975 lines |
| `internal/db/db.go` = 298 | **confirmed** |
| `static/offline.js` = 1,085 | **confirmed** |
| `internal/game/game.go` = 82 | **corrected**: 81 |
| `game_test.go` = 201 | **confirmed** |
| total 3,396 lines | **corrected**: 3,409 for the app scope below |

Reproducible total (all Go/JS/HTML/JSON/SH tracked files):

```
$ git ls-files '*.go' '*.js' '*.html' '*.json' '*.sh' | xargs wc -l | tail -1
  3409 total
```

Rules exist twice:

```
$ grep -nE '^function (roundSequence|totalRounds|cardsForRound|calculateScore|validateBids|validateTricks)' static/offline.js
7:function roundSequence(...)
22:function totalRounds(...)
26:function cardsForRound(...)
32:function calculateScore(...)
37:function validateBids(...)
43:function validateTricks(...)
```

and the same six functions in `internal/game/game.go`. The claim said
`offline.js:7–50`; the block is **7–47**.

**Correction to "two persistence layers":** the client has *no* persistence layer (§2.2).
So the repo has one database engine (server SQLite) and one in-memory DuckDB that is
rebuilt on every load. That is worse than "two databases": there is exactly one place
where games are stored, and it is not the app the PWA installs.

**New finding:** `templates/index.html` is the *new game form* only. The server app has no
game list and no resume — once `/game/{id}` is left, the only way back is the URL. This is
why §2 scope item 5 (undo, resume, list) is not a nice-to-have.

### 2.2 `/offline` cannot persist — confirmed

```
$ grep -n 'db.instantiate\|120000\|db.open\|OPFS\|localStorage\|Stap [0-9]' static/offline.js
209:  logStep('Stap 4/6: DuckDB instantieren (' + ... + 'MB) WASM downloaden)...');
221:      db.instantiate(bundle.mainModule, null, (p) => {
232:      new Promise((_, reject) => setTimeout(() => reject(new Error(
        'Timeout na 120s — WASM duurt te lang. Controleer je internetverbinding.')), 120000)),
677:  const savedView = localStorage.getItem('boerenbridge_scoreboard_view');
730:  localStorage.setItem('boerenbridge_scoreboard_view', 'table');
735:  localStorage.setItem('boerenbridge_scoreboard_view', 'graph');
```

- `grep -n 'db\.open' static/offline.js` → **no output**. The `AsyncDuckDB` is never
  opened against a file or OPFS; `db.connect()` (line 249) creates an in-memory catalog.
- On every load it runs `DROP TABLE IF EXISTS round_results / players / games` and
  recreates them (lines 259–262). The comment says *"no data yet — safe"*. It is safe
  because nothing is ever persisted.
- `grep -c 'assert(' static/offline.js` → `83`.

**Confirmed.** The only client persistence is the table/graph view toggle. Reload = all
scores gone.

### 2.3 The service worker — confirmed, counts corrected

```
$ python3 - <<'EOF'
import re
s=open('static/sw.js').read()
urls=re.findall(r"'([^']+)'", re.search(r'const PRECACHE = \[(.*?)\];', s, re.S).group(1))
print("total", len(urls))
print("cdn", [u for u in urls if u.startswith('http')])
print("same-origin", [u for u in urls if not u.startswith('http')])
EOF
total 14
cdn ['https://cdn.tailwindcss.com', 'https://unpkg.com/htmx.org@1.9.10',
     'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
     'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser.mjs',
     '... duckdb-browser-mvp.worker.js', '... duckdb-browser-eh.worker.js',
     '... duckdb-mvp.wasm', '... duckdb-eh.wasm',
     'https://cdn.jsdelivr.net/npm/apache-arrow@17.0.0/+esm']
same-origin ['/offline', '/static/offline.js', '/static/manifest.json',
             '/static/icon-192.svg', '/static/icon-512.svg']
```

| Claim | Verdict |
|---|---|
| `PRECACHE` = 15 URLs | **corrected**: 14 |
| 6 of them are DuckDB/Arrow CDN assets | **confirmed** (5 DuckDB + 1 Arrow) |
| plus tailwind, htmx, chart.js from three CDNs | **confirmed** (3 distinct hosts; 9 CDN URLs total) |
| `cache.addAll(PRECACHE)` all-or-nothing | **confirmed** — line 24 |
| `.wasm` explicitly skipped | **confirmed** — lines 41–42 |
| literal `'boerenbridge-v5'` | **confirmed** — line 1 |
| forced `skipWaiting()` with no update UI | **confirmed** — line 26 |
| cache-first for everything, HTML included | **confirmed** — `caches.match(...)` before `fetch` (lines 45–52) |

**New finding (worse than the claim):** `templates/offline.html` does not register the
service worker at all — `grep -n serviceWorker templates/offline.html` returns nothing.
`index.html` and `game.html` register `/static/sw.js`; the page that the manifest installs
(`/offline`) does not. So the installed app has no service worker on first launch.

### 2.4 The manifest — confirmed

```
$ python3 -c "import json;d=json.load(open('static/manifest.json'));print(list(d.keys()))"
['name','short_name','description','start_url','display','background_color','theme_color','icons']
$ python3 -c "...start_url..." ; "...icons..."
start_url /offline
icons [('/static/icon-192.svg','image/svg+xml','any'),
       ('/static/icon-512.svg','image/svg+xml','any maskable')]
```

- `start_url: "/offline"` — **confirmed**. Installing the PWA installs the other app.
- SVG-only icons, `any maskable` on one file — **confirmed**. The space-separated purpose
  list is valid syntax, but one image cannot satisfy both purposes well (the maskable safe
  zone crops it), there is no separate maskable variant, and iOS ignores SVG home-screen
  icons.
- No `id`, `scope`, `orientation`, `screenshots`, `shortcuts` — **confirmed**.
- No PNG icons, no `apple-mobile-web-app-*` meta tags — **confirmed**.
- `templates/offline.html:11` does contain `<link rel="apple-touch-icon">`, but it points
  at `/static/icon-192.svg`. The claim "no apple-touch-icon PNG" is **confirmed**; be
  precise that an SVG link exists.

### 2.5 HTMX and PWA conflict — confirmed (exact lines corrected)

```
$ grep -n 'Cross-Origin' internal/handlers/handlers.go
107:	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
108:	w.Header().Set("Cross-Origin-Embedder-Policy", "credentialless")
```

Live headers, from the deployed origin:

```
$ curl -sSI https://boeren.sooth.dev/offline | grep -i cross-origin
cross-origin-embedder-policy: credentialless
cross-origin-opener-policy: same-origin
```

The block is at **107–108**, not 104–110, and applies only to `/offline`. The argument
holds: the server app is HTML-fragment-per-interaction, the PWA needs local state, and the
COOP/COEP pair exists solely for DuckDB threads. One renderer wins; it is the client.

### 2.6 Docs vs code on scoring — confirmed; no evidence for the docs

```
$ grep -n '10 + 2\|-2 ×\|−2' AGENTS.md README.md
AGENTS.md:40:- Punten als je bod haalt: 10 + 2 per gewonnen slag
AGENTS.md:41:- Punten als je bod NIET haalt: -2 per slag verschil (absoluut verschil)
README.md:20:- **Bod gehaald**: 10 + 2 × aantal slagen
README.md:21:- **Bod niet gehaald**: -2 × |bod - slagen|

$ sed -n '48,57p' internal/game/game.go
func CalculateScore(bid, tricksWon int) int {
	if bid == tricksWon { return 10 + 3*bid }
	...
	return -3 * diff
}

$ docker run --rm -v "$PWD":/src -w /src -e CGO_ENABLED=0 golang:1.23-alpine \
    sh -c 'go build ./... && go test ./...'
BUILD_OK
?   	boerenbridge-scorenboord/cmd/server	[no test files]
?   	boerenbridge-scorenboord/internal/db	[no test files]
?   	boerenbridge-scorenboord/internal/handlers	[no test files]
ok  	boerenbridge-scorenboord/internal/game	0.003s
```

The code, the tests and the *stored* scores agree: `SaveTricksAndScores` writes
`10 + 3*bid` / `-3*diff` (internal/db/db.go:239–252). The docs disagree with both. I found
**no hard evidence that the docs are right** — no historical game in the repo has a score
computed by the `+2` formula (§2.9). The Foreman ruling stands: keep `10 + 3×bod`, fix the
docs. No stop condition triggered.

Also wrong in `AGENTS.md:9`: it says SQLite via `mattn/go-sqlite3`; `go.mod` uses
`modernc.org/sqlite`. Unit 3.1 fixes the scoring lines, unit 3.4 fixes the architecture
text.

### 2.7 Clean slate, no migration — decision recorded

The parent's §8.4 is resolved (rev 8): **the existing game data is disposable.** There is
no migration, no importer, no legacy schema mapping and no compatibility layer. The old
volume is copied once to a dated backup path and listed before it is wiped; the new server
store starts empty with an explicit `schema_version` (§5). The earlier "migration plan"
framing is gone, not deprecated.

The measurement in §2.9 is what makes this safe rather than reckless: the committed
`data/db.sqlite` contains 0 games, and the schema it holds is already older than the code.
There is nothing in the tree to lose and no conversion to maintain.

### 2.8 Live state — confirmed, including the catch-all

```
$ for p in / /nonexistent /healthz /offline /static/manifest.json /static/sw.js; do ... done
/                  -> 200  8869B  sha256:2abe9c6335817617
/nonexistent       -> 200  8869B  sha256:2abe9c6335817617
/healthz           -> 200  8869B  sha256:2abe9c6335817617
/offline           -> 200  6501B  sha256:4d2550172c3a9f32
/static/manifest.json -> 200   534B
/static/sw.js      -> 200  1913B

$ curl -sS https://boeren.sooth.dev/ -o home.html
$ curl -sS https://boeren.sooth.dev/nonexistent -o none.html
$ cmp home.html none.html && echo IDENTICAL
IDENTICAL
```

- `/nonexistent` and `/healthz` return **byte-for-byte the same 8,869-byte home page** with
  200. Confirmed. `cmd/server/main.go:43` registers `GET /` as a catch-all.
- `/` = 8,869 B, `/offline` = 6,501 B, manifest + SW = 200. Confirmed.
- TLS:

```
$ echo | openssl s_client -connect boeren.sooth.dev:443 -servername boeren.sooth.dev \
    2>/dev/null | openssl x509 -noout -issuer -dates
issuer=C = US, O = Let's Encrypt, CN = YR1
notBefore=Sep  1 07:31:49 2026 GMT
notAfter=Nov 30 07:31:48 2026 GMT
```

Confirmed: valid Let's Encrypt certificate, no DNS work needed.

### 2.9 `data/db.sqlite` — **corrected: it is empty, and its schema is stale**

This is the finding that makes the wipe safe.

```
$ ls -l data/
-rw-rw-r-- 1 mauro mauro  4096 ... db.sqlite
-rw-rw-r-- 1 mauro mauro 32768 ... db.sqlite-shm
-rw-rw-r-- 1 mauro mauro 41232 ... db.sqlite-wal

$ mkdir -p /tmp/sqlcopy && cp data/db.sqlite* /tmp/sqlcopy/
$ python3 - <<'EOF'
import sqlite3
con = sqlite3.connect('/tmp/sqlcopy/db.sqlite')
c = con.cursor()
print("integrity:", c.execute("PRAGMA integrity_check").fetchall())
print("tables:", c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall())
for t in ('games','players','round_results'):
    print(t, c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
EOF
integrity: [('ok',)]
tables: [('games',), ('players',), ('round_results',), ('sqlite_sequence',)]
games 0
players 0
round_results 0
```

- The database is readable (integrity `ok`) once you copy it **with** its `-wal` and
  `-shm` siblings. Opening only `db.sqlite` in place is unreliable while the WAL exists.
- **0 rows in all three tables.** "84 KB of existing games" is **not reproducible**: the
  three files total 78,096 bytes and contain no games.
- The committed schema is stale: `games` has `direction` and `total_rounds`, and has **no
  `max_cards`** column, while `internal/db/db.go` queries `max_cards`. The committed DB
  predates the current code. The initial commit (`git log -- data/db.sqlite`) added an
  empty 4,096-byte file; the current schema came in later.

**Consequence.** The real games, if any, live in the Dokploy volume at `/data/db.sqlite`
on the host, not in git. The repo file is a *schema fixture with zero rows*. Therefore:

- the wipe is safe to approve: the tree holds no games to lose and no code reads this
  schema;
- the host volume is still copied once and listed before deletion (§5.2) — the decision is
  to discard the data, not to lose it by accident;
- nobody may claim "84 KB of real games" existed in the repo checkout.

### 2.10 Toolchain reality — new finding, affects every Go gate

```
$ which go || echo 'go: not on PATH'
go: not on PATH
$ ssh sandbox 'which go chromium; ls /opt'
/usr/local/bin/bun
/usr/local/bin/gh
ms-playwright
$ docker info --format '{{.ServerVersion}} {{.Driver}}'
29.8.1 overlay2
$ docker pull golang:1.23-alpine        # succeeds
```

- **No Go toolchain on this host and none in the sandbox.** `go build` / `go test` cannot
  be run natively by stages 3–6. Resolution used by this spec: run Go inside the cached
  `golang:1.23-alpine` image on the host (Docker 29.8.1 is available). Every Go command in
  §6 is written that way. This must not be "solved" by skipping the Go tests.
- **Chromium is not on PATH**, but Playwright + Chromium are installed at
  `/opt/ms-playwright/chromium-1194/chrome-linux/chrome`, and the `playwright` package is
  global at `/usr/local/lib/node_modules/playwright`. Verification scripts load it with
  `createRequire('/usr/local/lib/node_modules/')`. It is a *verification harness*, not a
  project dependency, and never ships.
- `npm` can reach the registry (`npm view esbuild version` → `0.28.2`), so `esbuild` is
  installable as the single dev dependency.
- Node 22 runs TypeScript tests without a compiler:

```
$ node --experimental-strip-types --test '**/*.test.ts'
# tests 1  # pass 1  # fail 0
```

(Node 22.23 expands the quoted glob itself, so the npm script works without shell help.)

This is why `npm test` needs no `ts-node`/`tsx`/`jest` and no second dev dependency.

---

## 3. Target architecture

### 3.1 Repository layout

```
cmd/
  server/main.go              # HTTP only: assets, API, share, healthz, -dbinfo
internal/
  db/store.go                 # snapshot store (SQLite, modernc)
  game/game.go                # UNCHANGED reference implementation
  game/game_test.go           # loads testdata/rule-vectors.json
  handlers/{api,share,health,errors}.go
web/
  index.html                  # shell markup (no build template except __ASSET_VERSION__)
  src/
    types.ts                  # shared types, no logic
    rules.ts                  # 1:1 port of internal/game/game.go
    model.ts                  # pure game-object mutations + validation
    store.ts                  # GameStore interface, IndexedDB + memory impls
    app.ts                     # boot, hash router, store wiring
    router.ts                  # parse/format "#/..." routes
    copy.ts                    # every user-visible string, Dutch
    views/
      spellen.ts nieuwspel.ts biedingen.ts slagen.ts scorebord.ts afgelopen.ts
      components.ts            # stepper, number pad, chip, confirm, round ribbon
    styles/
      tokens.css               # design tokens (unit 3.2 fills from design-v2)
      app.css                  # layout + components
    pwa.ts                    # registration, update prompt, persist, estimate, chip
    sw.ts                     # service worker (bundled to internal/assets/static/sw.js)
    api.ts                    # publish/fetch snapshot
    backup.ts                 # JSON export/import
  pwa/
    manifest.json             # source manifest
    icon.svg                  # icon source (PNG generated once, committed)
    offline.svg               # optional illustrations, own SVG only
internal/assets/
  embed.go                    # //go:embed all:static
  static/                     # GENERATED, COMMITTED build output (see §3.8)
                              # served at URL /static/*, never edited by hand
scripts/
  build.mjs  gen-precache.mjs  gen-icons.mjs
  verify/*.mjs                # Playwright/CDP evidence scripts (§6)
testdata/rule-vectors.json
package.json package-lock.json tsconfig.json .gitignore
docs/spec-v2.md docs/design-v2.md docs/design/** docs/verify/**
Dockerfile .dockerignore
```

`internal/assets/static/` is generated but committed: `go:embed` needs it at compile time
and `go build` must work without Node. A freshness check (`npm run build && git diff
--exit-code -- internal/assets/static/`) enforces that the committed output matches the
sources. The URL path stays `/static/...`; the disk path is
`internal/assets/static/...` (`embed.go` does `fs.Sub(files, "static")`).

### 3.2 Runtime topology

- Install → `start_url: "/"` → server (or SW cache) returns the embedded shell → `app.js`
  boots → `IndexedDbStore` opens → router reads `location.hash` → renders one screen.
- No fetch on boot. The network is used only when the user publishes, shares, or the SW
  updates.
- `navigator.onLine` + `online`/`offline` events drive the status chip. The chip is never a
  gate: every screen renders and every mutation works with the network off.

### 3.3 Data model — the snapshot (normative)

```ts
export type Direction = 'up_down' | 'up_only';
export type GamePhase = 'active' | 'finished';

export interface Player {
  id: string;            // crypto.randomUUID()
  name: string;          // trimmed, 1..40 chars
  seat: number;          // 0..n-1, stable, never reordered
}

export interface CompletedRound {
  round: number;         // 1-based, contiguous
  cards: number;         // cards per player, must equal cardsForRound(round, ...)
  bids: number[];        // length === players.length, indexed by seat
  tricks: number[];      // length === players.length, sums to cards
  scores: number[];      // derived: calculateScore(bids[i], tricks[i]); persisted for audit
}

export interface PendingRound {
  round: number;         // === rounds.length + 1
  cards: number;
  bids: number[] | null; // set when the bidding screen is submitted
}

export interface Game {
  schemaVersion: number;  // must equal SCHEMA_VERSION (currently 2); no other value is read
  id: string;            // UUID v4
  createdAt: string;     // RFC3339, UTC
  updatedAt: string;     // set by the store, not by pure model functions
  phase: GamePhase;      // explicit; a finished game may be shorter than totalRounds (ended early)
  setup: {
    players: Player[];
    direction: Direction;
    maxCards: number;    // 0 = natural (52 / players), otherwise the cap
  };
  rounds: CompletedRound[];
  pending: PendingRound | null;   // null iff phase === 'finished'
  revision: number;      // +1 per mutation; used by the publish endpoint
}
```

Deliberate properties:

- **Totals are never stored.** They are summed from `rounds[].scores` on render. That is
  why correcting round 3 after round 7 is correct by construction, not by a recompute
  loop (AC-19).
- **`scores` is stored per round anyway** so the snapshot is self-describing for the share
  page and the server store. The renderer must not trust it blindly — it derives totals
  from `scores`, and `model` recomputes `scores` whenever bids/tricks change.
- **`seat` is the array index everywhere.** Bids/tricks/score arrays are seat-indexed; no
  object keyed by player id in the snapshot.
- **`pending` has no `tricks`.** Submitting tricks completes a round atomically.
- **`schemaVersion` is normative.** One constant per side (`SCHEMA_VERSION` in
  `web/src/types.ts` and `internal/db/store.go`), both pinned to
  `testdata/schema-version.txt`. The client loads only `schemaVersion === SCHEMA_VERSION`;
  the server rejects any other value and never converts. There is no `legacy` field — old
  snapshots do not exist in this release.
- JSON size for 8 players × 51 rounds ≈ 12 KB. Well inside a 64 KiB API body limit.

### 3.4 Module boundaries and signatures

`web/src/rules.ts` — a 1:1 port; no I/O, no DOM, no imports (`import type` only):

```ts
export function roundSequence(numPlayers: number, direction: Direction, maxCards: number): number[];
export function totalRounds(numPlayers: number, direction: Direction, maxCards: number): number;
export function cardsForRound(roundNum: number, numPlayers: number, direction: Direction, maxCards: number): number;
export function calculateScore(bid: number, tricksWon: number): number;
export function validateBids(bids: number[], cardsPerPlayer: number): string | null;
export function validateTricks(tricks: number[], cardsPerPlayer: number): string | null;
```

Parity is defined on **outcomes**, not message text: vectors assert `valid: true|false`.
The Dutch strings returned by the TS validators are UI copy and live here (the Go strings
stay as-is; the Go handlers that surfaced them are deleted).

`web/src/model.ts` — pure, deterministic, no clock, no storage:

```ts
export type GameErrorCode =
  | 'PLAYER_COUNT' | 'PLAYER_NAME' | 'BID_RANGE' | 'TRICKS_RANGE'
  | 'BLIND_RULE' | 'TRICKS_TOTAL' | 'ROUND_NOT_FOUND' | 'ROUND_LOCKED' | 'GAME_FINISHED';

export class GameError extends Error { code: GameErrorCode }

export interface SetupInput { names: string[]; direction: Direction; maxCards: number }

export function newId(): string;   // crypto.randomUUID() when available (secure context),
                                   // else 16 random bytes from crypto.getRandomValues as hex
export function createGame(input: SetupInput, now: string): Game;
export function submitBids(g: Game, bids: number[]): Game;
export function submitTricks(g: Game, tricks: number[]): Game;
export function undoLastRound(g: Game): Game;                       // see semantics below
export function correctRound(g: Game, round: number, bids: number[], tricks: number[]): Game;
export function totals(g: Game): { playerId: string; name: string; total: number; cumulative: number[] }[];
export function leader(g: Game): string | null;                     // null on a tie for first
export function cardsFor(g: Game, round: number): number;
export function isComplete(g: Game): boolean;
```

Semantics fixed here so 3.1 and 3.2 cannot diverge:

- `submitBids` throws `ROUND_LOCKED` if `pending` is null or already has bids; validates
  length === players, each `0 ≤ bid ≤ pending.cards`, and `validateBids` (sum ≠ cards).
  Sets `pending.bids`; does not complete the round.
- `submitTricks` validates: length === players, each `0 ≤ trick ≤ cards`, sum === cards.
  Builds a `CompletedRound` with recomputed `scores`, advances `pending` to round+1 (or
  `null` + `phase: 'finished'` when it was the last round).
- `undoLastRound`: pops the last `CompletedRound`; sets `pending = { round, cards, bids:
  <popped bids> }` (so the user only re-enters tricks); sets `phase = 'active'`. Undo on a
  finished game reopens it. Undo with `rounds.length === 0` throws `ROUND_NOT_FOUND`.
- `correctRound`: replaces `rounds[round-1]` with the new bids/tricks and recomputed
  `scores`; **does not touch later rounds**; if the game was finished and the corrected
  round is the last one, the game stays finished. Any round may be corrected, including
  one below `rounds.length` (the 3-after-7 case). The view asks for confirmation when
  `round < rounds.length` (overwriting history), not when it is the last round.
- All functions return a **new** object with `revision + 1`; none mutate the input.

`web/src/store.ts`:

```ts
export interface GameStore {
  list(): Promise<Game[]>;                 // newest updatedAt first
  get(id: string): Promise<Game | null>;
  save(game: Game): Promise<Game>;         // sets updatedAt = new Date().toISOString()
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
export class IndexedDbStore implements GameStore { constructor(dbName?: string) }
export class MemoryStore implements GameStore {}
```

IndexedDB: database `boerenbridge`, version `1`, object store `games` (keyPath `id`,
index `updatedAt`) and object store `meta` (keyPath `key`) for `storagePersisted` and the
last import marker. One `put` per mutation inside a `readwrite` transaction, awaited before
the screen re-renders. If `indexedDB.open` fails (private mode, quota), the app falls back
to `MemoryStore` and shows a persistent warning chip: *"Opslag niet beschikbaar — je spel
gaat verloren bij herladen."* Never a silent fallback.

`web/src/api.ts`:

```ts
export type PublishResult =
  | { ok: true; id: string; revision: number }
  | { ok: false; message: string };
export async function publish(game: Game): Promise<PublishResult>;
export async function fetchSnapshot(id: string): Promise<Game | { error: string }>;
export function shareUrl(id: string): string;   // absolute /s/{id}
```

`api.ts` never throws to the caller on network failure; it returns `ok: false` with a Dutch
message and the UI keeps working.

### 3.5 Routing

Hash routing, so the server needs no rewrite rules, `/s/{id}` is unaffected, and a 404 is a
real 404:

| Hash | Screen |
|---|---|
| `#/` (default) | Spellen |
| `#/nieuw` | Nieuw spel |
| `#/spel/:id` | phase-based: bidding → Biedingen, bids set → Slagen, finished → Afgelopen, else Scorebord |
| `#/spel/:id/scorebord` | Scorebord |
| `#/spel/:id/correctie/:round` | the round form pre-filled for correction |

Unknown hash → `#/`. `hashchange` is the only navigation event; no history API.

### 3.6 Server API contract

All JSON responses are `application/json; charset=utf-8`; all errors are
`{"error":"<Dutch sentence>"}`.

**`POST /api/games`** — publish (create or replace) a snapshot.

- Request body: the `Game` object, max 64 KiB (`http.MaxBytesReader`).
- `Content-Type` must be `application/json` → else **415**.
- Validate shape: `schemaVersion === SCHEMA_VERSION` (2), UUID id, 2–8 players, contiguous
  rounds from 1 (`rounds[i].round === i+1`), per-round array lengths === player count,
  `cards` in 1..52, `tricks` sums to `cards`, completed-round `bids` do **not** sum to
  `cards`. Do **not** recompute scores and do **not** import `internal/game`: that package
  is the test reference, not part of the serving path (§1.5). Structural validation only.
- Unknown/malformed → **400** with a specific Dutch sentence.
- New id → **201**; existing id with `revision >` stored → **200**; else **409**
  `{"error":"Dit spel is al gepubliceerd met een nieuwere versie."}`.
- Response: `{"id":"...","revision":N,"schema_version":2}`.

**`GET /api/games/{id}`** → **200** snapshot JSON verbatim (including its
`schemaVersion`); **404** Dutch error.

**`cmd/server -dbinfo`** → opens `DB_PATH`, prints `schema_version=<n> snapshots=<count>`,
exits 0. No HTTP. This is the command that proves the fresh store is empty and versioned.

**`GET /s/{id}`** → **200** server-rendered read-only HTML: game title, date, player names,
per-round matrix, totals, winner. Inline `<style>` allowed; **no `<script>` element at
all**. **404** Dutch HTML page.

**`GET /healthz`** → **200**
`{"status":"ok","commit":"<sha>","version":"2.0.0","schema_version":2}`.
`commit` comes from `-ldflags -X main.commit=...`; the Dockerfile takes `ARG GIT_SHA`.

**`GET /`** → the embedded shell (`index.html`), `Cache-Control: no-cache`.
**`GET /static/*`** → embedded files. `index.html`, `app.js`, `app.css`, `sw.js` and
`manifest.json` are `no-cache` (their URLs never change, so an immutable cache would pin an
old bundle); icons are `public, max-age=3600`. The SW cache name, not the HTTP cache, is
what makes offline fast.
**Anything else** → **404**: HTML for a browser `Accept`, JSON for `/api/*`. The `GET /`
catch-all is removed; `http.ServeMux` patterns `GET /{$}` and `GET /static/` only.

Snapshot store — empty on first start, explicit version, no upgrade path (§5.3):

```sql
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- schema_version = '2'
);

CREATE TABLE IF NOT EXISTS snapshots (
  id             TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,   -- must equal meta.schema_version
  revision       INTEGER NOT NULL,
  published_at   TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  body           BLOB NOT NULL
);
```

`DB_PATH` defaults to `./data/snapshots.sqlite` locally and `/data/snapshots.sqlite` in the
container. **The new server never opens the legacy `db.sqlite`**: it is backed up and
removed before the new image starts (§5.2), and no code path can read it.

### 3.7 Service worker contract

Build-time constants injected into `sw.js`: `__PRECACHE__` (JSON array), `__CACHE_NAME__`
(`boerenbridge-<8 hex of the content hash>`).

- `install`: `caches.open(__CACHE_NAME__)`; for each URL, fetch and `cache.put`
  **individually** in a `try/catch`, collecting `{url, error}`. Never `addAll`. Resolve
  install regardless, then message clients with the failure list. If a *core* URL
  (`/`, `/static/app.js`, `/static/app.css`) failed, the app shows
  *"Offline niet beschikbaar — herlaad met internet."* No silent broken offline.
- `activate`: delete every cache whose name is not `__CACHE_NAME__`; `clients.claim()`.
- `fetch`: only `GET`, same-origin. `request.mode === 'navigate'` → network-first with a
  2 s timeout, then `caches.match('/')`. Other requests → cache-first, then network, and
  `cache.put` only on `response.ok`. Never cache `sw.js`.
- `message`: `{type:'SKIP_WAITING'}` → `self.skipWaiting()`. Nothing else triggers it.
- The page registers `/static/sw.js`, listens for `updatefound`; when a new worker reaches
  `installed` **and** `navigator.serviceWorker.controller` exists, it shows a persistent
  bar: *"Nieuwe versie beschikbaar — Herladen"*. Clicking posts `SKIP_WAITING`, and
  `controllerchange` reloads exactly once. No forced `skipWaiting`.
- `precache.json` (same content, for auditors) is written by the build and must equal the
  inlined list.

### 3.8 Build pipeline

```
npm ci                 # esbuild only (devDependency); no runtime deps
npm run build
  node scripts/build.mjs
    1. esbuild web/src/app.ts      -> OUT/app.js   (bundle, esm, es2022, minify)
    2. esbuild web/src/styles/app.css -> OUT/app.css (bundle, minify)
    3. esbuild web/src/sw.ts       -> OUT/sw.js    (define __PRECACHE__, __CACHE_NAME__)
    4. copy web/index.html         -> OUT/index.html
    5. copy web/pwa/manifest.json  -> OUT/manifest.json
    6. copy web/pwa/icons/*.png    -> OUT/icons/
    7. write OUT/precache.json     (explicit list, sorted)
   where OUT = internal/assets/static/
npm test               # node --experimental-strip-types --test 'web/src/test/**/*.test.ts'
npm run verify:budgets # gzip sizes + precache total, fails over budget
```

- The precache list is **explicit** (the build's outputs + `/` + manifest + icons), never a
  directory scan — so a leftover `offline.js` can never be precached.
- Icons are generated once by `npm run icons` (headless Chromium screenshot of
  `web/pwa/icon.svg` at 192, 512, 192-maskable, 512-maskable, 180) and committed. The
  script is not part of `npm run build`; the Docker image does not need Chromium.
- `npm run build:check` = `npm run build && git diff --exit-code -- internal/assets/static/`.

### 3.9 Budgets (must be printed, not asserted)

| Asset | Budget |
|---|---|
| `internal/assets/static/app.js` gzipped | ≤ 60 KB |
| `internal/assets/static/app.css` gzipped | ≤ 25 KB |
| each icon | ≤ 15 KB |
| first view: `index.html` + `app.js` + `app.css` + manifest + 192 icon (raw) | ≤ 250 KB |
| entire precache list (raw, all files) | ≤ 300 KB |

`npm run verify:budgets` prints every number and exits non-zero over budget.

---

## 4. File-by-file change list

Unit key: **3.1** rules/storage, **3.2** screens, **3.3** PWA, **3.4** server + deletions +
clean-slate reset. Stage: 3 = 3.1, 4 = 3.2, 5 = 3.3 then 3.4.

### 4.1 Created

| Path | Unit | Notes |
|---|---|---|
| `docs/spec-v2.md` | 1 | this file |
| `testdata/rule-vectors.json` | 3.1 | frozen from `dfc3b28`; consumed by Go + TS tests |
| `testdata/schema-version.txt` | 3.1 | contains `2`; **3.4 reads it** to pin the Go constant to the same value as the TS one (ordering: stage 5 after stage 3) |
| `web/src/types.ts` | 3.1 | the §3.3 types only |
| `web/src/rules.ts` | 3.1 | 1:1 port of `internal/game/game.go` |
| `web/src/model.ts` | 3.1 | pure mutations, `GameError` |
| `web/src/store.ts` | 3.1 | `GameStore`, `IndexedDbStore`, `MemoryStore` |
| `web/src/test/rules.test.ts` | 3.1 | reads `../../../testdata/rule-vectors.json` |
| `web/src/test/model.test.ts` | 3.1 | create/bids/tricks/undo/correct-3-after-7 |
| `web/src/test/store.test.ts` | 3.1 | `MemoryStore` round-trip; IDB contract via a fake |
| `package.json`, `package-lock.json` | 3.1 | esbuild only; scripts in §3.8 |
| `tsconfig.json` | 3.1 | `strict`, `noEmit`, `allowImportingTsExtensions` |
| `.gitignore` | 3.1 | `node_modules/`, `.tmp/`, `*.log` (there is none today) |
| `scripts/build.mjs` | 3.1 | esbuild `app.js` + `app.css` and copy the shell; **3.3 appends the SW, manifest, icons and precache steps** (ordering: stage 5 after stage 4) |
| `web/index.html` | 3.2 | shell markup; **3.3 adds PWA head tags** (ordering: stage 5 after stage 4) |
| `web/src/app.ts` | 3.2 | boot + router wiring |
| `web/src/router.ts` | 3.2 | hash parse/format |
| `web/src/copy.ts` | 3.2 | all Dutch strings; **3.3 appends PWA strings** (ordering: stage 5) |
| `web/src/views/*.ts` (7 files) | 3.2 | six screens + components |
| `web/src/styles/tokens.css` | 3.2 | tokens named by `docs/design-v2.md` |
| `web/src/styles/app.css` | 3.2 | layout + components |
| `web/src/test/views.test.ts` | 3.2 | blind-rule blocking, tricks total, confirm matrix |
| `scripts/verify/measure.mjs` | 3.2 | AC-17 |
| `scripts/verify/a11y.mjs` | 3.2 | AC-22 |
| `scripts/verify/motion.mjs` | 3.2 | AC-21 |
| `scripts/verify/contrast.mjs` | 3.2 | AC-20 (reads `docs/design/contrast-pairs.json`) |
| `scripts/verify/network.mjs` | 3.3 | AC-4 |
| `scripts/verify/persist.mjs` | 3.3 | AC-9 |
| `scripts/verify/offline.mjs` | 3.3 | AC-10, AC-11 |
| `scripts/verify/sw.mjs` | 3.3 | AC-15 |
| `scripts/verify/installability.mjs` | 3.3 | AC-13 fallback: CDP `Page.getInstallabilityErrors` |
| `web/src/pwa.ts` | 3.3 | registration, update bar, persist, estimate, chip |
| `web/src/sw.ts` | 3.3 | the SW (§3.7) |
| `web/src/api.ts` | 3.3 | publish/fetch/share |
| `web/src/backup.ts` | 3.3 | JSON export/import for **new** snapshots — the user's own backup. **Not** a legacy importer: it accepts only `schemaVersion === SCHEMA_VERSION` and has no legacy path. 3.4 must not delete it as "compatibility code". |
| `web/pwa/manifest.json` | 3.3 | source manifest |
| `web/pwa/icon.svg` | 3.3 | icon source |
| `scripts/gen-precache.mjs` | 3.3 | precache writer |
| `scripts/gen-icons.mjs` | 3.3 | one-off PNG generation (not in `build`) |
| `internal/assets/static/**` (generated, committed) | build | `index.html`, `app.js`, `app.css`, `sw.js`, `manifest.json`, `precache.json`, `icons/*.png`; regenerated by whichever unit last changed an input, never hand-edited |
| `internal/assets/embed.go` | 3.4 | `//go:embed all:static` |
| `internal/db/store.go` | 3.4 | snapshot store + `meta.schema_version`; refuses to start on a version it does not know (§5.3) |
| `internal/handlers/api.go` | 3.4 | `POST/GET /api/games` |
| `internal/handlers/share.go` | 3.4 | `/s/{id}`, inline template, zero JS |
| `internal/handlers/health.go` | 3.4 | `/healthz` |
| `internal/handlers/errors.go` | 3.4 | Dutch 404/400 helpers |
| `internal/version/version.go` | 3.4 | `Version = "2.0.0"`, `Commit` set by ldflags |
| `scripts/verify/js-off.mjs` | 3.4 | AC-25, JS-disabled render |
| `scripts/verify/make-snapshot.mjs` | 3.4 | AC-24: prints one valid `schemaVersion:2` snapshot |
| `docs/verify/*` | 6, 7, 8 | evidence artifacts for the gates |

### 4.2 Changed

| Path | Unit | Change |
|---|---|---|
| `internal/game/game_test.go` | 3.1 | table cases replaced by a loader for `testdata/rule-vectors.json`; same assertions, wider data |
| `internal/game/game.go` | — | **unchanged** (reference implementation; 3.1 must not touch it) |
| `AGENTS.md` | 3.1 then 3.4 | 3.1: scoring lines 40–41 + a note "architectuurtekst wordt in 3.4 vervangen"; 3.4: full rewrite (ordering: AC-7 must be true at 3.1) |
| `README.md` | 3.1 then 3.4 | 3.1: scoring lines 20–21; 3.4: architecture + run instructions |
| `cmd/server/main.go` | 3.4 | rewrite: embed, API, share, healthz, real 404; `ADDR` env (default `:8080`) |
| `internal/handlers/handlers.go` | 3.4 | **deleted** (replaced by the four files above) |
| `internal/db/db.go` | 3.4 | **replaced** by `store.go` (same package path) |
| `internal/assets/static/manifest.json` | 3.3 | generated, committed |
| `internal/assets/static/sw.js` | 3.3 | generated, committed |
| `Dockerfile` | 3.4 | three stages: `node:22-alpine` build+test → `golang:1.23-alpine` build → `alpine:3.20` runtime; the Go stage copies the freshly built `internal/assets/static` from the Node stage (a stale committed build cannot ship) and also runs `go test ./...`; no `templates/`, no separate `static/` copy (assets are embedded), no Node toolchain in the final image; `ARG GIT_SHA` |
| `.dockerignore` | 3.4 | keep `data/`, `.git`; add `node_modules`, `.tmp`, `docs`. Do **not** exclude `web/`, `scripts/`, `testdata/` — the image build and its tests need them |
| `go.mod`, `go.sum` | 3.4 | only if a new stdlib-only change forces it; **no new module expected** |
| `docs/design-v2.md`, `docs/design/**` | 2 | stage 2 artifact |

### 4.3 Deleted (all unit 3.4 unless noted)

`templates/bids.html`, `game.html`, `gameover.html`, `gameover_composite.html`,
`index.html`, `offline.html`, `player_row.html`, `scoreboard.html`, `scoreboard_oob.html`,
`summary.html`, `summary_composite.html`, `tricks.html` (the whole directory);
`static/offline.js`; `build.sh`; `static/.gitkeep` (3.3); `static/icon-192.svg`,
`static/icon-512.svg` (3.3, moved to `web/pwa/` as a single SVG source);
`data/db.sqlite`, `data/db.sqlite-wal`, `data/db.sqlite-shm` (the 0-row legacy fixture — a
clean slate keeps no stale schema in the tree; the host backup is the safety net, §5.1).

The old `static/sw.js` is not "deleted then recreated": the whole root `static/` directory
is removed and the generated assets live under `internal/assets/static/`. The deletion
proof is both path-based and content-based (§6, AC-3).

### 4.4 Ownership collisions, stated

| File | Units | Why this order is safe |
|---|---|---|
| `scripts/build.mjs` | 3.1 → 3.3 | 3.3 only appends steps 3–7 after 3.1's 1–2 exist and are tested |
| `web/index.html` | 3.2 → 3.3 | 3.3 only adds `<link rel="manifest">`, `apple-touch-icon`, iOS meta tags |
| `web/src/copy.ts` | 3.2 → 3.3 | 3.3 only appends keys for the update bar, export/import, storage |
| `AGENTS.md`, `README.md` | 3.1 → 3.4 | 3.1 makes AC-7 true early; 3.4 owns the architecture rewrite |
| `internal/assets/static/**` | build | generated; no unit hand-edits it; each unit runs `npm run build` and commits the result |

No other file is touched by two units.

---

## 5. Clean slate — back up once, start empty

**Decision (parent §8.4, rev 8).** The existing game data is disposable. There is **no
migration, no importer, no legacy schema mapping and no compatibility layer**. The effort
goes into the new data model being clean and versioned. The old SQLite volume is copied
aside **once** as a safety net and listed before anything is wiped.

This supersedes the parent's §7 sentence *"Back up before migrating data … the existing
games are real people's games."* The backup is still mandatory — deleting the data is
approved, losing it *unintentionally* is not — but it is a one-shot archive, not a source
to convert.

### 5.1 What the reset deletes

Only the legacy database files inside the app's `/data` volume:

```
/data/db.sqlite
/data/db.sqlite-wal
/data/db.sqlite-shm
```

Nothing else in the volume is removed. No `rm -rf`. The new server writes a **new** file,
`/data/snapshots.sqlite`; it never opens `db.sqlite`. The repo's own `data/db.sqlite*`
(0 rows, stale schema) is deleted in unit 3.4 so the tree carries no stale schema at all.

### 5.2 Reset runbook (stage 7 — exact commands)

The container is stopped first, so the `-wal` is quiescent and the copy is consistent.

```bash
CID=$(docker ps -a --filter name=randomprojects-boerenbridgescorenboord \
        --format '{{.ID}}' | head -1)
VOL=$(docker inspect "$CID" \
        --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}')
test -n "$VOL" || { echo 'no /data mount — stop and report'; exit 1; }

docker stop "$CID"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$VOL/backup-$STAMP"
cp -a "$VOL"/db.sqlite "$VOL"/db.sqlite-wal "$VOL"/db.sqlite-shm \
      "$VOL/backup-$STAMP"/ 2>/dev/null || true
test -f "$VOL/backup-$STAMP/db.sqlite" || { echo 'no db.sqlite in the volume — stop and report'; exit 1; }
( cd "$VOL/backup-$STAMP" && sha256sum db.sqlite* > SHA256SUMS \
  && sha256sum -c SHA256SUMS && ls -l )
# paste the `ls -l` and the checksum verification into the issue BEFORE deleting anything

rm -f "$VOL/db.sqlite" "$VOL/db.sqlite-wal" "$VOL/db.sqlite-shm"
test ! -e "$VOL/db.sqlite" && echo 'legacy files gone; backup kept at'"$VOL/backup-$STAMP"
```

Then deploy the new image (stage 7's normal Dokploy path). On first start the server
creates `/data/snapshots.sqlite`, writes `schema_version = 2`, and stores nothing else.

If the container cannot be stopped in that environment, copy with the app running only
after `PRAGMA wal_checkpoint(TRUNCATE)` on a copy — but stopping is the default and the
only path this spec accepts as evidence.

### 5.3 The store: empty, versioned, and it refuses to guess

```sql
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id             TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision       INTEGER NOT NULL,
  published_at   TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  body           BLOB NOT NULL
);
```

On open:

- store empty → insert `schema_version = <current>` (`2`), create the tables, continue;
- `schema_version == current` → serve;
- `schema_version != current` → **refuse to start** with a Dutch error that says a backup
  must be made and the store reset. There is no upgrade path in this release, by design.
  A version mismatch is a human decision, not an automatic conversion.

`SCHEMA_VERSION` has exactly one value per side and the two are pinned to the same file:
`testdata/schema-version.txt` (`2`), read by the Go test and the `node --test` suite. A
drift between `web/src/types.ts` and `internal/db/store.go` fails both suites.

### 5.4 How the version is surfaced

| Surface | Shape |
|---|---|
| `GET /healthz` | `{"status":"ok","commit":"…","version":"2.0.0","schema_version":2}` |
| `POST /api/games` response | `{"id":"…","revision":N,"schema_version":2}` |
| Snapshot JSON | top-level `"schemaVersion": 2`, validated on write and on import |
| App footer | `versie 2.0.0 · opslag v2 · <storage estimate>` |
| `GET /api/games/{id}` | the stored body verbatim, so its `schemaVersion` is visible |

`cmd/server -dbinfo` opens `DB_PATH`, prints `schema_version=<n> snapshots=<count>` and
exits — the command the Verifier uses to prove the fresh store is empty and versioned:

```
$ docker exec <container> /boerenbridge -dbinfo
schema_version=2 snapshots=0
```

### 5.5 Explicitly not built

- No `cmd/migrate`, no `internal/migration`, no legacy reader, no shape detection, no
  `max_cards` inference, no legacy id mapping, no `report.json`.
- No importer for old rows, and no code that can read the old schema.
- The in-app **JSON export/import** (`web/src/backup.ts`) stays: it is the user's own
  backup of *new* snapshots (§4.3 of the work order), not a legacy importer. Unit 3.3 must
  not delete it, and unit 3.4 must not treat it as compatibility code.

### 5.6 What proves the reset (AC-12)

Three independent facts, all pasted into the delivering issue:

1. the dated backup directory exists, is listed with `ls -l`, and its `SHA256SUMS` verify;
2. the new store reports `schema_version=2 snapshots=0` (`-dbinfo`) and `/healthz` echoes
   the version;
3. `grep -rn 'legacy\|import.*game\|migrat' --include=*.go` finds no compatibility code.

Deleting the data is approved; losing it unintentionally is not.

---

## 6. Acceptance criteria — executable, AC-1…AC-26

Every criterion names the exact check and the stage that proves it. "Stage" means the
pipeline sub-issue: 2 Design, 3 = 3.1, 4 = 3.2, 5 = 3.3+3.4, 6 Quality, 7 Deploy, 8 Verify.

Go commands use the Docker fallback (§2.9). Define these once in your shell:

```bash
goq()  { docker run --rm -v "$PWD":/src -w /src -e CGO_ENABLED=0 \
           golang:1.23-alpine "$@"; }
```

Browser checks run in the sandbox (Playwright). `B=http://127.0.0.1:18080` below; start the
server with `ADDR=:18080`.

**AC-1 — Go build/test green, embedded assets, standalone binary.** Owner: **5** (3.4),
re-proven **7**.

```
docker run --rm -v "$PWD":/src -w /src -e CGO_ENABLED=0 golang:1.23-alpine \
  sh -c 'go build ./... && go test ./...'
mkdir -p .tmp
docker run --rm -v "$PWD":/src -w /src -e CGO_ENABLED=0 golang:1.23-alpine \
  go build -o /src/.tmp/boerenbridge ./cmd/server
rm -rf /tmp/bb && mkdir -p /tmp/bb && cp .tmp/boerenbridge /tmp/bb/
( cd /tmp/bb && DB_PATH=/tmp/bb/snap.sqlite ADDR=:18080 ./boerenbridge & echo $! > /tmp/bb/pid )
sleep 1
curl -fsS http://127.0.0.1:18080/healthz; echo
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/
kill "$(cat /tmp/bb/pid)"
```

Pass: build and all packages `ok`; healthz JSON; `/` = 200 from an empty directory (no
`templates/`, no `static/`). **Never** `pkill` by name — kill the recorded PID only.

**AC-2 — `npm run build` emits the full output; precache is generated.** Owner: **5** (3.3).

```
rm -rf internal/assets/static && npm run build
ls -1 internal/assets/static internal/assets/static/icons
node -e "const p=require('./internal/assets/static/precache.json'); console.log(p.version, p.files.length, p.files.join('\n'))"
node -e "const fs=require('fs');const p=require('./internal/assets/static/precache.json');
  const missing=p.files.map(f=>'./internal/assets'+f).filter(f=>!fs.existsSync(f)); if(missing.length) throw new Error(missing)"
```

Pass: `internal/assets/static/` contains `index.html app.js app.css sw.js manifest.json
precache.json icons/{icon-192,icon-512,maskable-192,maskable-512,apple-touch-180}.png`;
every precache URL (`/static/...`) maps to `internal/assets/static/...`; `sw.js` contains
the same list (print the cache name and the inlined list).

**AC-3 — the old paths are gone.** Owner: **5** (3.4), audited **6**.

```
git grep -nEi 'htmx|duckdb|apache-arrow|cdn\.tailwindcss\.com|unpkg\.com|jsdelivr|chart\.js' \
  -- cmd internal web scripts testdata && echo 'FAIL' || echo 'NO MATCHES'
test ! -e templates && test ! -e static && echo 'OLD PATHS GONE'
! git grep -q 'Cross-Origin' -- cmd internal && echo 'NO COOP/COEP'
grep -c 'addAll\|unpkg\|jsdelivr\|tailwindcss' internal/assets/static/sw.js   # expect 0
```

Pass: `NO MATCHES`, `OLD PATHS GONE`, `NO COOP/COEP`, `0`. The grep is scoped to shipped paths
because this spec and `.hermes/` history legitimately name those tokens; a whole-tree sweep
is reported for context, not used as the gate.

**AC-4 — zero third-party requests in a full session.** Owner: **5** (3.3), re-checked
**8**.

```
node scripts/verify/network.mjs $B
```

Pass: the script prints every request; `new URL(u).origin` is the same for all; output
`THIRD_PARTY_REQUESTS=0`.

**AC-5 — budgets, measured gzipped.** Owner: **5** (3.3).

```
npm run verify:budgets
gzip -c internal/assets/static/app.js  | wc -c
gzip -c internal/assets/static/app.css | wc -c
du -cb $(node -e "console.log(require('./internal/assets/static/precache.json').files.map(f=>'./internal/assets'+f).join(' '))") | tail -1
```

Pass: printed numbers within §3.9.

**AC-6 — the vector file is consumed by both suites.** Owner: **3** (3.1), audited **6**.

```
goq go test ./...
npm test
# mutate one expected value
node -e "const fs=require('fs'),p='testdata/rule-vectors.json';const j=JSON.parse(fs.readFileSync(p));
  j.calculateScore[1].expected+=1; fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')"
goq go test ./...               # MUST fail
npm test                        # MUST fail
git checkout -- testdata/rule-vectors.json
goq go test ./... && npm test   # MUST pass
```

Pass: both suites fail on the mutation and pass after revert. Additionally the reviewer
reads both loaders (no copy of the values in either suite).

**AC-7 — scoring matches the ruling and the docs agree.** Owner: **3** (3.1).

```
goq go test ./internal/game -run TestCalculateScore -v
git grep -n '10 + 3' -- AGENTS.md README.md      # both present
! git grep -nE '10 \+ 2|−2 ×|x 2' -- AGENTS.md README.md   # absent
```

Pass: `CalculateScore(3,3)=19`, `(0,0)=10`, `(5,3)=-6`; docs say `10 + 3×bod` /
`−3×|bod − slagen|`.

**AC-8 — Dutch, specific inline validation; no `alert()`.** Owner: **4** (3.2).

```
npm test -- --test-name-pattern='blinde regel|slagen|totaal'
( git grep -n 'alert(' -- web || echo '0 alerts' )   # expect the literal 0 alerts
```

Pass: the blind-rule case throws with `Biedingen mogen niet samen exact N zijn`; the tricks
case with `Het totaal aantal slagen (X) moet gelijk zijn aan het aantal kaarten per speler
(Y)`; submit is disabled/shows the message before the request; zero `alert(`.

**AC-9 — a game survives close/reopen.** Owner: **5** (3.3), on 3.2 screens.

```
node scripts/verify/persist.mjs $B
```

Pass: the script creates a 4-player game, submits round 1, captures a screenshot, closes
the page, reopens, asserts round 1 and the same totals, screenshots again, and prints the
IndexedDB object (`db 'boerenbridge'`, store `games`, `rounds.length`). Two PNGs + the JSON.

**AC-10 — a full game offline.** Owner: **5** (3.3), re-proven **8**.

```
node scripts/verify/offline.mjs $B
```

The script loads online until `navigator.serviceWorker.controller` is non-null, then sets
`Network.emulateNetworkConditions {offline:true}`, reloads, plays a complete pyramid game
to game over, screenshots start / mid / game over and after reload, and fails if any
console entry matches `net::ERR` or if the final totals differ after reload.

**AC-11 — the app works with the Go server stopped.** Owner: **5** (3.3+3.4), re-proven
**8**.

```
kill "$(cat /tmp/bb/pid)"          # the PID recorded in AC-1
curl -sS -o /dev/null -w '%{http_code}\n' $B || true   # connection refused
node scripts/verify/persist.mjs $B --offline-server    # reload + screenshot
( cd /tmp/bb && DB_PATH=/tmp/bb/snap.sqlite ADDR=:18080 ./boerenbridge & echo $! > /tmp/bb/pid )
```

Pass: connection refused, then the shell still loads and a round can be submitted; screenshot.

**AC-12 — the reset is deliberate, not accidental.** Owner: **5** (3.4: no compatibility
code, versioned empty store) + **7** (host backup + wipe), re-checked **8**.

Criterion, verbatim from parent rev 8:

> The reset is deliberate, not accidental: the old `data/*.sqlite` is copied once to a dated
> backup path on the host and the copy is listed (`ls -l`) in the issue before anything is
> wiped; the fresh store reports its `schema_version`; and
> `grep -rn 'legacy\|import.*game\|migrat' --include=*.go` finds no compatibility code.
> Deleting the old data is approved — losing it *unintentionally* is not.

```
# 1. no compatibility code, no migration package, no stale schema in the tree
grep -rn 'legacy\|import.*game\|migrat' --include=*.go \
  --exclude-dir=node_modules --exclude-dir=.git .          # expect no output
test ! -e cmd/migrate && test ! -e internal/migration && echo 'NO MIGRATION PACKAGES'
test ! -e data/db.sqlite && echo 'STALE REPO DB DELETED'

# 2. the fresh store is empty and versioned (after the first start on the host)
docker exec <container> /boerenbridge -dbinfo              # schema_version=2 snapshots=0
curl -fsS $B/healthz | python3 -m json.tool                # "schema_version": 2
curl -sS -o /dev/null -w '%{http_code}\n' $B/api/games/does-not-exist   # 404

# 3. the backup exists, is listed, and verifies (stage 7; paste into the issue)
VOL=$(docker inspect <container> \
        --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}')
ls -l "$VOL"/backup-* && ( cd "$VOL"/backup-* && sha256sum -c SHA256SUMS )
```

Pass: zero grep hits (`NO MIGRATION PACKAGES`, `STALE REPO DB DELETED`), `schema_version=2
snapshots=0`, `/healthz` echoes 2, an unknown id returns 404, and the backup directory is
listed with a checksum file that verifies. If the only grep hit is a Go import of
`internal/game`, the build must remove that import — not explain it away. The wipe runs
**after** the `ls -l` and checksum output is pasted (§5.2).

**AC-13 — Lighthouse mobile.** Owner: **8**.

```
npx --yes lighthouse@12 https://boeren.sooth.dev \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags='--headless=new' --output=json --output-path=/tmp/lh.json
node -e "const r=require('/tmp/lh.json');console.log(r.categories)"
node scripts/verify/installability.mjs https://boeren.sooth.dev
```

Pass: Performance ≥95, Accessibility 100, Best Practices ≥95, SEO ≥90; state the exact
Lighthouse and Chrome versions printed by the report. Lighthouse 12 **removed the PWA
category**; installability is settled by the CDP
`Page.getInstallabilityErrors` script (empty array) plus AC-14/AC-15. If `npx` cannot reach
the registry, report AC-13 as **not measured** — do not invent scores.

**AC-14 — manifest correctness.** Owner: **5** (3.3), re-proven **8**.

```
curl -fsS https://boeren.sooth.dev/static/manifest.json | python3 -m json.tool
for i in 192 512 maskable-192 maskable-512; do
  curl -fsS -o /dev/null -w "icon-$i %{http_code} %{size_download}\n" \
    "https://boeren.sooth.dev/static/icons/icon-$i.png"; done
curl -fsS -o /dev/null -w 'apple-touch-180 %{http_code}\n' \
  https://boeren.sooth.dev/static/icons/apple-touch-180.png
```

Pass: `start_url/scope/id` all `/`, `display: standalone`, `orientation: portrait`, palette
colours; PNG 192/512 `purpose:any` + separate maskable; apple-touch 180 present; icon
dimensions parsed from the PNG IHDR (192×192, 512×512, 180×180); installing opens the real
app (`start_url: "/"`).

**AC-15 — SW registered, cache exact, update prompt works.** Owner: **5** (3.3),
re-proven **8**.

```
node scripts/verify/sw.mjs $B
# then touch a source, rebuild, reload and assert the prompt
node scripts/verify/sw.mjs $B --expect-update
```

Pass: `caches.keys()` contains exactly one `boerenbridge-*`; its keys equal
`precache.json.files`; after a rebuild + reload the text `Nieuwe versie beschikbaar`
appears; clicking it changes the active cache name and deletes the old one; before/after
names printed.

**AC-16 — install-and-play on a real device.** Owner: **8**.

No command. Artifact: `docs/verify/device-matrix.md` listing exactly what was tested
(Chromium version, mobile emulation at 360×800, whether a physical Android/iOS device was
used) and stating plainly that **iOS Safari was not tested** if it was not. Chromium mobile
emulation must not be described as an iOS test.

**AC-17 — 360 px, no horizontal scroll, targets ≥44×44.** Owner: **4** (3.2), re-checked
**6**.

```
node scripts/verify/measure.mjs $B --widths 360,390,768,1280
```

Pass: for every route × width, `document.documentElement.scrollWidth <= window.innerWidth`;
every `a,button,input,select,textarea,[role=button]` has width ≥44 and height ≥44; nearest
neighbour gap ≥8 px within a container; a printed table.

**AC-18 — steppers, live blind rule, trick counter.** Owner: **4** (3.2).

```
npm test -- --test-name-pattern='stepper|blinde regel|totaal'
node scripts/verify/entry.mjs $B
```

Pass: no `<select>` on Biedingen/Slagen (`assert document.querySelectorAll('select').length
=== 0`); ± steppers increment/decrement with an accessible name; the blind-rule hint appears
as soon as the sum equals cards and submit is blocked with the specific message; the
tricks counter shows `X / N` and blocks until equal.

**AC-19 — undo and correct.** Owner: **4** (3.2), model proof **3** (3.1).

```
npm test -- --test-name-pattern='undo|correct round 3 after 7'
node scripts/verify/entry.mjs $B --case=correct-3-after-7
```

Pass: the model test asserts round 3 correction after 7 completed rounds changes the totals
of all players by the delta of round 3 only and leaves rounds 4–7 untouched; undo removes
the last round and returns to Slagen with the bids preserved. The browser case prints the
before/after totals.

**AC-20 — contrast ≥4.5:1 (3:1 large), 8 player colours.** Owner: **2** (palette/pairs),
proven **4** (3.2), audited **6**.

```
node scripts/verify/contrast.mjs
```

Pass: a printed table of every declared pair (`docs/design/contrast-pairs.json`) with
ratios; all text pairs ≥4.5, large-only ≥3; the eight player colours each ≥4.5 against the
surface and against their own foreground; colours are fixed tokens, not hashed.

**AC-21 — ≤3 motion events, ≤200 ms, reduced-motion off.** Owner: **4** (3.2).

```
node scripts/verify/motion.mjs $B
grep -c '@keyframes' web/src/styles/*.css    # ≤3
```

Pass: exactly the three named events, each `animation-duration`/`transition-duration`
≤200 ms, properties limited to `transform`/`opacity`; with
`Emulation.setEmulatedMedia {features:[{name:'prefers-reduced-motion',value:'reduce'}]}` the
computed duration is `0s` for each.

**AC-22 — keyboard and screen-reader sanity.** Owner: **4** (3.2).

```
node scripts/verify/a11y.mjs $B
```

Pass: exactly one `<h1>` per route; tab order is logical (printed sequence); every focused
control has a visible `:focus-visible` outline (computed width > 0); the scoreboard total
container has `aria-live="polite"` and its text changes after a round; stepper buttons have
accessible names.

**AC-23 — Dutch, informal, consistent vocabulary.** Owner: **4** (3.2), audited **6**.

```
cat web/src/copy.ts
git grep -nE '"[A-Z][a-z]+ [a-z]+ [a-z]+' -- web/src/views   # no bare UI sentences
```

Pass: `copy.ts` is the only place user-visible strings live; it uses `biedingen`, `slagen`,
`blinde regel`, `piramide` consistently and no English UI words.

**AC-24 — publish/fetch round-trip, 400 on malformed.** Owner: **5** (3.4).

```
# a valid snapshot, built from the same types the client emits
node scripts/verify/make-snapshot.mjs > /tmp/game.json
ID=$(curl -fsS -X POST $B/api/games -H 'Content-Type: application/json' -d @/tmp/game.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -fsS $B/api/games/$ID | node -pe 'JSON.parse(require("fs").readFileSync(0)).id'
curl -sS -o /tmp/err.json -w '%{http_code}\n' -X POST $B/api/games \
  -H 'Content-Type: application/json' -d '{"schemaVersion":2,"id":"nope"}'
cat /tmp/err.json
```

Pass: ids match; the snapshots are byte-identical modulo server fields; malformed → `400`
with a Dutch `error`; oversized → `413`; wrong content type → `415`.

**AC-25 — `/s/{id}` renders without JavaScript.** Owner: **5** (3.4), re-proven **8**.

```
curl -fsS $B/s/$ID -o /tmp/share.html
grep -c '<script' /tmp/share.html          # expect 0
grep -o 'Totaal\|<table' /tmp/share.html | head
node scripts/verify/js-off.mjs $B/s/$ID
```

Pass: HTML contains the player names, per-round matrix and totals; zero `<script`; a
`javaScriptEnabled:false` page renders it (screenshot).

**AC-26 — `/healthz` returns 200 with commit + version.** Owner: **5** (3.4), re-proven
**7, 8**.

```
curl -sS -i $B/healthz
git rev-parse HEAD
```

Pass: `200`, `{"status":"ok","commit":"<sha>","version":"2.0.0"}`; on the deployed URL the
`commit` is the merged `main` SHA (stage 7 passes `--build-arg GIT_SHA=$(git rev-parse
HEAD)`).

---

## 7. Out of scope

Carried from §2 of the work order, plus what this re-verification adds.

1. Real-time multi-device play, websockets, "everyone joins on their own phone", presence,
   live cursors. Phase 1 is one phone on the table.
2. Accounts, login, email, push notifications, password reset, user profiles.
3. Any framework, component library, CSS framework runtime, icon package, animation
   library, webfont. No CDN of any kind.
4. DuckDB, Apache Arrow, sql.js, OPFS-SQLite, a sync server, a write queue.
5. Analytics, telemetry, error reporting, A/B tests.
6. i18n framework; Dutch hard-coded in `copy.ts` only.
7. DNS, domain purchase, TLS provisioning, Traefik/router changes.
8. Moving the *running* deployment's process, volume layout, or container name; stage 7
   backs up, wipes the legacy files, and deploys the image — nothing else.
9. Server-side game listing, search, pagination, accounts or access control on `/api/*`.
   Published snapshots are unlisted-by-UUID; that is the whole access model. (If guessing
   UUIDs is a concern, it is a separate ticket — see §8.)
10. Deleting `.hermes/plans/`, `.pi/`, `.grove/`, `PROMPT.md`; rewriting git history;
    force-pushing; touching `main` directly.
11. A native app, PWA push, background sync, periodic background fetch.
12. Charts beyond the ≤40-line inline SVG (if the designer keeps one at all).
13. Importing games from anything except the app's own JSON export. There is no legacy
    importer, no compatibility reader and no conversion path — by decision (§5, AC-12).
14. Reading, repairing or serving the legacy `data/*.sqlite`. It is backed up once and
    deleted; the server never opens it.

---

## 8. Open questions

Each has a recommendation, the cost of being wrong, and whether it blocks 3.1. **None
blocks 3.1.**

**Q1 — Does the committed 0-row legacy DB stay in the repo, or get deleted in 3.4?**
*Recommendation:* **delete `data/db.sqlite*` in 3.4.** A clean slate should not keep a
stale schema in the tree, the host backup is the safety net (§5.2), and keeping it invites
someone to write an importer later. *Cost if wrong:* if anyone ever wanted the old schema
as a reference, it is still in git history (`git show b2b8579:data/db.sqlite` and the later
commits) and in the dated host backup. *Blocks 3.1:* no.

**Q2 — `POST /api/games` create-only or upsert?**
*Recommendation:* upsert by client UUID with `revision` compare; 409 on stale.
*Cost if wrong:* a second publish of the same game from an older device is rejected with a
Dutch sentence instead of overwriting newer data — the safe direction. *Blocks 3.1:* no.

**Q3 — Does the game list need a server source?**
*Recommendation:* no. The list is local IndexedDB only. The server is publish/share.
*Cost if wrong:* installing on a second phone shows an empty list until a share link is
fetched; that is out of scope anyway. *Blocks 3.1:* no.

**Q4 — Lighthouse is not installed; AC-13 needs `npx`.**
*Recommendation:* stage 8 runs `npx --yes lighthouse@12`; if the registry is
unreachable, report AC-13 as not measured and rely on AC-14/15 + `Page.getInstallabilityErrors`.
Do **not** add Lighthouse to `package.json`. *Cost if wrong:* one AC is unproven and the
gate must decide whether that is acceptable. *Blocks 3.1:* no.

**Q5 — No real iOS device.**
*Recommendation:* document the matrix honestly (Chromium + mobile emulation), do not claim
iOS. *Cost if wrong:* an iOS-only bug (IDB eviction, `apple-touch-icon`, standalone status
bar) ships unverified. Mitigation: the design uses only iOS-16-supported primitives and the
spec forbids WebKit-risky APIs (no `navigator.storage.persist` dependency — it is requested
but not required; no OPFS; no `beforeinstallprompt` dependency). *Blocks 3.1:* no.

**Q6 — Blind-rule message wording differs between Go and TS.**
*Recommendation:* parity is on the boolean outcome, not the string; the UI string is
`Biedingen mogen niet samen exact N zijn (blinde regel).` The Go message stays as it is (it
is reachable only from `internal/game`'s own tests after 3.4). *Cost if wrong:* two Dutch
sentences exist in the repo for one rule; no user sees the Go one. *Blocks 3.1:* no.

**Q7 — Who passes `GIT_SHA` to the Docker build?**
*Recommendation:* `ARG GIT_SHA=unknown` in the Dockerfile; stage 7 passes the merged SHA
via the Dokploy build args and proves it in `/healthz`. *Cost if wrong:* `/healthz` says
`unknown` and AC-26 fails at stage 8 — which is the correct outcome for an unproven build.
*Blocks 3.1:* no.

---

## 9. Stage handoff

- **Stage 2 (Design)** must fill `docs/design-v2.md` with the token names this spec already
  uses (`--color-surface-*`, `--player-1..8`, `--space-*`, `--text-*`, `--radius-*`,
  `--motion-*`), the three motion events, the contrast pairs file, and screenshots at 360
  and 1280 for all six screens.
- **Stage 3 (3.1)** stops when: vectors exist, both suites consume them, the model is pure
  and tested, `IndexedDbStore` + `MemoryStore` exist, `npm run build` emits `app.js` +
  `app.css`, `npm test` is green, and the Go suite is green via Docker. It must leave the
  interface note for 3.2/3.3/3.4 in its delivery comment.
- **Stage 4 (3.2)** builds only views/styles/shell on 3.1's interfaces. It must not edit
  `src/rules.ts`, `src/model.ts`, `src/store.ts`, `internal/**`, `web/src/sw.ts`,
  `web/pwa/**`, or the build script's PWA steps.
- **Stage 5 (3.3 then 3.4)** lands two commits. 3.3 owns the PWA surface and the generated
  `internal/assets/static/**`; 3.4 owns the Go rewrite, deletions, Dockerfile and the
  clean-slate store. 3.3 must not delete the old Go templates (3.4 does), must keep
  `web/src/backup.ts` (the user's JSON backup, not a legacy importer), and the precache list
  is explicit so a lingering `offline.js` cannot be precached.
- **Stage 6 (Quality)** verifies §6 by reading and re-running, not by trusting the PR text.
- **Stage 7 (Deploy)** stops the container, copies `/data/db.sqlite*` once to
  `/data/backup-<stamp>/`, lists it and verifies `SHA256SUMS`, **then** deletes the three
  legacy files, deploys only `randomprojects-boerenbridgescorenboord-ddhofw`, and proves an
  empty versioned store (`-dbinfo`, `/healthz`). No migration runs.
- **Stage 8 (Verify)** treats `https://boeren.sooth.dev` as the system under test and says
  plainly what was not tested.

---

## Appendix A — commands used for this re-verification

Run from the repo root on 2026-10-27, branch `soot-33-pwa-v2` (= `main` at `dfc3b28`).

```bash
# structure and sizes
ls templates/*.html | wc -l
wc -l cmd/server/main.go internal/db/db.go internal/game/*.go \
      internal/handlers/handlers.go static/*.js static/manifest.json templates/*.html
git ls-files '*.go' '*.js' '*.html' '*.json' '*.sh' | xargs wc -l | tail -1

# the second app
grep -n 'db.instantiate\|120000\|db.open\|localStorage\|Stap [0-9]' static/offline.js
grep -c 'assert(' static/offline.js
sed -n '240,300p' static/offline.js

# the old service worker
python3 -c "import re;s=open('static/sw.js').read();u=re.findall(r\"'([^']+)'\",re.search(r'const PRECACHE = \[(.*?)\];',s,re.S).group(1));print(len(u));print([x for x in u if x.startswith('http')])"
grep -n 'addAll\|skipWaiting\|wasm\|caches.match' static/sw.js

# manifest and PWA wiring
python3 -c "import json;d=json.load(open('static/manifest.json'));print(d['start_url'],d['icons'])"
grep -rn 'serviceWorker\|apple-touch-icon' templates/

# headers and live behaviour
grep -n 'Cross-Origin' internal/handlers/handlers.go
for p in / /nonexistent /healthz /offline /static/manifest.json /static/sw.js; do
  printf '%-22s ' "$p"; curl -sS -o /tmp/b -w '%{http_code} %{size_download}\n' "https://boeren.sooth.dev$p"
done
cmp <(curl -sS https://boeren.sooth.dev/) <(curl -sS https://boeren.sooth.dev/nonexistent) && echo IDENTICAL
openssl s_client -connect boeren.sooth.dev:443 -servername boeren.sooth.dev </dev/null 2>/dev/null | openssl x509 -noout -issuer -dates

# data — this is the evidence that makes the wipe safe (§2.9, §5), not a migration step
cp data/db.sqlite* /tmp/sqlcopy/
python3 - <<'EOF'
import sqlite3
c=sqlite3.connect('/tmp/sqlcopy/db.sqlite').cursor()
print(c.execute('PRAGMA integrity_check').fetchall())
print({t:c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in ('games','players','round_results')})
print([r[1] for r in c.execute('PRAGMA table_info(games)')])
EOF

# Go baseline (no local toolchain)
docker run --rm -v "$PWD":/src -w /src -e CGO_ENABLED=0 golang:1.23-alpine \
  sh -c 'go build ./... && echo BUILD_OK && go test ./...'
```

## Appendix B — vector inventory (unit 3.1 must produce exactly this coverage)

`testdata/rule-vectors.json`:

- `roundSequence`: `{2,up_down,0}`, `{4,up_down,0}`, `{5,up_down,0}`, `{6,up_down,0}`,
  `{7,up_down,0}`, `{4,up_only,0}`, `{4,up_down,5}`, `{4,up_only,7}` — full expected arrays,
  frozen from `dfc3b28` and hand-checked for the peak (`⌊52/n⌋`), the cap, and the descent.
- `totalRounds`: the six cases from `TestTotalRounds` (25, 19, 13, 13, 9, 7) plus the
  sequence lengths above.
- `cardsForRound`: all 16 cases from `TestCardsForRound`, including out-of-range → 0.
- `calculateScore`: `(0,0)=10`, `(3,3)=19`, `(5,3)=-6`, `(2,4)=-6`, `(1,0)=-3`, `(7,7)=31`,
  `(0,3)=-9`.
- `validateBids`: `([1,2,3],5) valid`, `([1,2,3],6) invalid`, `([2,3,4],5) valid`,
  `([0,0,0],5) valid`.
- `validateTricks`: `([1,2,3],6) valid`, `([1,2,2],6) invalid`.

The file is data only. Neither suite may inline expected values; each must fail when the
file is mutated (AC-6).
