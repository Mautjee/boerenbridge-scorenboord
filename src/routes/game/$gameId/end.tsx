import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ConfettiOverlay } from '@/components/ConfettiOverlay'
import { getGameState } from '@/server/functions/getGameState'
import { useGameStore } from '@/stores/gameStore'
import { useEffect } from 'react'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/game/$gameId/end')({
  component: EndComponent,
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: params.gameId } })
    if (result.success && result.data) {
      if (result.data.game.status !== 'finished') {
        throw new Error('Game not finished')
      }
      return { snapshot: result.data }
    }
    throw new Error('Game not found')
  },
})

function EndComponent() {
  const { snapshot } = Route.useLoaderData()
  const store = useGameStore()

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [snapshot])

  const sortedPlayers = [...snapshot.players].sort((a, b) => {
    const scoreA = snapshot.cumulativeScores[a.id] ?? 0
    const scoreB = snapshot.cumulativeScores[b.id] ?? 0
    return scoreB - scoreA
  })

  const winner = sortedPlayers[0]
  const winnerScore = winner ? snapshot.cumulativeScores[winner.id] ?? 0 : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <ConfettiOverlay />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="text-center space-y-4"
      >
        <div className="inline-flex flex-col items-center gap-3">
          <PlayerAvatar name={winner.name} colorIndex={winner.colorIndex} size="lg" />
          <div>
            <h1 className="text-3xl font-medium">{winner.name}</h1>
            <p className="text-xl text-indigo-600 dark:text-indigo-400 font-medium">{winnerScore} punten</p>
          </div>
        </div>
        <p className="text-zinc-500">Winnaar van dit spel!</p>
      </motion.div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sortedPlayers.map((p, idx) => {
              const score = snapshot.cumulativeScores[p.id] ?? 0
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm text-zinc-400 w-6 tabular-nums">{idx + 1}</span>
                  <PlayerAvatar name={p.name} colorIndex={p.colorIndex} size="sm" />
                  <span className="flex-1 font-medium text-sm">{p.name}</span>
                  <span className="font-medium tabular-nums">{score}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link to="/game/new">Nieuw spel</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/">Terug naar begin</Link>
        </Button>
      </div>
    </div>
  )
}
