package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type Game struct {
	ID           int64
	CurrentRound int
	Phase        string // "bidding", "playing", "round_summary", "game_over"
	NumPlayers   int
	CreatedAt    string
}

type Player struct {
	ID       int64
	GameID   int64
	Name     string
	Position int
}

type RoundResult struct {
	RoundNumber int
	PlayerID    int64
	PlayerName  string
	Bid         sql.NullInt64
	TricksWon   sql.NullInt64
	Score       sql.NullInt64
}

func InitDB(dbPath string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode and foreign keys
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	if err := createTables(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return db, nil
}

func createTables(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS games (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		current_round INTEGER NOT NULL DEFAULT 1,
		phase TEXT NOT NULL DEFAULT 'bidding',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS players (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		game_id INTEGER NOT NULL,
		name TEXT NOT NULL,
		position INTEGER NOT NULL,
		FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS round_results (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		game_id INTEGER NOT NULL,
		round_number INTEGER NOT NULL,
		player_id INTEGER NOT NULL,
		bid INTEGER,
		tricks_won INTEGER,
		score INTEGER,
		FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
		FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
		UNIQUE(game_id, round_number, player_id)
	);
	`
	_, err := db.Exec(schema)
	return err
}

func CreateGame(db *sql.DB, playerNames []string) (int64, error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	result, err := tx.Exec("INSERT INTO games (current_round, phase) VALUES (1, 'bidding')")
	if err != nil {
		return 0, err
	}
	gameID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	for i, name := range playerNames {
		_, err := tx.Exec("INSERT INTO players (game_id, name, position) VALUES (?, ?, ?)", gameID, name, i)
		if err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return gameID, nil
}

func GetGame(db *sql.DB, gameID int64) (*Game, error) {
	g := &Game{}
	err := db.QueryRow("SELECT id, current_round, phase, created_at FROM games WHERE id = ?", gameID).
		Scan(&g.ID, &g.CurrentRound, &g.Phase, &g.CreatedAt)
	if err != nil {
		return nil, err
	}

	players, err := GetPlayers(db, gameID)
	if err != nil {
		return nil, err
	}
	g.NumPlayers = len(players)

	return g, nil
}

func GetPlayers(db *sql.DB, gameID int64) ([]Player, error) {
	rows, err := db.Query("SELECT id, game_id, name, position FROM players WHERE game_id = ? ORDER BY position", gameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []Player
	for rows.Next() {
		var p Player
		if err := rows.Scan(&p.ID, &p.GameID, &p.Name, &p.Position); err != nil {
			return nil, err
		}
		players = append(players, p)
	}
	return players, nil
}

func UpdateGamePhase(db *sql.DB, gameID int64, round int, phase string) error {
	_, err := db.Exec("UPDATE games SET current_round = ?, phase = ? WHERE id = ?", round, phase, gameID)
	return err
}

func SaveBids(db *sql.DB, gameID int64, round int, bids map[int64]int) error {
	for playerID, bid := range bids {
		_, err := db.Exec(
			"INSERT INTO round_results (game_id, round_number, player_id, bid) VALUES (?, ?, ?, ?)",
			gameID, round, playerID, bid,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func SaveTricksAndScores(db *sql.DB, gameID int64, round int, tricks map[int64]int) error {
	for playerID, trick := range tricks {
		// Get the bid for this player in this round
		var bid int
		err := db.QueryRow(
			"SELECT bid FROM round_results WHERE game_id = ? AND round_number = ? AND player_id = ?",
			gameID, round, playerID,
		).Scan(&bid)
		if err != nil {
			return err
		}

		// Calculate score
		score := 0
		diff := bid - trick
		if diff < 0 {
			diff = -diff
		}
		if bid == trick {
			score = 10 + 3*bid
		} else {
			score = -3 * diff
		}

		_, err = db.Exec(
			"UPDATE round_results SET tricks_won = ?, score = ? WHERE game_id = ? AND round_number = ? AND player_id = ?",
			trick, score, gameID, round, playerID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func GetBidsForRound(db *sql.DB, gameID int64, round int) (map[int64]int, error) {
	rows, err := db.Query(
		"SELECT player_id, bid FROM round_results WHERE game_id = ? AND round_number = ?",
		gameID, round,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bids := make(map[int64]int)
	for rows.Next() {
		var playerID int64
		var bid int
		if err := rows.Scan(&playerID, &bid); err != nil {
			return nil, err
		}
		bids[playerID] = bid
	}
	return bids, nil
}

func GetRoundResults(db *sql.DB, gameID int64, round int) ([]RoundResult, error) {
	rows, err := db.Query(
		`SELECT rr.round_number, rr.player_id, p.name, rr.bid, rr.tricks_won, rr.score
		 FROM round_results rr
		 JOIN players p ON rr.player_id = p.id
		 WHERE rr.game_id = ? AND rr.round_number = ?
		 ORDER BY p.position`,
		gameID, round,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []RoundResult
	for rows.Next() {
		var r RoundResult
		if err := rows.Scan(&r.RoundNumber, &r.PlayerID, &r.PlayerName, &r.Bid, &r.TricksWon, &r.Score); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

func GetAllResults(db *sql.DB, gameID int64) ([]RoundResult, error) {
	rows, err := db.Query(
		`SELECT rr.round_number, rr.player_id, p.name, rr.bid, rr.tricks_won, rr.score
		 FROM round_results rr
		 JOIN players p ON rr.player_id = p.id
		 WHERE rr.game_id = ?
		 ORDER BY rr.round_number, p.position`,
		gameID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []RoundResult
	for rows.Next() {
		var r RoundResult
		if err := rows.Scan(&r.RoundNumber, &r.PlayerID, &r.PlayerName, &r.Bid, &r.TricksWon, &r.Score); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}