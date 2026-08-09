# Game Features Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add four features to boerenbridge-scorenboord: (1) "alleen omhoog" direction toggle, (2) configurable round count at creation, (3) line graph scoreboard view, (4) mid-game round count adjustment.

**Architecture:** Extend the `games` table with `direction` and `total_rounds` columns. Update game logic to parameterize round sequences. Add a new `/game/{id}/settings` endpoint for mid-game changes. Add a Chart.js-powered line graph as an alternative scoreboard view. All UI in Dutch, HTMX for dynamic updates.

**Tech Stack:** Go (html/template), HTMX 1.9, Tailwind CSS (CDN), Chart.js 4.x (CDN), SQLite (modernc.org/sqlite)

---

### Task 1: DB schema — add direction and total_rounds columns

**Objective:** Extend the games table with direction and configurable round count.

**Files:**
- Modify: `internal/db/db.go:12-18` (Game struct)
- Modify: `internal/db/db.go:62-94` (createTables schema)
- Modify: `internal/db/db.go:96-124` (CreateGame function)

**Step 1: Add fields to Game struct**

```go
type Game struct {
	ID           int64
	CurrentRound int
	Phase        string // "bidding", "playing", "round_summary", "game_over"
	NumPlayers   int
	Direction    string // "up_down" or "up_only"
	TotalRounds  int    // 0 means all rounds (auto-calculate from pyramid)
	CreatedAt    string
}
```

**Step 2: Add columns to createTables schema**

Replace the games CREATE TABLE:

```sql
CREATE TABLE IF NOT EXISTS games (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	current_round INTEGER NOT NULL DEFAULT 1,
	phase TEXT NOT NULL DEFAULT 'bidding',
	direction TEXT NOT NULL DEFAULT 'up_down',
	total_rounds INTEGER NOT NULL DEFAULT 0,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Step 3: Add migration for existing databases**

At the bottom of `InitDB`, after `createTables(db)`, add auto-migration:

```go
// Auto-migrate: add direction and total_rounds columns if missing (v2 schema)
db.Exec("ALTER TABLE games ADD COLUMN direction TEXT NOT NULL DEFAULT 'up_down'")
db.Exec("ALTER TABLE games ADD COLUMN total_rounds INTEGER NOT NULL DEFAULT 0")
```
Ignore errors (column-already-exists is harmless with SQLite).

**Step 4: Update CreateGame to accept direction and totalRounds**

```go
func CreateGame(db *sql.DB, playerNames []string, direction string, totalRounds int) (int64, error) {
	// ...
	result, err := tx.Exec("INSERT INTO games (current_round, phase, direction, total_rounds) VALUES (1, 'bidding', ?, ?)",
		direction, totalRounds)
	// ...
}
```

**Step 5: Update GetGame to scan the new columns**

```go
err := db.QueryRow(
	"SELECT id, current_round, phase, direction, total_rounds, created_at FROM games WHERE id = ?", gameID,
).Scan(&g.ID, &g.CurrentRound, &g.Phase, &g.Direction, &g.TotalRounds, &g.CreatedAt)
```

**Step 6: Add UpdateGameSettings function**

```go
func UpdateGameSettings(db *sql.DB, gameID int64, totalRounds int) error {
	_, err := db.Exec("UPDATE games SET total_rounds = ? WHERE id = ?", totalRounds, gameID)
	return err
}
```

**Step 7: Run tests**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && go test ./internal/db/...
```

Expected: existing tests pass (DB tests may need updating for new CreateGame signature).

---

### Task 2: Game logic — update RoundSequence, TotalRounds, CardsForRound

**Objective:** Parameterize round generation with direction and round cap.

**Files:**
- Modify: `internal/game/game.go` (all functions)
- Modify: `internal/game/game_test.go` (update tests, add new test cases)

**Step 1: Update RoundSequence signature and logic**

