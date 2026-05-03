import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Button } from '~/components/ui/button'
import { getAllFinishedGames, getPlayersByGame } from '~/server/queries/games'

const getHistory = createServerFn({ method: 'GET' }).handler(async () => {
  const gamesResult = getAllFinishedGames()
  if (gamesResult.isErr()) return []

  const games = gamesResult.value
  const entries: { gameId: string; createdAt: number; playerNames: string[] }[] = []

  for (const game of games.slice(0, 50)) {
    const playersResult = getPlayersByGame(game.id)
    if (playersResult.isErr()) continue

    const players = playersResult.value
    entries.push({
      gameId: game.id,
      createdAt: game.createdAt,
      playerNames: players.map(p => p.name),
    })
  }

  return entries
})

export const Route = createFileRoute('/history')({
  loader: async () => getHistory(),
  component: HistoryPage,
})

function HistoryPage() {
  const entries = Route.useLoaderData()

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={'/' as never}>← Terug</Link>
          </Button>
          <h1 className="text-xl font-medium">Spelgeschiedenis</h1>
        </div>

        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">
            Nog geen afgeronde spellen
          </p>
        ) : (
          <div className="space-y-2">
            {(entries as { gameId: string; createdAt: number; playerNames: string[] }[]).map((entry) => (
              <Link
                key={entry.gameId}
                to={'/game/$gameId/end' as never}
                params={{ gameId: entry.gameId } as never}
                className="block rounded-xl border border-border bg-card p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {entry.playerNames.join(', ')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
