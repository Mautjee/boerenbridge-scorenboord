import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { match } from 'ts-pattern'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { createGame } from '~/server/functions/createGame'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/game/new')({
  component: NewGamePage,
})

function NewGamePage() {
  const navigate = useNavigate()
  const [names, setNames] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateName = (i: number, value: string) => {
    setNames(prev => prev.map((n, idx) => idx === i ? value : n))
    setError(null)
  }

  const addPlayer = () => {
    if (names.length < 26) setNames(prev => [...prev, ''])
  }

  const removePlayer = (i: number) => {
    if (names.length > 2) setNames(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await createGame({ data: { playerNames: names } })

      if (result.success) {
        await navigate({
          to: '/game/$gameId/round/$roundIndex/bid',
          params: { gameId: result.data.gameId, roundIndex: '0' },
        } as never)
      } else {
        match(result.error)
          .with({ type: 'ValidationError' }, (e) => setError(e.message))
          .with({ type: 'DatabaseError' }, () => setError('Er is een databasefout opgetreden'))
          .exhaustive()
      }
    } catch {
      setError('Er is een onverwachte fout opgetreden')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium">Nieuw spel</h1>
          <p className="text-sm text-muted-foreground">Voer de namen van de spelers in</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3" role="list" aria-label="Spelers">
                {names.map((name, i) => (
                  <div key={i} className="flex gap-2" role="listitem">
                    <input
                      type="text"
                      value={name}
                      placeholder={`Speler ${i + 1}`}
                      aria-label={`Naam speler ${i + 1}`}
                      className={cn(
                        'flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                        'placeholder:text-muted-foreground',
                      )}
                      onChange={(e) => updateName(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (i === names.length - 1) addPlayer()
                        }
                      }}
                      required
                    />
                    {names.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Verwijder speler ${i + 1}`}
                        onClick={() => removePlayer(i)}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {names.length < 26 && (
                <Button type="button" variant="outline" size="sm" onClick={addPlayer}>
                  + Speler toevoegen
                </Button>
              )}

              {error && (
                <div role="alert" aria-live="polite" className="text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Spel aanmaken…' : 'Spel starten'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