```go
// RoundSequence returns the number of cards per player for each round.
// direction: "up_down" (pyramid: 1,2,...,max,...,2,1) or "up_only" (1,2,...,max).
// maxRounds: 0 = all rounds, >0 = cap to that many rounds.
func RoundSequence(numPlayers int, direction string, maxRounds int) []int {
	maxCards := 52 / numPlayers
	var seq []int

	if direction == "up_only" {
		for i := 1; i <= maxCards; i++ {
			seq = append(seq, i)
		}
	} else {
		// up_down (default): pyramid pattern
		for i := 1; i <= maxCards; i++ {
			seq = append(seq, i)
		}
		for i := maxCards - 1; i >= 1; i-- {
			seq = append(seq, i)
		}
	}

	// Cap to maxRounds if set
	if maxRounds > 0 && maxRounds < len(seq) {
		seq = seq[:maxRounds]
	}
	return seq
}
```

**Step 2: Update TotalRounds**

```go
func TotalRounds(numPlayers int, direction string, maxRounds int) int {
	return len(RoundSequence(numPlayers, direction, maxRounds))
}
```

**Step 3: Update CardsForRound**

```go
func CardsForRound(roundNum, numPlayers int, direction string, maxRounds int) int {
	seq := RoundSequence(numPlayers, direction, maxRounds)
	if roundNum < 1 || roundNum > len(seq) {
		return 0
	}
	return seq[roundNum-1]
}
```

**Step 4: Update tests in game_test.go**

Update existing test calls to pass `"up_down", 0` as the new params. Add new test functions:

```go
func TestRoundSequenceUpOnly(t *testing.T) {
	seq := RoundSequence(4, "up_only", 0)
	// 4 players: max 13 cards, up_only = 13 rounds: 1..13
	if len(seq) != 13 {
		t.Errorf("up_only 4p: got length %d, want 13", len(seq))
	}
	if seq[0] != 1 { t.Errorf("first: got %d, want 1", seq[0]) }
	if seq[len(seq)-1] != 13 { t.Errorf("last: got %d, want 13", seq[len(seq)-1]) }
}

func TestRoundSequenceWithCap(t *testing.T) {
	seq := RoundSequence(4, "up_down", 10)
	// 4p up_down full is 25 rounds, capped at 10
	if len(seq) != 10 {
		t.Errorf("capped to 10: got length %d, want 10", len(seq))
	}
	if seq[0] != 1 { t.Errorf("first: got %d, want 1", seq[0]) }
	if seq[9] != 10 { t.Errorf("round 10: got %d, want 10", seq[9]) }
}
```

