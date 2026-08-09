package game

import "testing"

func TestRoundSequence(t *testing.T) {
	tests := []struct {
		numPlayers int
		direction  string
		maxCards   int
		total      int
		first      int
		peak       int
		last       int
	}{
		{2, "up_down", 0, 51, 1, 26, 1},
		{4, "up_down", 0, 25, 1, 13, 1},
		{5, "up_down", 0, 19, 1, 10, 1},
		{6, "up_down", 0, 15, 1, 8, 1},
		{7, "up_down", 0, 13, 1, 7, 1},
	}

	for _, tt := range tests {
		seq := RoundSequence(tt.numPlayers, tt.direction, tt.maxCards)
		if len(seq) != tt.total {
			t.Errorf("RoundSequence(%d, %s, %d): got length %d, want %d", tt.numPlayers, tt.direction, tt.maxCards, len(seq), tt.total)
		}
		if seq[0] != tt.first {
			t.Errorf("RoundSequence(%d)[0]: got %d, want %d", tt.numPlayers, seq[0], tt.first)
		}
		if seq[len(seq)/2] != tt.peak {
			t.Errorf("RoundSequence(%d) peak: got %d, want %d", tt.numPlayers, seq[len(seq)/2], tt.peak)
		}
		if seq[len(seq)-1] != tt.last {
			t.Errorf("RoundSequence(%d) last: got %d, want %d", tt.numPlayers, seq[len(seq)-1], tt.last)
		}
		ascending := true
		for i := 1; i < len(seq); i++ {
			if ascending {
				if seq[i] < seq[i-1] {
					ascending = false
				}
			} else {
				if seq[i] > seq[i-1] {
					t.Errorf("RoundSequence(%d): not descending after peak at index %d", tt.numPlayers, i)
				}
			}
		}
	}
}

func TestRoundSequenceUpOnly(t *testing.T) {
	seq := RoundSequence(4, "up_only", 0)
	if len(seq) != 13 {
		t.Errorf("up_only 4p: got length %d, want 13", len(seq))
	}
	if seq[0] != 1 {
		t.Errorf("first: got %d, want 1", seq[0])
	}
	if seq[len(seq)-1] != 13 {
		t.Errorf("last: got %d, want 13", seq[len(seq)-1])
	}
	for i := 1; i < len(seq); i++ {
		if seq[i] != seq[i-1]+1 {
			t.Errorf("up_only: not ascending at index %d: %d -> %d", i, seq[i-1], seq[i])
		}
	}
}

func TestRoundSequenceMaxCardsCap(t *testing.T) {
	// 4 players, up_down, maxCards=5: peak capped at 5
	// Sequence: 1,2,3,4,5,4,3,2,1 = 9 rounds
	seq := RoundSequence(4, "up_down", 5)
	if len(seq) != 9 {
		t.Errorf("maxCards=5 up_down: got length %d, want 9", len(seq))
	}
	if seq[4] != 5 {
		t.Errorf("peak: got %d, want 5", seq[4])
	}
	if seq[0] != 1 {
		t.Errorf("first: got %d, want 1", seq[0])
	}
	if seq[8] != 1 {
		t.Errorf("last: got %d, want 1", seq[8])
	}
}

func TestRoundSequenceMaxCardsUpOnly(t *testing.T) {
	// 4 players, up_only, maxCards=7: peak capped at 7
	// Sequence: 1,2,3,4,5,6,7 = 7 rounds
	seq := RoundSequence(4, "up_only", 7)
	if len(seq) != 7 {
		t.Errorf("maxCards=7 up_only: got length %d, want 7", len(seq))
	}
	if seq[6] != 7 {
		t.Errorf("last: got %d, want 7", seq[6])
	}
}

func TestTotalRounds(t *testing.T) {
	tests := []struct {
		numPlayers int
		direction  string
		maxCards   int
		expected   int
	}{
		{4, "up_down", 0, 25},
		{5, "up_down", 0, 19},
		{7, "up_down", 0, 13},
		{4, "up_only", 0, 13},
		{4, "up_down", 5, 9},
		{4, "up_only", 7, 7},
	}

	for _, tt := range tests {
		got := TotalRounds(tt.numPlayers, tt.direction, tt.maxCards)
		if got != tt.expected {
			t.Errorf("TotalRounds(%d, %s, %d): got %d, want %d", tt.numPlayers, tt.direction, tt.maxCards, got, tt.expected)
		}
	}
}

func TestCardsForRound(t *testing.T) {
	tests := []struct {
		round      int
		numPlayers int
		direction  string
		maxCards   int
		expected   int
	}{
		{1, 4, "up_down", 0, 1},
		{2, 4, "up_down", 0, 2},
		{13, 4, "up_down", 0, 13},
		{14, 4, "up_down", 0, 12},
		{25, 4, "up_down", 0, 1},
		{1, 5, "up_down", 0, 1},
		{10, 5, "up_down", 0, 10},
		{11, 5, "up_down", 0, 9},
		{1, 4, "up_only", 0, 1},
		{13, 4, "up_only", 0, 13},
		{14, 4, "up_only", 0, 0},
		// maxCards=5, up_down
		{1, 4, "up_down", 5, 1},
		{5, 4, "up_down", 5, 5},
		{6, 4, "up_down", 5, 4},
		{9, 4, "up_down", 5, 1},
		{10, 4, "up_down", 5, 0},
	}

	for _, tt := range tests {
		got := CardsForRound(tt.round, tt.numPlayers, tt.direction, tt.maxCards)
		if got != tt.expected {
			t.Errorf("CardsForRound(%d, %d, %s, %d): got %d, want %d", tt.round, tt.numPlayers, tt.direction, tt.maxCards, got, tt.expected)
		}
	}
}

func TestCalculateScore(t *testing.T) {
	tests := []struct {
		bid       int
		tricksWon int
		expected  int
	}{
		{0, 0, 10},
		{3, 3, 19},
		{5, 3, -6},
		{2, 4, -6},
		{1, 0, -3},
		{7, 7, 31},
		{0, 3, -9},
	}

	for _, tt := range tests {
		got := CalculateScore(tt.bid, tt.tricksWon)
		if got != tt.expected {
			t.Errorf("CalculateScore(%d, %d): got %d, want %d", tt.bid, tt.tricksWon, got, tt.expected)
		}
	}
}

func TestValidateBids(t *testing.T) {
	if err := ValidateBids([]int{1, 2, 3}, 5); err != nil {
		t.Errorf("ValidateBids([1,2,3], 5): unexpected error %v", err)
	}
	if err := ValidateBids([]int{1, 2, 3}, 6); err == nil {
		t.Errorf("ValidateBids([1,2,3], 6): expected error, got nil")
	}
	if err := ValidateBids([]int{2, 3, 4}, 5); err != nil {
		t.Errorf("ValidateBids([2,3,4], 5): unexpected error %v", err)
	}
	if err := ValidateBids([]int{0, 0, 0}, 5); err != nil {
		t.Errorf("ValidateBids([0,0,0], 5): unexpected error %v", err)
	}
}

func TestValidateTricks(t *testing.T) {
	if err := ValidateTricks([]int{1, 2, 3}, 6); err != nil {
		t.Errorf("ValidateTricks([1,2,3], 6): unexpected error %v", err)
	}
	if err := ValidateTricks([]int{1, 2, 2}, 6); err == nil {
		t.Errorf("ValidateTricks([1,2,2], 6): expected error, got nil")
	}
}