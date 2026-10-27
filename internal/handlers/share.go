package handlers

import (
	"errors"
	"html/template"
	"net/http"
	"time"

	"boerenbridge-scorenboord/internal/db"
)

type shareRound struct {
	Number int
	Cards  int
}

type shareRow struct {
	Name  string
	Cells []int
	Total int
}

type sharePage struct {
	Winner      string
	Tie         bool
	Best        int
	Date        string
	PlayerCount int
	RoundCount  int
	Headers     []shareRound
	Rows        []shareRow
}

var shareTemplate = template.Must(template.New("share").Parse(`<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{{if .Tie}}Gelijkspel{{else}}{{.Winner}} wint{{end}} · Boerenbridge</title>
<style>
:root{--ground:#f2f5ef;--card:#fff;--border:#dce4d7;--ink:#141d16;--soft:#445046;--accent:#0b5f3c;--band:#e6ede1}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.45 ui-rounded,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:56rem;margin:0 auto;padding:24px 16px 48px}
.eyebrow{margin:0;color:var(--accent);font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
h1{margin:4px 0 8px;font-size:clamp(28px,6vw,40px);line-height:1.1}
.meta{margin:0 0 24px;color:var(--soft);font-size:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:20px;margin-bottom:20px}
.best{display:flex;align-items:baseline;gap:8px}
.best strong{font-size:40px;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
caption{text-align:left;color:var(--soft);font-size:13px;padding-bottom:12px}
th,td{padding:10px 8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
thead th{color:var(--soft);font-size:12px;font-weight:600}
thead th span{display:block;font-weight:400}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
tfoot th,tfoot td{font-weight:700;background:var(--band)}
.wrap{overflow-x:auto}
.note{color:var(--soft);font-size:13px;margin:20px 0 0}
</style>
</head>
<body>
<main>
<p class="eyebrow">Boerenbridge</p>
<h1>{{if .Tie}}Gelijkspel{{else}}{{.Winner}} wint{{end}}</h1>
<p class="meta">{{.Date}} · {{.RoundCount}} rondes · {{.PlayerCount}} spelers</p>
<div class="card">
<div class="best"><span>Beste score</span><strong>{{.Best}}</strong></div>
</div>
<div class="card wrap">
<table>
<caption>Score per speler per ronde</caption>
<thead><tr><th>Speler</th>{{range .Headers}}<th>{{.Number}}<span>{{.Cards}} kaarten</span></th>{{end}}<th>Totaal</th></tr></thead>
<tbody>
{{range .Rows}}<tr><th>{{.Name}}</th>{{range .Cells}}<td>{{.}}</td>{{end}}<td>{{.Total}}</td></tr>
{{end}}
</tbody>
</table>
</div>
<p class="note">Deze pagina is alleen-lezen. Open Boerenbridge om verder te spelen.</p>
</main>
</body>
</html>`))

// Share renders a read-only scoreboard without any JavaScript.
func (h *Handler) Share(w http.ResponseWriter, r *http.Request) {
	snapshot, err := h.store.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Niet gevonden</title></head><body><h1>Dit scorebord is niet gevonden</h1><p>De link klopt niet of het spel is niet gepubliceerd.</p></body></html>`))
			return
		}
		http.Error(w, "Het scorebord kon niet worden gelezen.", http.StatusInternalServerError)
		return
	}

	game, err := parseSnapshot(snapshot.Body)
	if err != nil {
		http.Error(w, "Het scorebord kon niet worden gelezen.", http.StatusInternalServerError)
		return
	}

	page := buildSharePage(game)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	if err := shareTemplate.Execute(w, page); err != nil {
		// The response has started; there is nothing better to do than stop.
		return
	}
}

func buildSharePage(game *gameSnapshot) sharePage {
	playerCount := len(game.Setup.Players)
	rows := make([]shareRow, playerCount)
	headers := make([]shareRound, len(game.Rounds))

	for index, round := range game.Rounds {
		headers[index] = shareRound{Number: round.Round, Cards: round.Cards}
	}
	for seat := 0; seat < playerCount; seat++ {
		rows[seat] = shareRow{Name: game.Setup.Players[seat].Name, Cells: make([]int, len(game.Rounds))}
	}
	for index, round := range game.Rounds {
		for seat := 0; seat < playerCount; seat++ {
			rows[seat].Cells[index] = round.Scores[seat]
			rows[seat].Total += round.Scores[seat]
		}
	}

	best := rows[0].Total
	winners := []string{rows[0].Name}
	for _, row := range rows[1:] {
		if row.Total > best {
			best = row.Total
			winners = []string{row.Name}
			continue
		}
		if row.Total == best {
			winners = append(winners, row.Name)
		}
	}

	date := ""
	if parsed, err := time.Parse(time.RFC3339, game.UpdatedAt); err == nil {
		date = parsed.Format("02-01-2006")
	}

	return sharePage{
		Winner:      winners[0],
		Tie:         len(winners) > 1,
		Best:        best,
		Date:        date,
		PlayerCount: playerCount,
		RoundCount:  len(game.Rounds),
		Headers:     headers,
		Rows:        rows,
	}
}
