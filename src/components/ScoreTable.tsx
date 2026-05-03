import { match, P } from 'ts-pattern'
import { cn } from '~/lib/utils'
import { PlayerAvatar } from './PlayerAvatar'
import type { Player } from '~/server/db/schema'
import type { RoundResult } from '~/lib/game-logic'

interface ScoreTableProps {
  players: Player[]
  completedRounds: RoundResult[]
  cumulativeScores: Record<string, number>
  currentRoundIndex: number
  totalRounds: number
  rounds: number[]
}

function getCellClass(result: { hit: boolean; delta: number } | undefined): string {
  if (!result) return ''
  return match(result)
    .with({ hit: true }, () => 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300')
    .with({ delta: P.number.lt(0) }, () => 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300')
    .otherwise(() => '')
}

export function ScoreTable({
  players,
  completedRounds,
  cumulativeScores,
  currentRoundIndex,
  totalRounds,
  rounds,
}: ScoreTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-12">
              #
            </th>
            <th scope="col" className="py-3 px-2 text-left text-xs font-medium text-muted-foreground w-12">
              Krt
            </th>
            {players.map((p) => (
              <th key={p.id} scope="col" className="py-3 px-2 text-center min-w-[72px]">
                <div className="flex flex-col items-center gap-1">
                  <PlayerAvatar name={p.name} colorIndex={p.colorIndex} size="sm" />
                  <span className="text-xs font-medium truncate max-w-[60px]">{p.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {completedRounds.map((round) => (
            <tr key={round.roundIndex} className="border-b border-border last:border-0">
              <td className="py-2 px-3 text-muted-foreground font-tabular text-xs">
                {round.roundIndex + 1}
              </td>
              <td className="py-2 px-2 text-muted-foreground font-tabular text-xs">
                {round.cardCount}
              </td>
              {players.map((p) => {
                const result = round.perPlayer[p.id]
                return (
                  <td
                    key={p.id}
                    className={cn('py-2 px-2 text-center font-tabular', getCellClass(result))}
                  >
                    {result ? (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-xs text-muted-foreground">
                          {result.bid}/{result.tricksWon}
                        </span>
                        <span className="font-medium">
                          {result.delta > 0 ? `+${result.delta}` : result.delta}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          {currentRoundIndex < totalRounds && (
            <tr className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-dashed border-indigo-200">
              <td className="py-2 px-3 text-muted-foreground font-tabular text-xs">
                {currentRoundIndex + 1}
              </td>
              <td className="py-2 px-2 text-muted-foreground font-tabular text-xs">
                {rounds[currentRoundIndex]}
              </td>
              {players.map((p) => (
                <td key={p.id} className="py-2 px-2 text-center">
                  <span className="text-muted-foreground text-xs">—</span>
                </td>
              ))}
            </tr>
          )}
          <tr className="bg-muted/30 font-medium">
            <td className="py-3 px-3 text-xs text-muted-foreground" colSpan={2}>
              Totaal
            </td>
            {players.map((p) => (
              <td key={p.id} className="py-3 px-2 text-center font-tabular">
                {cumulativeScores[p.id] ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
