package main

import (
	"context"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"strings"

	"boerenbridge-scorenboord/internal/assets"
	"boerenbridge-scorenboord/internal/db"
	"boerenbridge-scorenboord/internal/handlers"
	"boerenbridge-scorenboord/internal/version"
)

func main() {
	dbInfo := flag.Bool("dbinfo", false, "druk schema_version en het aantal snapshots af en stop")
	flag.Parse()

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/snapshots.sqlite"
	}

	store, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("opslag openen: %v", err)
	}
	defer store.Close()

	if *dbInfo {
		count, err := store.Count(context.Background())
		if err != nil {
			log.Fatalf("opslag lezen: %v", err)
		}
		fmt.Printf("schema_version=%d snapshots=%d\n", db.SchemaVersion, count)
		return
	}

	handler := handlers.New(store)
	mux := http.NewServeMux()

	// The shell is the only page the app router needs. Unknown paths are a real 404.
	mux.HandleFunc("GET /{$}", serveIndex)
	mux.Handle("GET /static/", staticHandler())
	mux.HandleFunc("POST /api/games", handler.Publish)
	mux.HandleFunc("GET /api/games/{id}", handler.GetSnapshot)
	mux.HandleFunc("GET /s/{id}", handler.Share)
	mux.HandleFunc("GET /healthz", handler.Health)
	mux.HandleFunc("/", handler.NotFound)

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	log.Printf("Boerenbridge %s draait op %s", version.Version, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func serveIndex(w http.ResponseWriter, _ *http.Request) {
	body, err := assets.Files.ReadFile("static/index.html")
	if err != nil {
		http.Error(w, "De app kon niet worden geladen.", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func staticHandler() http.Handler {
	sub, err := fs.Sub(assets.Files, "static")
	if err != nil {
		panic(err)
	}
	files := http.StripPrefix("/static/", http.FileServer(http.FS(sub)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/static/")
		if name == "sw.js" {
			// The worker lives under /static/ but must control the whole app.
			w.Header().Set("Service-Worker-Allowed", "/")
		}
		if strings.HasPrefix(name, "icons/") && strings.HasSuffix(name, ".png") {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		files.ServeHTTP(w, r)
	})
}
