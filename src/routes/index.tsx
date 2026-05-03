import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { Button } from '~/components/ui/button'

const getActiveGame = createServerFn({ method: 'GET' }).handler(async () => {
  const gameId = getCookie('bb_session_game_id')
  return { gameId: gameId ?? null }
})

export const Route = createFileRoute('/')({
  loader: async () => {
    return await getActiveGame()
  },
  component: LandingPage,
})

function LandingPage() {
  const { gameId } = Route.useLoaderData()

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-medium tracking-tight">Boerenbridge</h1>
          <p className="text-muted-foreground">Scorebord voor jouw spelletje</p>
        </div>

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Button asChild size="lg">
            <Link to={'/game/new' as never}>Nieuw spel</Link>
          </Button>

          {gameId && (
            <Button variant="outline" asChild size="lg">
              <Link to={'/game/$gameId/scoreboard' as never} params={{ gameId } as never}>
                Doorgaan
              </Link>
            </Button>
          )}
        </div>

        <div className="text-center">
          <Link
            to={'/history' as never}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Spelgeschiedenis →
          </Link>
        </div>
      </div>
    </main>
  )
}