**Step 5: Run all game tests**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && go test ./internal/game/... -v
```

Expected: all tests pass (updated + new ones).

---

### Task 3: Handlers — update all callers of game logic functions

**Objective:** Update handlers to pass direction/totalRounds through, update CreateGame, NextRound, and buildGamePageData.

**Files:**
- Modify: `internal/handlers/handlers.go`

**Step 1: Update CreateGame handler to parse new form fields**

```go
func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Ongeldig formulier", http.StatusBadRequest)
		return
	}

	// Parse direction: default "up_down", can be "up_only"
	direction := r.FormValue("direction")
	if direction == "" {
		direction = "up_down"
	}
	if direction != "up_down" && direction != "up_only" {
		http.Error(w, "Ongeldige richting", http.StatusBadRequest)
		return
	}

	// Parse total_rounds: default to natural max if not provided or 0
	totalRounds := 0
	if trStr := r.FormValue("total_rounds"); trStr != "" {
		var err error
		totalRounds, err = strconv.Atoi(trStr)
		if err != nil || totalRounds < 0 {
			http.Error(w, "Ongeldig aantal rondes", http.StatusBadRequest)
			return
		}
	}
	// ... parse player names as before ...

	// If totalRounds is 0 (or unset), calculate the natural max for this player count + direction
	if totalRounds == 0 {
		totalRounds = game.TotalRounds(len(playerNames), direction, 0)
	}

	gameID, err := db.CreateGame(h.db, playerNames, direction, totalRounds)
	// ... rest as before ...
}
```

**Step 2: Update buildGamePageData to use game config**

```go
func (h *Handler) buildGamePageData(gameID int64, errMsg string) (*GamePageData, error) {
	// ... get game and players ...

	totalRounds := game.TotalRounds(g.NumPlayers, g.Direction, g.TotalRounds)
	cardsPerRound := game.CardsForRound(g.CurrentRound, g.NumPlayers, g.Direction, g.TotalRounds)
	isLastRound := g.CurrentRound == totalRounds

	// ... rest as before ...
}
```

**Step 3: Update SubmitBids — CardsForRound call**

```go
cards := game.CardsForRound(g.CurrentRound, g.NumPlayers, g.Direction, g.TotalRounds)
```

**Step 4: Update SubmitTricks — CardsForRound call**

```go
cards := game.CardsForRound(g.CurrentRound, g.NumPlayers, g.Direction, g.TotalRounds)
```

**Step 5: Update buildScoreboard — CardsForRound call inside the loop**

```go
for _, rn := range roundNums {
	sd.Rounds = append(sd.Rounds, ScoreboardRound{
		Number:         rn,
		CardsPerPlayer: game.CardsForRound(rn, g.NumPlayers, g.Direction, g.TotalRounds),
	})
}
```

Note: `buildScoreboard` receives `*db.Game` which now has Direction and TotalRounds — no signature change needed.

**Step 6: Add GamePageData fields for the new config**

```go
type GamePageData struct {
	// ... existing fields ...
	Direction   string // "up_down" or "up_only"
	MaxRounds   int    // the configured total_rounds (0 = all)
	// ...
}
```

Set them in `buildGamePageData`:
```go
data := &GamePageData{
	// ...
	Direction: g.Direction,
	MaxRounds: g.TotalRounds,
	// ...
}
```

**Step 7: Add settings handler for mid-game round change**

```go
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	gameID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Ongeldig spel ID", http.StatusBadRequest)
		return
	}

	g, err := db.GetGame(h.db, gameID)
	if err != nil {
		http.Error(w, "Spel niet gevonden", http.StatusNotFound)
		return
	}

	if g.Phase == "game_over" {
		http.Error(w, "Spel is al afgelopen", http.StatusBadRequest)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Ongeldig formulier", http.StatusBadRequest)
		return
	}

	newTotalRounds := 0
	if trStr := r.FormValue("total_rounds"); trStr != "" {
		newTotalRounds, err = strconv.Atoi(trStr)
		if err != nil || newTotalRounds < 0 {
			http.Error(w, "Ongeldig aantal rondes", http.StatusBadRequest)
			return
		}
	}

	// Validate: new total must be >= current round
	fullRounds := game.TotalRounds(g.NumPlayers, g.Direction, 0)
	// 0 means "reset to natural max"
	if newTotalRounds == 0 {
		newTotalRounds = fullRounds
	}
	if newTotalRounds > fullRounds {
		newTotalRounds = fullRounds
	}
	if newTotalRounds < g.CurrentRound {
		http.Error(w, "Aantal rondes kan niet lager zijn dan de huidige ronde", http.StatusBadRequest)
		return
	}

	if err := db.UpdateGameSettings(h.db, gameID, newTotalRounds); err != nil {
		http.Error(w, "Fout bij bijwerken instellingen", http.StatusInternalServerError)
		return
	}

	// Re-render the game page with updated settings
	data, err := h.buildGamePageData(gameID, "")
	if err != nil {
		http.Error(w, "Fout bij laden spel", http.StatusInternalServerError)
		return
	}

	render(w, "game_page", data)
}
```

**Step 8: Run tests**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && go build ./...
```

Expected: clean build, no compile errors.

---

### Task 4: Route — add settings endpoint

