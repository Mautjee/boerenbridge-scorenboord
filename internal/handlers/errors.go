package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const notFoundHTML = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Niet gevonden · Boerenbridge</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f5ef;color:#141d16;font:16px/1.45 ui-rounded,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:28rem;padding:2rem;text-align:center}
h1{font-size:1.6rem;margin:0 0 .5rem}
p{margin:0;color:#445046}
a{display:inline-block;margin-top:1.5rem;min-height:44px;padding:.75rem 1.25rem;border-radius:12px;background:#0b5f3c;color:#fff;text-decoration:none;font-weight:600}
</style>
</head>
<body><main><h1>Deze pagina bestaat niet</h1><p>Controleer het adres of ga terug naar het scorebord.</p><a href="/">Naar Boerenbridge</a></main></body>
</html>`

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func jsonError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// NotFound answers a real 404. API callers get JSON; browsers get a small Dutch page.
func (h *Handler) NotFound(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") || strings.Contains(r.Header.Get("Accept"), "application/json") {
		jsonError(w, http.StatusNotFound, "Deze pagina bestaat niet.")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusNotFound)
	_, _ = io.WriteString(w, notFoundHTML)
}
