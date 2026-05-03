import { useState, useRef } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createGame } from '@/server/functions/createGame'
import { match } from 'ts-pattern'
import type { AppError } from '@/lib/errors'

export const Route = createFileRoute('/game/new')({
  component: NewGameComponent,
})

function NewGameComponent() {
  const router = useRouter()
  const [names, setNames] = useState(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const addPlayer = () => {
    if (names.length < 26) {
      setNames([...names, ''])
      setTimeout(() => {
        inputsRef.current[names.length]?.focus()
      }, 0)
    }
  }

  const removePlayer = (idx: number) => {
    if (names.length > 2) {
      const next = [...names]
      next.splice(idx, 1)
      setNames(next)
    }
  }

  const updateName = (idx: number, value: string) => {
    const next = [...names]
    next[idx] = value
    setNames(next)
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    setIsSubmitting(true)

    const result = await createGame({ data: { playerNames: names } })

    if (!result.success) {
      const msg = match(result.error as AppError)
        .with({ type: 'ValidationError' }, (e) => e.message)
        .with({ type: 'DatabaseError' }, () => 'Er is een databasefout opgetreden')
        .otherwise(() => 'Er is iets misgegaan')
      setError(msg)
      setIsSubmitting(false)
      return
    }

    router.navigate({ to: '/game/$gameId/round/$roundIndex/bid', params: { gameId: result.data.gameId, roundIndex: '0' } })
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === names.length - 1) {
        handleSubmit()
      } else {
        inputsRef.current[idx + 1]?.focus()
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-medium">Spelers toevoegen</h1>

      <Card>
        <CardHeader>
          <CardTitle>Wie doen er mee?</CardTitle>
          <CardDescription>Voer de namen van de spelers in (minimaal 2).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {names.map((name, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                ref={(el) => { inputsRef.current[idx] = el }}
                value={name}
                onChange={(e) => updateName(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                placeholder={`Speler ${idx + 1}`}
                aria-label={`Naam speler ${idx + 1}`}
              />
              {names.length > 2 && (
                <Button variant="ghost" size="sm" onClick={() => removePlayer(idx)} type="button">
                  ✕
                </Button>
              )}
            </div>
          ))}

          {names.length < 26 && (
            <Button variant="outline" className="w-full" onClick={addPlayer} type="button">
              + Speler toevoegen
            </Button>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Bezig...' : 'Start spel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