**Objective:** Register the new POST /game/{id}/settings route.

**Files:**
- Modify: `cmd/server/main.go:43-48`

**Step 1: Add route**

```go
mux.HandleFunc("POST /game/{id}/settings", h.UpdateSettings)
```

**Step 2: Build**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && go build ./...
```

Expected: clean build.

---

### Task 5: Template — update index.html with direction toggle and rounds input

**Objective:** Add game configuration options to the new game form.

**Files:**
- Modify: `templates/index.html`

**Step 1: Add form fields before the "Start Spel" button**

Add after the `</div>` of `#player-inputs` and before the `</form>`:

```html
<!-- Game Settings -->
<div class="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
    <h3 class="font-semibold text-gray-700">Spelinstellingen</h3>

    <!-- Direction toggle -->
    <div>
        <label class="block text-sm font-medium text-gray-600 mb-2">Richting</label>
        <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="direction" value="up_down" checked class="accent-emerald-600">
                <span class="text-gray-700">↕️ Omhoog en omlaag (piramide)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="direction" value="up_only" class="accent-emerald-600">
                <span class="text-gray-700">⬆️ Alleen omhoog</span>
            </label>
        </div>
    </div>

    <!-- Rounds input -->
    <div>
        <label for="total_rounds" class="block text-sm font-medium text-gray-600 mb-1">Aantal rondes</label>
        <input type="number" id="total_rounds" name="total_rounds" min="1"
            class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
        <p class="text-xs text-gray-400 mt-1">Standaard is het volledige spel. Verlaag om minder rondes te spelen.</p>
    </div>
</div>
```

After the form HTML, add JS to auto-calculate max rounds:

```html
<script>
(function() {
    var directionRadios = document.querySelectorAll('input[name="direction"]');
    var roundsInput = document.getElementById('total_rounds');

    function getPlayerCount() {
        return document.querySelectorAll('#player-inputs input[type="text"]').length;
    }

    function getDirection() {
        var checked = document.querySelector('input[name="direction"]:checked');
        return checked ? checked.value : 'up_down';
    }

    function maxRounds(players, direction) {
        var maxCards = Math.floor(52 / players);
        if (direction === 'up_only') return maxCards;
        return 2 * maxCards - 1; // pyramid
    }

    function updateRoundsDefault() {
        var players = getPlayerCount();
        if (players < 2) return;
        var max = maxRounds(players, getDirection());
        roundsInput.max = max;
        // Only update value if user hasn't manually changed it, or if new max < current value
        if (!roundsInput.dataset.userEdited || parseInt(roundsInput.value) > max) {
            roundsInput.value = max;
            roundsInput.dataset.userEdited = '';
        }
    }

    // Recalculate when direction changes
    directionRadios.forEach(function(radio) {
        radio.addEventListener('change', updateRoundsDefault);
    });

    // Recalculate when players are added/removed
    var observer = new MutationObserver(updateRoundsDefault);
    observer.observe(document.getElementById('player-inputs'), { childList: true, subtree: true });

    // Mark user-edited so we don't overwrite their choice
    roundsInput.addEventListener('input', function() {
        roundsInput.dataset.userEdited = '1';
    });

    // Initial calculation
    updateRoundsDefault();
})();
</script>
```

