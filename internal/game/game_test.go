package game

import "testing"

func TestRoundSequence(t *testing.T) {
	tests := []struct {
		numPlayers int
		direction  string
		maxRounds  int
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
		seq := RoundSequence(tt.numPlayers, tt.direction, tt.maxRounds)
		if len(seq) != tt.total {
			t.Errorf("RoundSequence(%d, %s, %d): got length %d, want %d", tt.numPlayers, tt.direction, tt.maxRounds, len(seq), tt.total)
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
		// Verify ascending then descending
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
	// 4 players: max 13 cards, up_only = 13 rounds: 1..13
	if len(seq) != 13 {
		t.Errorf("up_only 4p: got length %d, want 13", len(seq))
	}
	if seq[0] != 1 {
		t.Errorf("first: got %d, want 1", seq[0])
	}
	if seq[len(seq)-1] != 13 {
		t.Errorf("last: got %d, want 13", seq[len(seq)-1])
	}
	// Verify strictly ascending
	for i := 1; i < len(seq); i++ {
		if seq[i] != seq[i-1]+1 {
			t.Errorf("up_only: not ascending at index %d: %d -> %d", i, seq[i-1], seq[i])
		}
	}
}

func TestRoundSequenceWithCap(t *testing.T) {
	seq := RoundSequence(4, "up_down", 10)
	// 4p up_down full is 25 rounds, capped at 10
	if len(seq) != 10 {
		t.Errorf("capped to 10: got length %d, want 10", len(seq))
	}
	if seq[0] != 1 {
		t.Errorf("first: got %d, want 1", seq[0])
	}
	if seq[9] != 10 {
		t.Errorf("round 10: got %d, want 10", seq[9])
	}
}

func TestRoundSequenceUpOnlyWithCap(t *testing.T) {
	seq := RoundSequence(4, "up_only", 7)
	if len(seq) != 7 {
		t.Errorf("up_only capped to 7: got length %d, want 7", len(seq))
	}
	if seq[0] != 1 {
		t.Errorf("first: got %d, want 1", seq[0])
	}
	if seq[6] != 7 {
		t.Errorf("round 7: got %d, want 7", seq[6])
	}
}

func TestTotalRounds(t *testing.T) {
	tests := []struct {
		numPlayers int
		direction  string
		maxRounds  int
		expected   int
	}{
		{4, "up_down", 0, 25},
		{5, "up_down", 0, 19},
		{7, "up_down", 0, 13},
		{4, "up_only", 0, 13},
		{4, "up_down", 10, 10},
	}

	for _, tt := range tests {
		got := TotalRounds(tt.numPlayers, tt.direction, tt.maxRounds)
		if got != tt.expected {
			t.Errorf("TotalRounds(%d, %s, %d): got %d, want %d", tt.numPlayers, tt.direction, tt.maxRounds, got, tt.expected)
		}
	}
}

func TestCardsForRound(t *testing.T) {
	tests := []struct {
		round      int
		numPlayers int
		direction  string
		maxRounds  int
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
		{14, 4, "up_only", 0, 0}, // out of bounds
	}

	for _, tt := range tests {
		got := CardsForRound(tt.round, tt.numPlayers, tt.direction, tt.maxRounds)
		if got != tt.expected {
			t.Errorf("CardsForRound(%d, %d, %s, %d): got %d, want %d", tt.round, tt.numPlayers, tt.direction, tt.maxRounds, got, tt.expected)
		}
	}
}

func TestCalculateScore(t *testing.T) {
	tests := []struct {
		bid       int
		tricksWon int
		expected  int
	}{
		{0, 0, 10}, // bid 0, got 0: 10 + 3*0 = 10
		{3, 3, 19}, // bid 3, got 3: 10 + 3*3 = 19
		{5, 3, -6}, // bid 5, got 3: -3 * |5-3| = -6
		{2, 4, -6}, // bid 2, got 4: -3 * |2-4| = -6
		{1, 0, -3}, // bid 1, got 0: -3 * |1-0| = -3
		{7, 7, 31}, // bid 7, got 7: 10 + 3*7 = 31
		{0, 3, -9}, // bid 0, got 3: -3 * |0-3| = -9
	}

	for _, tt := range tests {
		got := CalculateScore(tt.bid, tt.tricksWon)
		if got != tt.expected {
			t.Errorf("CalculateScore(%d, %d): got %d, want %d", tt.bid, tt.tricksWon, got, tt.expected)
		}
	}
}

func TestValidateBids(t *testing.T) {
	// Valid: total != cards per player
	if err := ValidateBids([]int{1, 2, 3}, 5); err != nil {
		t.Errorf("ValidateBids([1,2,3], 5): unexpected error %v", err)
	}

	// Invalid: total == cards per player (blind rule)
	if err := ValidateBids([]int{1, 2, 3}, 6); err == nil {
		t.Errorf("ValidateBids([1,2,3], 6): expected error, got nil")
	}

	// Valid: total > cards per player
	if err := ValidateBids([]int{2, 3, 4}, 5); err != nil {
		t.Errorf("ValidateBids([2,3,4], 5): unexpected error %v", err)
	}

	// Valid: total < cards per player
	if err := ValidateBids([]int{0, 0, 0}, 5); err != nil {
		t.Errorf("ValidateBids([0,0,0], 5): unexpected error %v", err)
	}
}

func TestValidateTricks(t *testing.T) {
	// Valid: total == cards per player
	if err := ValidateTricks([]int{1, 2, 3}, 6); err != nil {
		t.Errorf("ValidateTricks([1,2,3], 6): unexpected error %v", err)
	}

	// Invalid: total != cards per player
	if err := ValidateTricks([]int{1, 2, 2}, 6); err == nil {
		t.Errorf("ValidateTricks([1,2,2], 6): expected error, got nil")
	}
}