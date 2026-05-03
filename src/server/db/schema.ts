import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  status: text('status', { enum: ['active', 'finished'] }).notNull().default('active'),
  dealerStartIndex: integer('dealer_start_index').notNull().default(0),
  currentRoundIndex: integer('current_round_index').notNull().default(0),
})

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  name: text('name').notNull(),
  turnOrder: integer('turn_order').notNull(),
  colorIndex: integer('color_index').notNull(),
})

export const rounds = sqliteTable('rounds', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  roundIndex: integer('round_index').notNull(),
  cardCount: integer('card_count').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
})

export const bids = sqliteTable('bids', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull().references(() => rounds.id),
  playerId: text('player_id').notNull().references(() => players.id),
  bidAmount: integer('bid_amount').notNull(),
})

export const tricks = sqliteTable('tricks', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull().references(() => rounds.id),
  playerId: text('player_id').notNull().references(() => players.id),
  tricksWon: integer('tricks_won').notNull(),
  scoreDelta: integer('score_delta').notNull(),
  cumulativeScore: integer('cumulative_score').notNull(),
})

export type Game = typeof games.$inferSelect
export type Player = typeof players.$inferSelect
export type Round = typeof rounds.$inferSelect
export type Bid = typeof bids.$inferSelect
export type Trick = typeof tricks.$inferSelect