**Step 2: Build and verify visually**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && go run ./cmd/server
# Visit http://localhost:8080, verify the new form fields appear
```

---

### Task 6: Template — scoreboard line graph toggle

**Objective:** Add a toggle button on the scoreboard to switch between table and cumulative line graph views.

**Files:**
- Modify: `templates/scoreboard.html`
- Modify: `templates/scoreboard_oob.html`
- New data needed: cumulative scores per player per round

**Step 1: Add cumulative score data to ScoreboardRow**

In `internal/handlers/handlers.go`, add `CumulativeScores` to `ScoreboardRow`:

```go
type ScoreboardRow struct {
	PlayerID         int64
	PlayerName       string
	RoundScores      []int // per-round scores
	CumulativeScores []int // cumulative sum per round
	Total            int
}
```

Update `buildScoreboard` to populate it:

```go
// After looping through allResults to compute RoundScores and Total:
for i := range sd.Rows {
	sd.Rows[i].CumulativeScores = make([]int, len(roundNums))
	cum := 0
	for j, s := range sd.Rows[i].RoundScores {
		cum += s
		sd.Rows[i].CumulativeScores[j] = cum
	}
}
```

**Step 2: Add Chart.js CDN to game page header**

In `templates/game.html`, add Chart.js after HTMX:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

**Step 3: Update scoreboard.html with toggle and graph container**

Replace the scoreboard template:

```html
{{define "scoreboard_partial"}}
<div id="scoreboard" class="bg-white rounded-xl shadow-lg p-6">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-emerald-800">Scorebord</h2>
        {{if .Scoreboard.Rounds}}
        <button id="scoreboard-toggle" onclick="toggleScoreboard()"
            class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">
            📊 Grafiek
        </button>
        {{end}}
    </div>

    <!-- Table view -->
    <div id="scoreboard-table">
        {{if .Scoreboard.Rounds}}
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                ...existing table markup...
            </table>
        </div>
        {{else}}
        <p class="text-gray-500 italic">Nog geen rondes gespeeld.</p>
        {{end}}
    </div>

    <!-- Graph view (hidden by default) -->
    <div id="scoreboard-graph" class="hidden">
        <canvas id="scoreChart" height="300"></canvas>
    </div>
</div>

{{if .Scoreboard.Rounds}}
<script>
(function() {
    var showingTable = true;
    var toggleBtn = document.getElementById('scoreboard-toggle');
    var tableEl = document.getElementById('scoreboard-table');
    var graphEl = document.getElementById('scoreboard-graph');
    var chart = null;

    window.toggleScoreboard = function() {
        showingTable = !showingTable;
        if (showingTable) {
            tableEl.classList.remove('hidden');
            graphEl.classList.add('hidden');
            toggleBtn.textContent = '📊 Grafiek';
        } else {
            tableEl.classList.add('hidden');
            graphEl.classList.remove('hidden');
            toggleBtn.textContent = '📋 Tabel';
            drawChart();
        }
    };

    function drawChart() {
        if (chart) { chart.destroy(); }
        var ctx = document.getElementById('scoreChart').getContext('2d');

        var labels = [];
        {{range .Scoreboard.Rounds}}
        labels.push('R{{.Number}}');
        {{end}}

        var colors = ['#047857', '#b91c1c', '#1d4ed8', '#7c3aed', '#b45309', '#0e7490', '#a21caf', '#4d7c0f'];
        var datasets = [];
        {{range $i, $row := .Scoreboard.Rows}}
        datasets.push({
            label: '{{$row.PlayerName}}',
            data: [{{range $row.CumulativeScores}}{{.}},{{end}}],
            borderColor: colors[{{$i}} % colors.length],
            backgroundColor: colors[{{$i}} % colors.length] + '20',
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 4,
            pointHoverRadius: 6,
        });
        {{end}}

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                },
                scales: {
                    y: {
                        title: { display: true, text: 'Cumulatieve punten' },
                    },
                    x: {
                        title: { display: true, text: 'Ronde' },
                    },
                },
            },
        });
    }
})();
</script>
{{end}}
{{end}}
```

**Step 4: Update scoreboard_oob.html identically**

The oob variant needs the same toggle + graph. Copy the same structure but keep the `hx-swap-oob="true"` wrapper and `id="scoreboard"`.

```html
{{define "scoreboard_oob"}}
<div id="scoreboard" hx-swap-oob="true">
    <!-- Same content as scoreboard_partial above, minus the {{define}} wrapper -->
    <div class="bg-white rounded-xl shadow-lg p-6">
        ... (same content as scoreboard_partial body) ...
    </div>
