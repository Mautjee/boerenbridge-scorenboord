package game

import "testing"

func TestRoundSequence(t *testing.T) {
	tests := []struct {
		numPlayers int
		maxCards   int
		total      int
		first      int
		peak       int
		last       int
	}{
		{2, 26, 51, 1, 26, 1},
		{4, 13, 25, 1, 13, 1},
		{5, 10, 19, 1, 10, 1},
		{6, 8, 15, 1, 8, 1},
		{7, 7, 13, 1, 7, 1},
	}

	for _, tt := range tests {
		seq := RoundSequence(tt.numPlayers)
		if len(seq) != tt.total {
			t.Errorf("RoundSequence(%d): got length %d, want %d", tt.numPlayers, len(seq), tt.total)
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

func TestTotalRounds(t *testing.T) {
	tests := []struct {
		numPlayers int
		expected   int
	}{
		{4, 25},
		{5, 19},
		{7, 13},
	}

	for _, tt := range tests {
		got := TotalRounds(tt.numPlayers)
		if got != tt.expected {
			t.Errorf("TotalRounds(%d): got %d, want %d", tt.numPlayers, got, tt.expected)
		}
	}
}

func TestCardsForRound(t *testing.T) {
	tests := []struct {
		round      int
		numPlayers int
		expected   int
	}{
		{1, 4, 1},
		{2, 4, 2},
		{13, 4, 13},
		{14, 4, 12},
		{25, 4, 1},
		{1, 5, 1},
		{10, 5, 10},
		{11, 5, 9},
	}

	for _, tt := range tests {
		got := CardsForRound(tt.round, tt.numPlayers)
		if got != tt.expected {
			t.Errorf("CardsForRound(%d, %d): got %d, want %d", tt.round, tt.numPlayers, got, tt.expected)
		}
	}
}

func TestCalculateScore(t *testing.T) {
	tests := []struct {
		bid       int
		tricksWon int
		expected  int
	}{
		{0, 0, 10},   // bid 0, got 0: 10 + 2*0 = 10
		{3, 3, 16},   // bid 3, got 3: 10 + 2*3 = 16
		{5, 3, -4},   // bid 5, got 3: -2 * |5-3| = -4
		{2, 4, -4},   // bid 2, got 4: -2 * |2-4| = -4
		{1, 0, -2},   // bid 1, got 0: -2 * |1-0| = -2
		{7, 7, 24},   // bid 7, got 7: 10 + 2*7 = 24
		{0, 3, -6},   // bid 0, got 3: -2 * |0-3| = -6
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