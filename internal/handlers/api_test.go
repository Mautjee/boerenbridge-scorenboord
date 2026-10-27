package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"boerenbridge-scorenboord/internal/db"
)

const testID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff"

func testMux(t *testing.T) (*http.ServeMux, *db.Store) {
	t.Helper()
	store, err := db.Open(filepath.Join(t.TempDir(), "snapshots.sqlite"))
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	t.Cleanup(func() { store.Close() })

	handler := New(store)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/games", handler.Publish)
	mux.HandleFunc("GET /api/games/{id}", handler.GetSnapshot)
	mux.HandleFunc("GET /s/{id}", handler.Share)
	mux.HandleFunc("GET /healthz", handler.Health)
	mux.HandleFunc("/", handler.NotFound)
	return mux, store
}

func validSnapshot(t *testing.T) []byte {
	t.Helper()
	payload := map[string]any{
		"schemaVersion": 2,
		"id":            testID,
		"createdAt":     "2026-10-27T12:00:00Z",
		"updatedAt":     "2026-10-27T12:10:00Z",
		"phase":         "finished",
		"revision":      3,
		"setup": map[string]any{
			"players": []map[string]any{
				{"id": "a", "name": "Sanne", "seat": 0},
				{"id": "b", "name": "Mauro", "seat": 1},
			},
			"direction": "up_only",
			"maxCards":  2,
		},
		"rounds": []map[string]any{
			{
				"round": 1, "cards": 1,
				"bids": []int{0, 0}, "tricks": []int{1, 0}, "scores": []int{-3, 10},
			},
			{
				"round": 2, "cards": 2,
				"bids": []int{0, 1}, "tricks": []int{1, 1}, "scores": []int{-3, 13},
			},
		},
		"pending": nil,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	return body
}

func do(mux *http.ServeMux, method, target, contentType string, body []byte) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, bytes.NewReader(body))
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)
	return recorder
}

func TestPublishGetAndShareRoundTrip(t *testing.T) {
	mux, _ := testMux(t)
	body := validSnapshot(t)

	published := do(mux, http.MethodPost, "/api/games", "application/json; charset=utf-8", body)
	if published.Code != http.StatusCreated {
		t.Fatalf("POST status = %d, body %s", published.Code, published.Body.String())
	}
	var response map[string]any
	if err := json.Unmarshal(published.Body.Bytes(), &response); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if response["id"] != testID || response["schema_version"] != float64(2) {
		t.Fatalf("POST response = %v", response)
	}

	fetched := do(mux, http.MethodGet, "/api/games/"+testID, "", nil)
	if fetched.Code != http.StatusOK {
		t.Fatalf("GET status = %d", fetched.Code)
	}
	if !bytes.Equal(fetched.Body.Bytes(), body) {
		t.Fatalf("GET body differs from the published body")
	}

	share := do(mux, http.MethodGet, "/s/"+testID, "", nil)
	if share.Code != http.StatusOK {
		t.Fatalf("share status = %d", share.Code)
	}
	html := share.Body.String()
	for _, needle := range []string{"Sanne", "Mauro", "<table", "Totaal", "Mauro wint"} {
		if !strings.Contains(html, needle) {
			t.Errorf("share page missing %q", needle)
		}
	}
	if strings.Contains(html, "<script") {
		t.Error("share page contains a script element")
	}

	health := do(mux, http.MethodGet, "/healthz", "", nil)
	if health.Code != http.StatusOK {
		t.Fatalf("health status = %d", health.Code)
	}
	for _, needle := range []string{`"status":"ok"`, `"version":"2.0.0"`, `"schema_version":2`, `"commit":"dev"`} {
		if !strings.Contains(health.Body.String(), needle) {
			t.Errorf("health missing %s: %s", needle, health.Body.String())
		}
	}
}

func TestPublishRevisionsAndConflicts(t *testing.T) {
	mux, _ := testMux(t)
	body := validSnapshot(t)

	if code := do(mux, http.MethodPost, "/api/games", "application/json", body).Code; code != http.StatusCreated {
		t.Fatalf("first POST = %d", code)
	}
	if code := do(mux, http.MethodPost, "/api/games", "application/json", body).Code; code != http.StatusConflict {
		t.Fatalf("same revision POST = %d, want 409", code)
	}

	var updated map[string]any
	if err := json.Unmarshal(body, &updated); err != nil {
		t.Fatalf("parse snapshot: %v", err)
	}
	updated["revision"] = 4
	next, err := json.Marshal(updated)
	if err != nil {
		t.Fatalf("marshal updated snapshot: %v", err)
	}
	if code := do(mux, http.MethodPost, "/api/games", "application/json", next).Code; code != http.StatusOK {
		t.Fatalf("newer revision POST = %d, want 200", code)
	}
}

func TestPublishRejectsBadInput(t *testing.T) {
	mux, _ := testMux(t)

	if code := do(mux, http.MethodPost, "/api/games", "text/plain", validSnapshot(t)).Code; code != http.StatusUnsupportedMediaType {
		t.Fatalf("wrong content type = %d, want 415", code)
	}

	malformed := do(mux, http.MethodPost, "/api/games", "application/json", []byte(`{"schemaVersion":2,"id":"nope"}`))
	if malformed.Code != http.StatusBadRequest {
		t.Fatalf("malformed = %d, want 400", malformed.Code)
	}
	if !strings.Contains(malformed.Body.String(), `"error"`) || !strings.Contains(malformed.Body.String(), "spel-id") {
		t.Fatalf("malformed body = %s", malformed.Body.String())
	}

	oversized := do(mux, http.MethodPost, "/api/games", "application/json", []byte(strings.Repeat("a", 70<<10)))
	if oversized.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized = %d, want 413", oversized.Code)
	}

	blind := validSnapshot(t)
	var broken map[string]any
	if err := json.Unmarshal(blind, &broken); err != nil {
		t.Fatalf("parse: %v", err)
	}
	rounds := broken["rounds"].([]any)
	rounds[0].(map[string]any)["bids"] = []int{1, 0}
	blind, _ = json.Marshal(broken)
	if code := do(mux, http.MethodPost, "/api/games", "application/json", blind).Code; code != http.StatusBadRequest {
		t.Fatalf("blind rule violation = %d, want 400", code)
	}
}

func TestUnknownPathsAreReal404s(t *testing.T) {
	mux, _ := testMux(t)

	api := do(mux, http.MethodGet, "/api/games/does-not-exist", "", nil)
	if api.Code != http.StatusNotFound || !strings.Contains(api.Body.String(), `"error"`) {
		t.Fatalf("unknown api = %d %s", api.Code, api.Body.String())
	}
	page := do(mux, http.MethodGet, "/geen-pagina", "", nil)
	if page.Code != http.StatusNotFound || !strings.Contains(page.Body.String(), "bestaat niet") {
		t.Fatalf("unknown page = %d %s", page.Code, page.Body.String())
	}
}
