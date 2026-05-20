package handlers

import (
	"database/sql"
	"fmt"
	"html/template"
	"net/http"
	"sort"
	"strconv"

	"boerenbridge-scorenboord/internal/db"
	"boerenbridge-scorenboord/internal/game"
)

var tmpl *template.Template

func SetTemplates(t *template.Template) {
	tmpl = t
}

func render(w http.ResponseWriter, name string, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	t := tmpl.Lookup(name)
	if t == nil {
		http.Error(w, fmt.Sprintf("template %s not found", name), http.StatusInternalServerError)
		return
	}
	if err := t.Execute(w, data); err != nil {
		fmt.Printf("Error rendering template %s: %v\n", name, err)
	}
}

type Handler struct {
	db *sql.DB
}

func New(database *sql.DB) *Handler {
	return &Handler{db: database}
}

type GamePageData struct {
	GameID        int64
	CurrentRound  int
	TotalRounds   int
	CardsPerRound int
	Phase         string
	Players       []db.Player
	Bids          map[int64]int
	Results       []db.RoundResult
	Scoreboard    ScoreboardData
	Error         string
	IsLastRound   bool
}

type ScoreboardData struct {
	Rounds []ScoreboardRound
	Rows   []ScoreboardRow
}

type ScoreboardRound struct {
	Number       int
	CardsPerPlayer int
}

type ScoreboardRow struct {
	PlayerID    int64
	PlayerName  string
	RoundScores []int // indexed by ScoreboardData.Rounds
	Total       int
}

type FinalResult struct {
	Position   int
	PlayerName string
	TotalScore int
}

func (d *GamePageData) FinalResults() []FinalResult {
	var results []FinalResult
	for _, row := range d.Scoreboard.Rows {
		results = append(results, FinalResult{
			PlayerName: row.PlayerName,
			TotalScore: row.Total,
		})
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].TotalScore > results[j].TotalScore
	})
	for i := range results {
		results[i].Position = i + 1
	}
	return results
}

func (h *Handler) Home(w http.ResponseWriter, r *http.Request) {
	render(w, "index_page", nil)
}

func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Ongeldig formulier", http.StatusBadRequest)
		return
	}

	var playerNames []string
	for i := 0; ; i++ {
		name := r.FormValue(fmt.Sprintf("player_%d", i))
		if name == "" {
			break
		}
		playerNames = append(playerNames, name)
	}

	if len(playerNames) < 2 {
		http.Error(w, "Minimaal 2 spelers vereist", http.StatusBadRequest)
		return
	}

	gameID, err := db.CreateGame(h.db, playerNames)
	if err != nil {
		http.Error(w, "Fout bij aanmaken spel", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, fmt.Sprintf("/game/%d", gameID), http.StatusSeeOther)
}

func (h *Handler) Game(w http.ResponseWriter, r *http.Request) {
	gameID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Ongeldig spel ID", http.StatusBadRequest)
		return
	}

	data, err := h.buildGamePageData(gameID, "")
	if err != nil {
		http.Error(w, "Spel niet gevonden", http.StatusNotFound)
		return
	}

	render(w, "game_page", data)
}

func (h *Handler) SubmitBids(w http.ResponseWriter, r *http.Request) {
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

	if g.Phase != "bidding" {
		http.Error(w, "Ongeldige fase", http.StatusBadRequest)
		return
	}

	players, err := db.GetPlayers(h.db, gameID)
	if err != nil {
		http.Error(w, "Fout bij ophalen spelers", http.StatusInternalServerError)
		return
	}

	bids := make(map[int64]int)
	var bidValues []int
	for _, p := range players {
		bidStr := r.FormValue(fmt.Sprintf("bid_%d", p.ID))
		bid, err := strconv.Atoi(bidStr)
		if err != nil || bid < 0 {
			data, _ := h.buildGamePageData(gameID, "Ongeldig bod ingevoerd")
			render(w, "bids_partial", data)
			return
		}
		bids[p.ID] = bid
		bidValues = append(bidValues, bid)
	}

	cards := game.CardsForRound(g.CurrentRound, g.NumPlayers)
	if err := game.ValidateBids(bidValues, cards); err != nil {
		data, _ := h.buildGamePageData(gameID, err.Error())
		render(w, "bids_partial", data)
		return
	}

	if err := db.SaveBids(h.db, gameID, g.CurrentRound, bids); err != nil {
		http.Error(w, "Fout bij opslaan biedingen", http.StatusInternalServerError)
		return
	}

	if err := db.UpdateGamePhase(h.db, gameID, g.CurrentRound, "playing"); err != nil {
		http.Error(w, "Fout bij bijwerken spel", http.StatusInternalServerError)
		return
	}

	data, err := h.buildGamePageData(gameID, "")
	if err != nil {
		http.Error(w, "Fout bij laden spel", http.StatusInternalServerError)
		return
	}

	render(w, "tricks_partial", data)
}

