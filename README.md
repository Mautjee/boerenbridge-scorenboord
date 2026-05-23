# Boerenbridge Scorebord

Een Boerenbridge scorebord-app gebouwd met Go, HTMX, Tailwind CSS en SQLite.

## Features

- 🃏 Spelersnamen invoeren (2-8 spelers)
- 📊 Biedingen invoeren per ronde (met blinde regel validatie)
- ✅ Slagen invoeren en automatische puntberekening
- 📈 Cumulatief scorebord per ronde
- 🏆 Eindstand en winnaar weergave
- 🔄 Piramide rondes (oplopend en aflopend)
- 💾 SQLite persistentie
- 🐳 Docker deployment

## Spelregels

- Ronde 1: 1 kaart per speler, ronde 2: 2 kaarten, ... tot max (⌊52 / spelers⌋), dan weer omlaag
- **Blinde regel**: biedingen mogen NIET optellen tot exact het aantal slagen
- **Bod gehaald**: 10 + 2 × aantal slagen
- **Bod niet gehaald**: -2 × |bod - slagen|

## Ontwikkeling

```bash
# Vereisten: Go 1.23+
go mod tidy
go run ./cmd/server
```

Open http://localhost:8080

## Testen

```bash
go test ./...
```

## Docker

```bash
docker build -t boerenbridge .
docker run -p 8080:8080 -v boerenbridge_data:/data boerenbridge
```

Open http://localhost:8080