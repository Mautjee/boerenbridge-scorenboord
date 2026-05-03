import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getHistory } from '@/server/functions/getGameState'

export const Route = createFileRoute('/history')({
  component: HistoryComponent,
  loader: async () => {
    const result = await getHistory()
    if (result.success && result.data) {
      return { games: result.data }
    }
    return { games: [] }
  },
})

function HistoryComponent() {
  const { games } = Route.useLoaderData()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-medium">Spelgeschiedenis</h1>

      {games.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-zinc-500">
            Nog geen voltooide spellen.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {games.map((g: { gameId: string; date: string; playerNames: string[]; winnerName: string; winnerScore: number }) => (
            <Card key={g.gameId}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {new Date(g.date).toLocaleDateString('nl-NL')} — {g.playerNames.join(', ')}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Winnaar: <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.winnerName}</span> ({g.winnerScore} punten)
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/game/$gameId/end" params={{ gameId: g.gameId }}>
                      Bekijk
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button asChild variant="outline" className="w-full">
        <Link to="/">Terug naar begin</Link>
      </Button>
    </div>
  )
}