func (h *Handler) SubmitTricks(w http.ResponseWriter, r *http.Request) {
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

	if g.Phase != "playing" {
		http.Error(w, "Ongeldige fase", http.StatusBadRequest)
		return
	}

	players, err := db.GetPlayers(h.db, gameID)
	if err != nil {
		http.Error(w, "Fout bij ophalen spelers", http.StatusInternalServerError)
		return
	}

	tricks := make(map[int64]int)
	var trickValues []int
	for _, p := range players {
		trickStr := r.FormValue(fmt.Sprintf("tricks_%d", p.ID))
		trick, err := strconv.Atoi(trickStr)
		if err != nil || trick < 0 {
			data, _ := h.buildGamePageData(gameID, "Ongeldig aantal slagen ingevoerd")
			render(w, "tricks_partial", data)
			return
		}
		tricks[p.ID] = trick
		trickValues = append(trickValues, trick)
	}

	cards := game.CardsForRound(g.CurrentRound, g.NumPlayers)
	if err := game.ValidateTricks(trickValues, cards); err != nil {
		data, _ := h.buildGamePageData(gameID, err.Error())
		render(w, "tricks_partial", data)
		return
	}

	if err := db.SaveTricksAndScores(h.db, gameID, g.CurrentRound, tricks); err != nil {
		http.Error(w, "Fout bij opslaan slagen", http.StatusInternalServerError)
		return
	}

	if err := db.UpdateGamePhase(h.db, gameID, g.CurrentRound, "round_summary"); err != nil {
		http.Error(w, "Fout bij bijwerken spel", http.StatusInternalServerError)
		return
	}

	data, err := h.buildGamePageData(gameID, "")
	if err != nil {
		http.Error(w, "Fout bij laden spel", http.StatusInternalServerError)
		return
	}

	render(w, "summary_with_scoreboard", data)
}

func (h *Handler) NextRound(w http.ResponseWriter, r *http.Request) {
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

	if g.Phase != "round_summary" {
		http.Error(w, "Ongeldige fase", http.StatusBadRequest)
		return
	}

	nextRound := g.CurrentRound + 1
	totalRounds := game.TotalRounds(g.NumPlayers)

	var newPhase string
	if nextRound > totalRounds {
		newPhase = "game_over"
	} else {
		newPhase = "bidding"
	}

	// For game_over, keep current_round at last played round
	updateRound := nextRound
	if newPhase == "game_over" {
		updateRound = g.CurrentRound
	}

	if err := db.UpdateGamePhase(h.db, gameID, updateRound, newPhase); err != nil {
		http.Error(w, "Fout bij bijwerken spel", http.StatusInternalServerError)
		return
	}

	data, err := h.buildGamePageData(gameID, "")
	if err != nil {
		http.Error(w, "Fout bij laden spel", http.StatusInternalServerError)
		return
	}

	if data.Phase == "game_over" {
		render(w, "gameover_with_scoreboard", data)
	} else {
		render(w, "bids_partial", data)
	}
}

func (h *Handler) buildGamePageData(gameID int64, errMsg string) (*GamePageData, error) {
	g, err := db.GetGame(h.db, gameID)
	if err != nil {
		return nil, err
	}

	players, err := db.GetPlayers(h.db, gameID)
	if err != nil {
		return nil, err
	}

	totalRounds := game.TotalRounds(g.NumPlayers)
	cardsPerRound := game.CardsForRound(g.CurrentRound, g.NumPlayers)
	isLastRound := g.CurrentRound == totalRounds

	// For game_over, set total rounds and cards info
	if g.Phase == "game_over" {
		isLastRound = true
	}

	data := &GamePageData{
		GameID:        gameID,
		CurrentRound:  g.CurrentRound,
		TotalRounds:   totalRounds,
		CardsPerRound: cardsPerRound,
		Phase:         g.Phase,
		Players:       players,
		Error:         errMsg,
		IsLastRound:   isLastRound,
	}

	// Load bids if in playing or later phase
	if g.Phase == "playing" || g.Phase == "round_summary" || g.Phase == "game_over" {
		bids, err := db.GetBidsForRound(h.db, gameID, g.CurrentRound)
		if err == nil {
			data.Bids = bids
		}
	}

	// Load round results for current round (and game_over needs all results for final display)
	if g.Phase == "round_summary" {
		results, err := db.GetRoundResults(h.db, gameID, g.CurrentRound)
		if err == nil {
			data.Results = results
		}
	}

	// Build scoreboard
	scoreboard, err := h.buildScoreboard(gameID, g, players)
	if err == nil {
		data.Scoreboard = scoreboard
	}

	return data, nil
}

func (h *Handler) buildScoreboard(gameID int64, g *db.Game, players []db.Player) (ScoreboardData, error) {
	allResults, err := db.GetAllResults(h.db, gameID)
	if err != nil {
		return ScoreboardData{}, err
	}

	sd := ScoreboardData{
		Rows: make([]ScoreboardRow, len(players)),
	}

	// Determine completed round numbers (sorted)
	completedRounds := make(map[int]bool)
	for _, r := range allResults {
		if r.Score.Valid {
			completedRounds[r.RoundNumber] = true
		}
	}

	var roundNums []int
	for rn := 1; rn <= g.CurrentRound; rn++ {
		if completedRounds[rn] {
			roundNums = append(roundNums, rn)
		}
	}

	// Build round info
	for _, rn := range roundNums {
		sd.Rounds = append(sd.Rounds, ScoreboardRound{
			Number:        rn,
			CardsPerPlayer: game.CardsForRound(rn, g.NumPlayers),
		})
	}

	// Build rows
	playerMap := make(map[int64]int)
	for i, p := range players {
		sd.Rows[i] = ScoreboardRow{
			PlayerID:    p.ID,
			PlayerName:  p.Name,
			RoundScores: make([]int, len(roundNums)),
		}
		playerMap[p.ID] = i
	}

	for _, r := range allResults {
		if r.Score.Valid {
			if idx, ok := playerMap[r.PlayerID]; ok {
				// Find the column index for this round number
				for colIdx, rn := range roundNums {
					if rn == r.RoundNumber {
						sd.Rows[idx].RoundScores[colIdx] = int(r.Score.Int64)
						sd.Rows[idx].Total += int(r.Score.Int64)
						break
					}
				}
			}
		}
	}

	return sd, nil
}