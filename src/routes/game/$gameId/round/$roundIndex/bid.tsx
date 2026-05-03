import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { BidRow } from '~/components/BidRow'
import { RoundProgressBar } from '~/components/RoundProgressBar'
import { getGameState } from '~/server/functions/getGameState'
import { submitBids } from '~/server/functions/submitBids'
import { useGameStore } from '~/stores/gameStore'
import { computeForbiddenBid } from '~/lib/game-logic'
import { z } from 'zod'

const paramsSchema = z.object({ gameId: z.string(), roundIndex: z.string() })

export const Route = createFileRoute('/game/$gameId/round/$roundIndex/bid')({
  params: {
    parse: (params) => paramsSchema.parse(params),
    stringify: (params) => params,
  },
  loader: async ({ params }) => {
    const result = await getGameState({ data: { gameId: ((params as Record<string, string>)["gameId"] ?? "") } })
    if (!result.success) throw new Error('Game not found')
    return result.data
  },
  component: BidPage,
})

function BidPage() {
  const snapshot = Route.useLoaderData()
  const { gameId, roundIndex: roundIndexStr } = Route.useParams()
  const roundIndex = parseInt(roundIndexStr, 10)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const store = useGameStore()

  useEffect(() => {
    store.hydrateFromServer(snapshot)
  }, [])

  const { players, rounds, bidDraft } = useGameStore()

  const dealerIndex = (snapshot.game.dealerStartIndex + roundIndex) % Math.max(players.length, 1)
  const cardCount = rounds[roundIndex] ?? 0

  // Bidding order: start left of dealer
  const orderedPlayers = [...players].sort((a, b) => {
    const aOffset = (a.turnOrder - dealerIndex - 1 + players.length) % players.length
    const bOffset = (b.turnOrder - dealerIndex - 1 + players.length) % players.length
    return aOffset - bOffset
  })

  const lastBidder = orderedPlayers[orderedPlayers.length - 1]
  const otherBids = orderedPlayers.slice(0, -1).map(p => bidDraft[p.id] ?? null)
  const forbiddenBid = lastBidder ? computeForbiddenBid(otherBids, cardCount) : null

  const allBidsValid = orderedPlayers.every(p => {
    const bid = bidDraft[p.id]
    if (bid === null || bid === undefined) return false
    if (bid < 0 || bid > cardCount) return false
    if (p.id === lastBidder?.id && forbiddenBid !== null && bid === forbiddenBid) return false
    return true
  })

  const handleSubmit = async () => {
    if (!allBidsValid) return
    setIsSubmitting(true)
    setError(null)

    const bidsPayload: Record<string, number> = {}
    for (const p of players) {
      const bid = bidDraft[p.id]
      if (bid !== null && bid !== undefined) bidsPayload[p.id] = bid
    }

    try {
      const result = await submitBids({ data: { gameId, roundIndex, bids: bidsPayload } })
      if (result.success) {
        await navigate({
          to: '/game/$gameId/round/$roundIndex/tricks',
          params: { gameId, roundIndex: roundIndexStr },
        } as never)
      } else {
        match(result.error)
          .with({ type: 'BlindRuleViolation' }, (e) =>
            setError(`Bod van ${e.forbiddenBid} is niet toegestaan voor de blinde bieder`))
          .with({ type: 'InvalidBid' }, (e) =>
            setError(`Ongeldig bod — moet tussen 0 en ${e.max} zijn`))
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
          <h1 className="text-xl font-medium">Biedingen — Ronde {roundIndex + 1}</h1>
          <p className="text-sm text-muted-foreground">
            {cardCount} kaarten • Dealer: {players[dealerIndex]?.name}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-2">
            {orderedPlayers.map((player, i) => {
              const isLast = player.id === lastBidder?.id
              return (
                <BidRow
                  key={player.id}
                  player={player}
                  value={bidDraft[player.id] ?? null}
                  cardCount={cardCount}
                  isLastBidder={isLast}
                  forbiddenBid={isLast ? forbiddenBid : null}
                  onChange={(v) => store.setBidDraft(player.id, v)}
                  onEnter={() => {
                    const next = orderedPlayers[i + 1]
                    if (next) {
                      document.querySelector<HTMLInputElement>(
                        `[aria-label="Bod van ${next.name}"]`,
                      )?.focus()
                    }
                  }}
                />
              )
            })}
          </CardContent>
        </Card>

        {error && (
          <div role="alert" aria-live="polite" className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            {error}
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!allBidsValid || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Biedingen opslaan…' : 'Biedingen bevestigen →'}
        </Button>
      </div>
    </main>
  )
}
