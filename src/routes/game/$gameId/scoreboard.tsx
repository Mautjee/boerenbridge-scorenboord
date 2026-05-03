import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScoreTable } from '@/components/ScoreTable'
import { RoundProgressBar } from '@/components/RoundProgressBar'
import { getGameState } from '@/server/functions/getGameState'
import { useGameStore } from '@/stores/gameStore'
import { useEffect } from 'react'

export const Route = createFileRoute('/game/$gameId/scoreboard')({
  component: ScoreboardComponent,
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: params.gameId } })
    if (result.success && result.data) {
      return { snapshot: result.data }
    }
    throw new Error('Game not found')
  },
})

function ScoreboardComponent() {
  const { snapshot } = Route.useLoaderData()
  const params = useParams({ from: '/game/$gameId/scoreboard' })
  const store = useGameStore()

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [snapshot])

  const isFinished = snapshot.game.status === 'finished'
  const hasMoreRounds = snapshot.currentRoundIndex < snapshot.rounds.length - 1

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium">Scorebord</h1>
        <p className="text-zinc-500">
          {isFinished ? 'Spel afgelopen' : `Ronde ${snapshot.currentRoundIndex + 1} van ${snapshot.rounds.length}`}
        </p>
      </div>

      <RoundProgressBar rounds={snapshot.rounds} currentRoundIndex={snapshot.currentRoundIndex} />

      <Card>
        <CardContent className="p-0">
          <ScoreTable
            players={snapshot.players}
            rounds={snapshot.rounds}
            completedRounds={snapshot.completedRounds}
            cumulativeScores={snapshot.cumulativeScores}
            currentRoundIndex={snapshot.currentRoundIndex}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {!isFinished && hasMoreRounds && (
          <Button asChild size="lg" className="w-full">
            <Link
              to="/game/$gameId/round/$roundIndex/bid"
              params={{ gameId: params.gameId, roundIndex: String(snapshot.currentRoundIndex) }}
            >
              Volgende bieding →
            </Link>
          </Button>
        )}
        {isFinished && (
          <Button asChild size="lg" className="w-full">
            <Link to="/game/$gameId/end" params={{ gameId: params.gameId }}>
              Eindstand bekijken →
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link to="/">Terug naar begin</Link>
        </Button>
      </div>
    </div>
  )
}
