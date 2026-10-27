package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"regexp"
	"strings"
	"time"

	"boerenbridge-scorenboord/internal/db"
)

const maxSnapshotBytes = 64 << 10

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// Handler serves the snapshot API, share page and health endpoint.
type Handler struct {
	store *db.Store
}

// New builds a handler around the snapshot store.
func New(store *db.Store) *Handler {
	return &Handler{store: store}
}

type playerSnapshot struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Seat int    `json:"seat"`
}

type roundSnapshot struct {
	Round  int   `json:"round"`
	Cards  int   `json:"cards"`
	Bids   []int `json:"bids"`
	Tricks []int `json:"tricks"`
	Scores []int `json:"scores"`
}

type pendingSnapshot struct {
	Round int   `json:"round"`
	Cards int   `json:"cards"`
	Bids  []int `json:"bids"`
}

type gameSnapshot struct {
	SchemaVersion int    `json:"schemaVersion"`
	ID            string `json:"id"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
	Phase         string `json:"phase"`
	Revision      int    `json:"revision"`
	Setup         struct {
		Players   []playerSnapshot `json:"players"`
		Direction string           `json:"direction"`
		MaxCards  int              `json:"maxCards"`
	} `json:"setup"`
	Rounds  []roundSnapshot  `json:"rounds"`
	Pending *pendingSnapshot `json:"pending"`
}

func parseSnapshot(body []byte) (*gameSnapshot, error) {
	var snapshot gameSnapshot
	if err := json.Unmarshal(body, &snapshot); err != nil {
		return nil, errors.New("Ongeldige JSON.")
	}
	if err := validateSnapshot(&snapshot); err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func validateSnapshot(snapshot *gameSnapshot) error {
	if snapshot.SchemaVersion != db.SchemaVersion {
		return fmt.Errorf("Onbekende opslagversie %d; deze server verwacht versie %d.", snapshot.SchemaVersion, db.SchemaVersion)
	}
	if !uuidPattern.MatchString(snapshot.ID) {
		return errors.New("Ongeldig spel-id.")
	}
	if _, err := time.Parse(time.RFC3339, snapshot.CreatedAt); err != nil {
		return errors.New("Ongeldige aanmaakdatum.")
	}
	if _, err := time.Parse(time.RFC3339, snapshot.UpdatedAt); err != nil {
		return errors.New("Ongeldige wijzigingsdatum.")
	}
	if snapshot.Revision < 1 {
		return errors.New("Ongeldige revisie.")
	}
	if snapshot.Phase != "active" && snapshot.Phase != "finished" {
		return errors.New("Ongeldige speltstatus.")
	}

	playerCount := len(snapshot.Setup.Players)
	if playerCount < 2 || playerCount > 8 {
		return errors.New("Een spel heeft 2 tot 8 spelers nodig.")
	}
	if snapshot.Setup.Direction != "up_down" && snapshot.Setup.Direction != "up_only" {
		return errors.New("Ongeldige speelrichting.")
	}
	if snapshot.Setup.MaxCards < 0 || snapshot.Setup.MaxCards > 52 {
		return errors.New("Ongeldig maximaal aantal kaarten.")
	}
	seats := make(map[int]bool, playerCount)
	for index, player := range snapshot.Setup.Players {
		name := strings.TrimSpace(player.Name)
		if len(name) < 1 || len(name) > 40 {
			return fmt.Errorf("Speler %d heeft een ongeldige naam.", index+1)
		}
		if player.Seat < 0 || player.Seat >= playerCount || seats[player.Seat] {
			return fmt.Errorf("Speler %d heeft een ongeldige plek.", index+1)
		}
		seats[player.Seat] = true
	}

	for index, round := range snapshot.Rounds {
		expected := index + 1
		if round.Round != expected {
			return fmt.Errorf("Ronde %d is niet aaneengesloten.", expected)
		}
		if round.Cards < 1 || round.Cards > 52 {
			return fmt.Errorf("Ronde %d heeft een ongeldig aantal kaarten.", expected)
		}
		if len(round.Bids) != playerCount || len(round.Tricks) != playerCount || len(round.Scores) != playerCount {
			return fmt.Errorf("Ronde %d heeft niet voor elke speler een waarde.", expected)
		}
		bidTotal := 0
		trickTotal := 0
		for seat := 0; seat < playerCount; seat++ {
			bid := round.Bids[seat]
			trick := round.Tricks[seat]
			if bid < 0 || bid > round.Cards {
				return fmt.Errorf("Ronde %d heeft een ongeldige bieding.", expected)
			}
			if trick < 0 || trick > round.Cards {
				return fmt.Errorf("Ronde %d heeft een ongeldig aantal slagen.", expected)
			}
			bidTotal += bid
			trickTotal += trick
		}
		if bidTotal == round.Cards {
			return fmt.Errorf("De biedingen van ronde %d tellen op tot het aantal kaarten (blinde regel).", expected)
		}
		if trickTotal != round.Cards {
			return fmt.Errorf("De slagen van ronde %d tellen niet op tot het aantal kaarten.", expected)
		}
	}

	if snapshot.Phase == "finished" {
		if snapshot.Pending != nil {
			return errors.New("Een afgelopen spel heeft geen open ronde.")
		}
		return nil
	}

	pending := snapshot.Pending
	if pending == nil {
		return errors.New("Een actief spel heeft een open ronde nodig.")
	}
	if pending.Round != len(snapshot.Rounds)+1 {
		return errors.New("De open ronde sluit niet aan op de gespeelde rondes.")
	}
	if pending.Cards < 1 || pending.Cards > 52 {
		return errors.New("De open ronde heeft een ongeldig aantal kaarten.")
	}
	if pending.Bids != nil {
		if len(pending.Bids) != playerCount {
			return errors.New("De open ronde heeft niet voor elke speler een bieding.")
		}
		for _, bid := range pending.Bids {
			if bid < 0 || bid > pending.Cards {
				return errors.New("De open ronde heeft een ongeldige bieding.")
			}
		}
	}
	return nil
}

// Publish creates or replaces one snapshot.
func (h *Handler) Publish(w http.ResponseWriter, r *http.Request) {
	contentType := r.Header.Get("Content-Type")
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil || mediaType != "application/json" {
		jsonError(w, http.StatusUnsupportedMediaType, "Alleen application/json wordt geaccepteerd.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxSnapshotBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			jsonError(w, http.StatusRequestEntityTooLarge, "De aanvraag is groter dan 64 KiB.")
			return
		}
		jsonError(w, http.StatusBadRequest, "De aanvraag kon niet worden gelezen.")
		return
	}

	snapshot, err := parseSnapshot(body)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	outcome, err := h.store.Publish(r.Context(), snapshot.ID, snapshot.Revision, body)
	if err != nil {
		if errors.Is(err, db.ErrConflict) {
			jsonError(w, http.StatusConflict, "Dit spel is al gepubliceerd met een nieuwere versie.")
			return
		}
		jsonError(w, http.StatusInternalServerError, "Het spel kon niet worden opgeslagen.")
		return
	}

	status := http.StatusOK
	if outcome == db.Created {
		status = http.StatusCreated
	}
	writeJSON(w, status, map[string]any{
		"id":             snapshot.ID,
		"revision":       snapshot.Revision,
		"schema_version": db.SchemaVersion,
	})
}

// GetSnapshot returns a stored snapshot verbatim.
func (h *Handler) GetSnapshot(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	snapshot, err := h.store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			jsonError(w, http.StatusNotFound, "Dit spel is niet gevonden.")
			return
		}
		jsonError(w, http.StatusInternalServerError, "Het spel kon niet worden gelezen.")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(snapshot.Body)
}
