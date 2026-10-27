package game

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

type ruleVectors struct {
	RoundSequence []struct {
		NumPlayers int    `json:"numPlayers"`
		Direction  string `json:"direction"`
		MaxCards   int    `json:"maxCards"`
		Expected   []int  `json:"expected"`
	} `json:"roundSequence"`
	TotalRounds []struct {
		NumPlayers int    `json:"numPlayers"`
		Direction  string `json:"direction"`
		MaxCards   int    `json:"maxCards"`
		Expected   int    `json:"expected"`
	} `json:"totalRounds"`
	CardsForRound []struct {
		Round      int    `json:"round"`
		NumPlayers int    `json:"numPlayers"`
		Direction  string `json:"direction"`
		MaxCards   int    `json:"maxCards"`
		Expected   int    `json:"expected"`
	} `json:"cardsForRound"`
	CalculateScore []struct {
		Bid       int `json:"bid"`
		TricksWon int `json:"tricksWon"`
		Expected  int `json:"expected"`
	} `json:"calculateScore"`
	ValidateBids []struct {
		Bids           []int `json:"bids"`
		CardsPerPlayer int   `json:"cardsPerPlayer"`
		Valid          bool  `json:"valid"`
	} `json:"validateBids"`
	ValidateTricks []struct {
		Tricks         []int `json:"tricks"`
		CardsPerPlayer int   `json:"cardsPerPlayer"`
		Valid          bool  `json:"valid"`
	} `json:"validateTricks"`
}

func loadVectors(t *testing.T) ruleVectors {
	t.Helper()

	data, err := os.ReadFile("../../testdata/rule-vectors.json")
	if err != nil {
		t.Fatalf("lees testdata/rule-vectors.json: %v", err)
	}

	var vectors ruleVectors
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatalf("parse testdata/rule-vectors.json: %v", err)
	}
	if len(vectors.RoundSequence) == 0 || len(vectors.TotalRounds) == 0 ||
		len(vectors.CardsForRound) == 0 || len(vectors.CalculateScore) == 0 ||
		len(vectors.ValidateBids) == 0 || len(vectors.ValidateTricks) == 0 {
		t.Fatal("testdata/rule-vectors.json mist een van de verplichte vectors")
	}

	return vectors
}

func TestRoundSequence(t *testing.T) {
	for _, tt := range loadVectors(t).RoundSequence {
		got := RoundSequence(tt.NumPlayers, tt.Direction, tt.MaxCards)
		if !slices.Equal(got, tt.Expected) {
			t.Errorf("RoundSequence(%d, %s, %d): got %v, want %v", tt.NumPlayers, tt.Direction, tt.MaxCards, got, tt.Expected)
		}
	}
}

func TestTotalRounds(t *testing.T) {
	for _, tt := range loadVectors(t).TotalRounds {
		got := TotalRounds(tt.NumPlayers, tt.Direction, tt.MaxCards)
		if got != tt.Expected {
			t.Errorf("TotalRounds(%d, %s, %d): got %d, want %d", tt.NumPlayers, tt.Direction, tt.MaxCards, got, tt.Expected)
		}
	}
}

func TestCardsForRound(t *testing.T) {
	for _, tt := range loadVectors(t).CardsForRound {
		got := CardsForRound(tt.Round, tt.NumPlayers, tt.Direction, tt.MaxCards)
		if got != tt.Expected {
			t.Errorf("CardsForRound(%d, %d, %s, %d): got %d, want %d", tt.Round, tt.NumPlayers, tt.Direction, tt.MaxCards, got, tt.Expected)
		}
	}
}

func TestCalculateScore(t *testing.T) {
	for _, tt := range loadVectors(t).CalculateScore {
		got := CalculateScore(tt.Bid, tt.TricksWon)
		if got != tt.Expected {
			t.Errorf("CalculateScore(%d, %d): got %d, want %d", tt.Bid, tt.TricksWon, got, tt.Expected)
		}
	}
}

func TestValidateBids(t *testing.T) {
	for _, tt := range loadVectors(t).ValidateBids {
		err := ValidateBids(tt.Bids, tt.CardsPerPlayer)
		if valid := err == nil; valid != tt.Valid {
			t.Errorf("ValidateBids(%v, %d): valid=%v, want %v (err: %v)", tt.Bids, tt.CardsPerPlayer, valid, tt.Valid, err)
		}
	}
}

func TestValidateTricks(t *testing.T) {
	for _, tt := range loadVectors(t).ValidateTricks {
		err := ValidateTricks(tt.Tricks, tt.CardsPerPlayer)
		if valid := err == nil; valid != tt.Valid {
			t.Errorf("ValidateTricks(%v, %d): valid=%v, want %v (err: %v)", tt.Tricks, tt.CardsPerPlayer, valid, tt.Valid, err)
		}
	}
}
