package handlers

import (
	"net/http"

	"boerenbridge-scorenboord/internal/db"
	"boerenbridge-scorenboord/internal/version"
)

// Health reports the running build and the store schema.
func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"commit":         version.Commit,
		"version":        version.Version,
		"schema_version": db.SchemaVersion,
	})
}
