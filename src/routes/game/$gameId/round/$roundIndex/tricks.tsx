import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useRouter, useParams } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrickRow } from '@/components/TrickRow'
import { RoundProgressBar } from '@/components/RoundProgressBar'
import { getGameState } from '@/server/functions/getGameState'
import { submitTricks } from '@/server/functions/submitTricks'
import { useGameStore } from '@/stores/gameStore'
import type { RoundResult } from '@/lib/game-logic'
import { motion } from 'framer-motion'
import { match } from 'ts-pattern'
import type { AppError } from '@/lib/errors'

export const Route = createFileRoute('/game/$gameId/round/$roundIndex/tricks')({
  component: TricksComponent,
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: params.gameId } })
    if (result.success && result.data) {
      return { snapshot: result.data }
    }
    throw new Error('Game not found')
  },
})

function TricksComponent() {
  const router = useRouter()
  const { snapshot } = Route.useLoaderData()
  const params = useParams({ from: '/game/$gameId/round/$roundIndex/tricks' })
  const roundIndex = parseInt(params.roundIndex, 10)

  const store = useGameStore()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [snapshot])

  const players = store.players
  const rounds = store.rounds
  const cardCount = rounds[roundIndex] ?? 0
  const bids = snapshot.currentBids ?? {}
  const tricks = store.tricksDraft

  const trickValues = players.map((p) => tricks[p.id] ?? 0)
  const tricksSum = trickValues.reduce((a, b) => a + b, 0)
  const tricksValid = tricksSum === cardCount
  const allTricksPresent = players.length > 0 && players.every((p) => tricks[p.id] !== null && tricks[p.id] !== undefined)
  const canSubmit = allTricksPresent && tricksValid

  const [resultData, setResultData] = useState<RoundResult | null>(null)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setError(null)
    setIsSubmitting(true)

    const trickMap: Record<string, number> = {}
    for (const p of players) {
      const val = tricks[p.id]
      if (val !== null && val !== undefined) {
        trickMap[p.id] = val
      }
    }

    const result = await submitTricks({ data: { gameId: params.gameId, roundIndex, tricks: trickMap } })

    if (!result.success) {
      const msg = match(result.error as AppError)
        .with({ type: 'TricksDoNotSum' }, (e) => `Totaal moet ${e.expected} zijn, niet ${e.actual}`)
        .with({ type: 'DatabaseError' }, () => 'Er is een databasefout opgetreden')
        .with({ type: 'GameNotFound' }, () => 'Spel niet gevonden')
        .otherwise(() => 'Er is iets misgegaan')
      setError(msg)
      setIsSubmitting(false)
      return
    }

    setResultData(result.data)
    setShowResults(true)

    setTimeout(() => {
      router.navigate({
        to: '/game/$gameId/scoreboard',
        params: { gameId: params.gameId },
      })
    }, 1800)
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === players.length - 1) {
        handleSubmit()
      } else {
        inputRefs.current[idx + 1]?.focus()
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium">Ronde {roundIndex + 1}</h1>
        <p className="text-zinc-500">{cardCount} kaarten — Hoeveel slagen heb je gehaald?</p>
      </div>

      <RoundProgressBar rounds={rounds} currentRoundIndex={roundIndex} />

      <Card>
        <CardHeader>
          <CardTitle>Slagen invoeren</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {players.map((p, idx) => {
            const flash = showResults && resultData
              ? resultData.perPlayer[p.id].hit
                ? 'hit'
                : 'miss'
              : null
            const delta = showResults && resultData ? resultData.perPlayer[p.id].delta : null

            return (
              <motion.div
                key={p.id}
                initial={false}
                animate={flash ? { backgroundColor: flash === 'hit' ? ['#f0fdf4', 'transparent'] : ['#fef2f2', 'transparent'] } : {}}
                transition={{ duration: 0.6 }}
              >
                <TrickRow
                  player={p}
                  bid={bids[p.id] ?? 0}
                  value={tricks[p.id] ?? null}
                  onChange={(val) => store.setTricksDraft(p.id, val)}
                  inputRef={(el) => { inputRefs.current[idx] = el }}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={isSubmitting || showResults}
                  flash={flash}
                  delta={delta}
                />
              </motion.div>
            )
          })}

          <div className="flex items-center justify-between text-sm">
            <span className={tricksValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              Totaal: {tricksSum} / {cardCount}
            </span>
            {!tricksValid && allTricksPresent && (
              <span className="text-xs text-red-500">Som moet exact {cardCount} zijn</span>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!canSubmit || isSubmitting || showResults}>
            {isSubmitting ? 'Bezig...' : 'Resultaten opslaan'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
