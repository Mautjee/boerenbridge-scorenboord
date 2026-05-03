import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { match } from 'ts-pattern'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { TrickRow } from '~/components/TrickRow'
import { RoundProgressBar } from '~/components/RoundProgressBar'
import { getGameState } from '~/server/functions/getGameState'
import { submitTricks } from '~/server/functions/submitTricks'
import { useGameStore } from '~/stores/gameStore'
import { z } from 'zod'

const paramsSchema = z.object({ gameId: z.string(), roundIndex: z.string() })

export const Route = createFileRoute('/game/$gameId/round/$roundIndex/tricks')({
  params: {
    parse: (params) => paramsSchema.parse(params),
    stringify: (params) => params,
  },
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: ((params as Record<string, string>)["gameId"] ?? "") } })
    if (!result.success) throw new Error('Game not found')
    return result.data
  },
  component: TricksPage,
})

function TricksPage() {
  const snapshot = Route.useLoaderData()
  const { gameId, roundIndex: roundIndexStr } = Route.useParams()
  const roundIndex = parseInt(roundIndexStr, 10)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [flashResults, setFlashResults] = useState<Record<string, { hit: boolean; delta: number }> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const store = useGameStore()

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [])

  const { players, rounds, tricksDraft } = useGameStore()
  const cardCount = rounds[roundIndex] ?? 0
  const bids = snapshot.currentBids ?? {}

  const tricksSum = Object.values(tricksDraft).reduce<number>((s, t) => s + (t ?? 0), 0)
  const allTricksEntered = players.every(p => tricksDraft[p.id] !== null && tricksDraft[p.id] !== undefined)
  const tricksValid = allTricksEntered && tricksSum === cardCount

  const handleSubmit = async () => {
    if (!tricksValid) return
    setIsSubmitting(true)
    setError(null)

    const tricksPayload: Record<string, number> = {}
    for (const p of players) {
      const t = tricksDraft[p.id]
      if (t !== null && t !== undefined) tricksPayload[p.id] = t
    }

    try {
      const result = await submitTricks({ data: { gameId, roundIndex, tricks: tricksPayload } })
      if (result.success) {
        const flashes: Record<string, { hit: boolean; delta: number }> = {}
        for (const [playerId, data] of Object.entries(result.data.perPlayer)) {
          flashes[playerId] = { hit: data.hit, delta: data.delta }
        }
        setFlashResults(flashes)
        store.applyRoundResult(result.data)

        setTimeout(async () => {
          const isLastRound = roundIndex >= rounds.length - 1
          if (isLastRound) {
            await navigate({ to: '/game/$gameId/end', params: { gameId } } as never)
          } else {
            await navigate({ to: '/game/$gameId/scoreboard', params: { gameId } } as never)
          }
        }, 1800)
      } else {
        match(result.error)
          .with({ type: 'TricksDoNotSum' }, (e) =>
            setError(`Totaal moet ${e.expected} zijn, niet ${e.actual}`))
          .with({ type: 'DatabaseError' }, () =>
            setError('Er is een databasefout opgetreden'))
          .exhaustive()
        setIsSubmitting(false)
      }
    } catch {
      setError('Er is een onverwachte fout opgetreden')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <RoundProgressBar rounds={rounds} currentRoundIndex={roundIndex} />

        <div className="space-y-1">
          <h1 className="text-xl font-medium">Slagen — Ronde {roundIndex + 1}</h1>
          <p className="text-sm text-muted-foreground">{cardCount} kaarten</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-2">
            {players.map((player) => (
              <TrickRow
                key={player.id}
                player={player}
                bid={bids[player.id] ?? 0}
                value={tricksDraft[player.id] ?? null}
                flashResult={flashResults?.[player.id] ?? null}
                onChange={(v) => store.setTricksDraft(player.id, v)}
                onEnter={() => {
                  const idx = players.findIndex(p => p.id === player.id)
                  const next = players[idx + 1]
                  if (next) {
                    document.querySelector<HTMLInputElement>(
                      `[aria-label="Slagen van ${next.name}"]`,
                    )?.focus()
                  } else if (tricksValid) {
                    void handleSubmit()
                  }
                }}
              />
            ))}
          </CardContent>
        </Card>

        {/* Live sum counter */}
        <div className={`text-center text-sm font-tabular font-medium ${
          allTricksEntered
            ? tricksValid
              ? 'text-green-700'
              : 'text-red-700'
            : 'text-muted-foreground'
        }`}>
          {tricksSum} / {cardCount} slagen
        </div>

        {error && (
          <div role="alert" aria-live="polite" className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            {error}
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!tricksValid || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Slagen opslaan…' : 'Ronde afronden →'}
        </Button>
      </div>
    </main>
  )
}
