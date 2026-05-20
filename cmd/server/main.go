package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"boerenbridge-scorenboord/internal/db"
	"boerenbridge-scorenboord/internal/handlers"

	"html/template"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/db.sqlite"
	}

	database, err := db.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Parse templates
	tmpl, err := template.ParseGlob("templates/*.html")
	if err != nil {
		log.Fatalf("Failed to parse templates: %v", err)
	}
	handlers.SetTemplates(tmpl)

	h := handlers.New(database)

	mux := http.NewServeMux()

	// Serve static files
	fs := http.FileServer(http.Dir("static"))
	mux.Handle("GET /static/", http.StripPrefix("/static", fs))

	// Routes
	mux.HandleFunc("GET /", h.Home)
	mux.HandleFunc("POST /game", h.CreateGame)
	mux.HandleFunc("GET /game/{id}", h.Game)
	mux.HandleFunc("POST /game/{id}/bids", h.SubmitBids)
	mux.HandleFunc("POST /game/{id}/tricks", h.SubmitTricks)
	mux.HandleFunc("POST /game/{id}/next", h.NextRound)

	addr := ":8080"
	fmt.Printf("🃏 Boerenbridge Scorebord draait op http://localhost%s\n", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}