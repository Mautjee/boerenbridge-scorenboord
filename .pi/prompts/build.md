---
description: Build the full boerenbridge app end-to-end and verify it works
---
Build the complete boerenbridge scorebord app as described in AGENTS.md and PROMPT.md.

Stack: Go + HTMX + Tailwind CSS (CDN) + SQLite (mattn/go-sqlite3) + Docker

Deliverables:
1. Full Go project following the structure in AGENTS.md
2. All game logic: pyramide rondes, blinde regel validatie, puntberekening
3. Dockerfile that builds and runs the app on port 8080
4. go.mod with all dependencies

After building, run: docker build -t boerenbridge .
Fix any build errors before reporting done.
