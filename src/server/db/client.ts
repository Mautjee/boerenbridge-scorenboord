import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const dbPath = process.env['DATABASE_URL'] ?? './data/boerenbridge.db'

// Ensure directory exists
const dir = dirname(dbPath)
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true })
}

const sqlite = new Database(dbPath)

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

// Run migrations inline for simplicity
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    dealer_start_index INTEGER NOT NULL DEFAULT 0,
    current_round_index INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id),
    name TEXT NOT NULL,
    turn_order INTEGER NOT NULL,
    color_index INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id),
    round_index INTEGER NOT NULL,
    card_count INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id),
    player_id TEXT NOT NULL REFERENCES players(id),
    bid_amount INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tricks (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id),
    player_id TEXT NOT NULL REFERENCES players(id),
    tricks_won INTEGER NOT NULL,
    score_delta INTEGER NOT NULL,
    cumulative_score INTEGER NOT NULL
  );
`)
