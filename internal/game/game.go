package game

import "fmt"

// RoundSequence returns the number of cards per player for each round.
// direction: "up_down" (pyramid) or "up_only" (ascending only).
// maxCards: 0 = natural max (52/numPlayers), >0 = cap the peak at this many cards.
func RoundSequence(numPlayers int, direction string, maxCards int) []int {
	naturalMax := 52 / numPlayers
	peak := naturalMax
	if maxCards > 0 && maxCards < peak {
		peak = maxCards
	}

	var seq []int
	if direction == "up_only" {
		for i := 1; i <= peak; i++ {
			seq = append(seq, i)
		}
	} else {
		for i := 1; i <= peak; i++ {
			seq = append(seq, i)
		}
		for i := peak - 1; i >= 1; i-- {
			seq = append(seq, i)
		}
	}

	return seq
}

// TotalRounds returns the total number of rounds for a game.
func TotalRounds(numPlayers int, direction string, maxCards int) int {
	return len(RoundSequence(numPlayers, direction, maxCards))
}

// CardsForRound returns the number of cards per player for a given round.
// Round numbers are 1-indexed.
func CardsForRound(roundNum, numPlayers int, direction string, maxCards int) int {
	seq := RoundSequence(numPlayers, direction, maxCards)
	if roundNum < 1 || roundNum > len(seq) {
		return 0
	}
	return seq[roundNum-1]
}

// CalculateScore returns the score for a given bid and tricks won.
func CalculateScore(bid, tricksWon int) int {
	if bid == tricksWon {
		return 10 + 3*bid
	}
	diff := bid - tricksWon
	if diff < 0 {
		diff = -diff
	}
	return -3 * diff
}

// ValidateBids checks if the bids are valid according to the blind rule.
func ValidateBids(bids []int, cardsPerPlayer int) error {
	total := 0
	for _, b := range bids {
		total += b
	}
	if total == cardsPerPlayer {
		return fmt.Errorf("de biedingen mogen samen niet optellen tot %d (blinde regel)", cardsPerPlayer)
	}
	return nil
}

// ValidateTricks checks that the total tricks equals the cards per player.
func ValidateTricks(tricks []int, cardsPerPlayer int) error {
	total := 0
	for _, t := range tricks {
		total += t
	}
	if total != cardsPerPlayer {
		return fmt.Errorf("het totaal aantal gewonnen slagen (%d) moet gelijk zijn aan het aantal kaarten per speler (%d)", total, cardsPerPlayer)
	}
	return nil

}