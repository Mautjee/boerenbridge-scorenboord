import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { ScoreTable } from '~/components/ScoreTable'
import { RoundProgressBar } from '~/components/RoundProgressBar'
import { getGameState } from '~/server/functions/getGameState'
import { useGameStore } from '~/stores/gameStore'

export const Route = createFileRoute('/game/$gameId/scoreboard')({
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: ((params as Record<string, string>)["gameId"] ?? "") } })
    if (!result.success) throw new Error('Game not found')
    return result.data
  },
  component: ScoreboardPage,
})

function ScoreboardPage() {
  const snapshot = Route.useLoaderData()
  const { gameId } = Route.useParams()
  const store = useGameStore()

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [])

  const { players, rounds, currentRoundIndex, history, cumulativeScores } = useGameStore()
  const isFinished = snapshot.game.status === 'finished'

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <RoundProgressBar rounds={rounds} currentRoundIndex={currentRoundIndex} />

        <div className="space-y-1">
          <h1 className="text-xl font-medium">Scorebord</h1>
        </div>

        <ScoreTable
          players={players}
          completedRounds={history}
          cumulativeScores={cumulativeScores}
          currentRoundIndex={currentRoundIndex}
          totalRounds={rounds.length}
          rounds={rounds}
        />

        <div className="flex gap-3">
          {isFinished ? (
            <Button asChild className="flex-1" size="lg">
              <Link to={'/game/$gameId/end' as never} params={{ gameId } as never}>
                Eindstand bekijken →
              </Link>
            </Button>
          ) : (
            <Button asChild className="flex-1" size="lg">
              <Link
                to={'/game/$gameId/round/$roundIndex/bid' as never}
                params={{ gameId, roundIndex: String(currentRoundIndex) } as never}
              >
                Volgende bieding →
              </Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
