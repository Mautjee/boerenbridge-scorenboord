# boerenbridge-scorenboord

## Project Overview
Een Boerenbridge scorebord-app gebouwd met Go, HTMX, Tailwind CSS, SQLite, en Docker.

## Stack
- Backend: Go (serves HTML via html/template)
- Frontend: HTMX + Tailwind CSS (no JS framework)
- Database: SQLite via mattn/go-sqlite3
- Container: Docker (single container, self-hosted)
- Language: Nederlands (alle UI teksten in het Nederlands)

## Dev Setup
```bash
go mod tidy
go run ./cmd/server
```

## Build & Run Docker
```bash
docker build -t boerenbridge .
docker run -p 8080:8080 -v boerenbridge_data:/data boerenbridge
```

## Project Structure
```
cmd/server/main.go       # entrypoint
internal/db/             # sqlite setup & queries
internal/game/           # game logic (rounds, scoring, blind rule)
internal/handlers/       # http handlers
templates/               # Go html templates
static/                  # css, assets
Dockerfile
go.mod
```

## Spelregels (belangrijk voor implementatie)
- Ronde 1: iedereen krijgt 1 kaart, ronde 2: 2 kaarten, ... tot max (floor(52 / aantal spelers)), dan weer terug omlaag (piramide)
- Blinde regel: de biedingen mogen NIET optellen tot exact het totaal aantal slagen (laatste bieder mag dat bod niet doen)
- Punten als je bod haalt: 10 + 2 per gewonnen slag
- Punten als je bod NIET haalt: -2 per slag verschil (absoluut verschil)

## Conventions
- Alle UI teksten in het Nederlands
- Use Go html/template for server-side rendering
- HTMX for dynamic updates (no full page reloads where possible)
- Tailwind via CDN or built CSS -- keep it simple
- SQLite file at /data/db.sqlite inside container
- The app must work fully in a single Docker container on port 8080
