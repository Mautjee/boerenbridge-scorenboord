package game

import "fmt"

// RoundSequence returns the number of cards per player for each round
// following the pyramid pattern: 1,2,3,...,max,...,3,2,1
func RoundSequence(numPlayers int) []int {
	maxCards := 52 / numPlayers
	var seq []int
	for i := 1; i <= maxCards; i++ {
		seq = append(seq, i)
	}
	for i := maxCards - 1; i >= 1; i-- {
		seq = append(seq, i)
	}
	return seq
}

// TotalRounds returns the total number of rounds for a game.
func TotalRounds(numPlayers int) int {
	return len(RoundSequence(numPlayers))
}

// CardsForRound returns the number of cards per player for a given round.
// Round numbers are 1-indexed.
func CardsForRound(roundNum, numPlayers int) int {
	seq := RoundSequence(numPlayers)
	if roundNum < 1 || roundNum > len(seq) {
		return 0
	}
	return seq[roundNum-1]
}

// CalculateScore returns the score for a given bid and tricks won.
// If bid equals tricks: 10 + 3 * bid
// If bid doesn't equal tricks: -3 * |bid - tricks|
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
// The total of all bids must NOT equal the cards per player.
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