</div>
{{end}}
```

Since the two templates share most code, extract the shared content into a separate template? No — Go templates don't support parameterized includes cleanly. Duplicate the shared logic for now (DRY is less important than working HTMX OOB swaps). The two templates will be almost identical except for the `hx-swap-oob` wrapper.

---

### Task 7: Template — settings UI in game page

**Objective:** Show current game settings during the game and allow changing the round count.

**Files:**
- Modify: `templates/game.html` (add settings section below scoreboard)

**Step 1: Add a collapsible settings section in game.html**

Add between the scoreboard and game-content sections:

```html
<div class="mt-4 bg-white rounded-xl shadow-lg p-4" x-data="{ open: false }">
    <button onclick="this.nextElementSibling.classList.toggle('hidden')"
        class="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium transition">
        <span>⚙️</span> Spelinstellingen
    </button>
    <div class="hidden mt-3 p-3 bg-gray-50 rounded-lg">
        {{if ne .Phase "game_over"}}
        <form hx-post="/game/{{.GameID}}/settings" hx-target="body" hx-swap="outerHTML" class="space-y-3">
            <div>
                <p class="text-sm text-gray-600">
                    <strong>Richting:</strong> {{if eq .Direction "up_only"}}Alleen omhoog{{else}}Omhoog en omlaag (piramide){{end}}
                    <span class="text-gray-400 text-xs ml-2">(vast tijdens spel)</span>
                </p>
            </div>
            <div class="flex items-end gap-3">
                <div>
                    <label for="settings-rounds" class="block text-sm font-medium text-gray-600 mb-1">Aantal rondes</label>
                    <input type="number" id="settings-rounds" name="total_rounds" min="{{.CurrentRound}}" max="{{.TotalRounds}}" value="{{.MaxRounds}}"
                        class="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    <p class="text-xs text-gray-400 mt-1">Min: {{.CurrentRound}}, max: {{.TotalRounds}}</p>
                </div>
                <button type="submit"
                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm transition">
                    Opslaan
                </button>
            </div>
        </form>
        {{else}}
        <p class="text-gray-500 italic">Spel is afgelopen — instellingen kunnen niet meer worden gewijzigd.</p>
        {{end}}
    </div>
</div>
```

Note: `x-data` is an Alpine.js leftover from copy-paste — remove it since we don't use Alpine.js. Use plain JS toggle as shown above.

---

### Task 8: Integration — full build and smoke test

**Objective:** Build, run, and verify all features work together.

**Step 1: Build**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && go build ./...
```

**Step 2: Run tests**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && go test ./... -v
```

**Step 3: Manual smoke test checklist**

- [ ] Create game with "alleen omhoog" direction → verify round sequence only goes up
- [ ] Create game with 5 rounds → verify game ends after round 5
- [ ] Create game with 0 rounds → verify full pyramid plays
- [ ] During game, change round count to lower (but ≥ current round) → verify game ends earlier
- [ ] During game, change round count to higher → verify game continues longer
- [ ] Toggle scoreboard to graph view → verify line chart renders with cumulative scores
- [ ] Play through full game with new settings → verify no errors

**Step 4: Docker build**

```bash
cd /home/mundi/Dev/boerenbridge-scorenboord && docker build -t boerenbridge .
```

Expected: clean Docker build.

---

### Task 9: Deploy

**Objective:** Push to main for Dokploy auto-deploy.

**Step 1: Commit all changes**

```bash
git add -A
git commit -m "feat: direction toggle, configurable rounds, line graph scoreboard, mid-game settings"
```

**Step 2: Push**

```bash
git push origin main
```

**Step 3: Trigger deploy**

```bash
dokploy application deploy --applicationId 8TshIJPFYeE5-F2T4rw33
```

**Step 4: Verify deployment**

Visit https://boeren.sooth.dev, create a test game, verify new features.
