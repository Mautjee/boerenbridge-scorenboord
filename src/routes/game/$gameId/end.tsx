import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { PlayerAvatar } from '~/components/PlayerAvatar'
import { ConfettiOverlay } from '~/components/ConfettiOverlay'
import { ScoreTable } from '~/components/ScoreTable'
import { getGameState } from '~/server/functions/getGameState'
import { useGameStore } from '~/stores/gameStore'

export const Route = createFileRoute('/game/$gameId/end')({
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: ((params as Record<string, string>)["gameId"] ?? "") } })
    if (!result.success) throw new Error('Game not found')
    return result.data
  },
  component: EndPage,
})

function EndPage() {
  const snapshot = Route.useLoaderData()
  const store = useGameStore()

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [])

  const { players, rounds, history, cumulativeScores } = useGameStore()

  const sorted = [...players].sort(
    (a, b) => (cumulativeScores[b.id] ?? 0) - (cumulativeScores[a.id] ?? 0),
  )
  const winner = sorted[0]

  return (
    <main className="min-h-screen px-4 py-8 relative">
      <ConfettiOverlay />
      <div className="max-w-2xl mx-auto space-y-8 relative z-10">
        {winner && (
          <div className="text-center space-y-4 py-8">
            <div className="flex justify-center">
              <PlayerAvatar name={winner.name} colorIndex={winner.colorIndex} size="lg" />
            </div>
            <div>
              <h1 className="text-2xl font-medium">{winner.name} wint!</h1>
              <p className="text-muted-foreground text-lg font-tabular mt-1">
                {cumulativeScores[winner.id] ?? 0} punten
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Eindstand</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            {sorted.map((player, i) => (
              <div
                key={player.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
              >
                <span className="w-6 text-sm text-muted-foreground font-tabular">{i + 1}</span>
                <PlayerAvatar name={player.name} colorIndex={player.colorIndex} size="sm" />
                <span className="flex-1 text-sm font-medium">{player.name}</span>
                <span className="font-tabular font-medium">
                  {cumulativeScores[player.id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ScoreTable
          players={players}
          completedRounds={history}
          cumulativeScores={cumulativeScores}
          currentRoundIndex={rounds.length}
          totalRounds={rounds.length}
          rounds={rounds}
        />

        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to={'/game/new' as never}>Nieuw spel</Link>
          </Button>
          <Button variant="ghost" asChild size="lg">
            <Link to={'/' as never}>Terug naar begin</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
