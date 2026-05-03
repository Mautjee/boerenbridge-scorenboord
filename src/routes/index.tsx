import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getActiveGameForSession } from '@/server/functions/getGameState'
import { serializeResult } from '@/lib/serialization'
import { ok } from 'neverthrow'

export const Route = createFileRoute('/')({
  component: HomeComponent,
  loader: async () => {
    const result = await getActiveGameForSession()
    if (result.success && result.data) {
      return { activeGameId: result.data.gameId }
    }
    return { activeGameId: null }
  },
})

function HomeComponent() {
  const { activeGameId } = Route.useLoaderData()

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Boerenbridge</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Het digitale scorebord voor je volgende potje.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuw spel starten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full" size="lg">
            <Link to="/game/new">Nieuw spel</Link>
          </Button>
          {activeGameId && (
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link to="/game/$gameId/scoreboard" params={{ gameId: activeGameId }}>
                Doorgaan
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <Link to="/history" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors">
          Spelgeschiedenis →
        </Link>
      </div>
    </div>
  )
}
