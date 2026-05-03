import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useRouter, useParams } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BidRow } from '@/components/BidRow'
import { RoundProgressBar } from '@/components/RoundProgressBar'
import { getGameState } from '@/server/functions/getGameState'
import { submitBids } from '@/server/functions/submitBids'
import { useGameStore } from '@/stores/gameStore'
import { match } from 'ts-pattern'
import type { AppError } from '@/lib/errors'

export const Route = createFileRoute('/game/$gameId/round/$roundIndex/bid')({
  component: BidComponent,
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: params.gameId } })
    if (result.success && result.data) {
      return { snapshot: result.data }
    }
    throw new Error('Game not found')
  },
})

function BidComponent() {
  const router = useRouter()
  const { snapshot } = Route.useLoaderData()
  const params = useParams({ from: '/game/$gameId/round/$roundIndex/bid' })
  const roundIndex = parseInt(params.roundIndex, 10)

  const store = useGameStore()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [snapshot])

  const players = store.players
  const rounds = store.rounds
  const cardCount = rounds[roundIndex] ?? 0
  const dealerIndex = snapshot.game.dealerStartIndex
  const lastBidderId = players[(roundIndex + dealerIndex) % players.length]?.id

  const bids = store.bidDraft
  const bidValues = Object.values(bids).filter((b) => b !== null) as number[]
  const allBidsPresent = players.length > 0 && bidValues.length === players.length

  const otherBidsSum = players
    .filter((p) => p.id !== lastBidderId)
    .reduce((sum, p) => sum + (bids[p.id] ?? 0), 0)
  const forbiddenBid = cardCount - otherBidsSum
  const hasForbiddenBid = forbiddenBid >= 0 && forbiddenBid <= cardCount

  const isLastBidderForbidden = lastBidderId ? bids[lastBidderId] === forbiddenBid : false
  const canSubmit = allBidsPresent && !isLastBidderForbidden

  const handleSubmit = async () => {
    if (!canSubmit) return
    setError(null)
    setIsSubmitting(true)

    const bidMap: Record<string, number> = {}
    for (const p of players) {
      const val = bids[p.id]
      if (val !== null && val !== undefined) {
        bidMap[p.id] = val
      }
    }

    const result = await submitBids({ data: { gameId: params.gameId, roundIndex, bids: bidMap } })

    if (!result.success) {
      const msg = match(result.error as AppError)
        .with({ type: 'BlindRuleViolation' }, (e) => `Bod van ${e.forbiddenBid} is niet toegestaan`)
        .with({ type: 'InvalidBid' }, (e) => `Bod moet tussen 0 en ${e.max} liggen`)
        .with({ type: 'DatabaseError' }, () => 'Er is een databasefout opgetreden')
        .with({ type: 'GameNotFound' }, () => 'Spel niet gevonden')
        .otherwise(() => 'Er is iets misgegaan')
      setError(msg)
      setIsSubmitting(false)
      return
    }

    router.navigate({
      to: '/game/$gameId/round/$roundIndex/tricks',
      params: { gameId: params.gameId, roundIndex: String(roundIndex) },
    })
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
        <p className="text-zinc-500">{cardCount} kaarten — Bied je slagen</p>
      </div>

      <RoundProgressBar rounds={rounds} currentRoundIndex={roundIndex} />

      <Card>
        <CardHeader>
          <CardTitle>Bieden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {players.map((p, idx) => (
            <BidRow
              key={p.id}
              player={p}
              value={bids[p.id] ?? null}
              onChange={(val) => store.setBidDraft(p.id, val)}
              isLastBidder={p.id === lastBidderId}
              forbiddenBid={p.id === lastBidderId && hasForbiddenBid ? forbiddenBid : null}
              inputRef={(el) => { inputRefs.current[idx] = el }}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              disabled={isSubmitting}
            />
          ))}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Bezig...' : 'Biedingen bevestigen'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
