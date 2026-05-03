import { cn } from '@/lib/utils'
import { PlayerAvatar } from './PlayerAvatar'
import type { RoundResult } from '@/lib/game-logic'
import type { Player } from '@/stores/gameStore'

interface ScoreTableProps {
  players: Player[]
  rounds: number[]
  completedRounds: RoundResult[]
  cumulativeScores: Record<string, number>
  currentRoundIndex: number
}

export function ScoreTable({ players, rounds, completedRounds, cumulativeScores, currentRoundIndex }: ScoreTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
              R
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
              ♠
            </th>
            {players.map((p) => (
              <th key={p.id} scope="col" className="px-3 py-2 text-center font-medium">
                <div className="flex flex-col items-center gap-1">
                  <PlayerAvatar name={p.name} colorIndex={p.colorIndex} size="sm" />
                  <span className="text-xs">{p.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((cardCount, idx) => {
            const round = completedRounds.find((r) => r.roundIndex === idx)
            const isActive = idx === currentRoundIndex

            return (
              <tr
                key={idx}
                className={cn(
                  'border-b border-zinc-100 dark:border-zinc-900',
                  isActive && 'bg-indigo-50 dark:bg-indigo-950/30'
                )}
              >
                <td className="px-3 py-2 text-zinc-500 tabular-nums">{idx + 1}</td>
                <td className="px-3 py-2 text-zinc-500 tabular-nums">{cardCount}</td>
                {players.map((p) => {
                  const data = round?.perPlayer[p.id]
                  const isHit = data?.hit
                  const isMiss = data && !data.hit

                  return (
                    <td
                      key={p.id}
                      className={cn(
                        'px-3 py-2 text-center tabular-nums',
                        isHit && 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
                        isMiss && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                      )}
                    >
                      {data ? (
                        <div className="flex flex-col items-center">
                          <span className={cn('font-medium', isHit && 'text-green-700 dark:text-green-300', isMiss && 'text-red-700 dark:text-red-300')}>
                            {data.delta > 0 ? `+${data.delta}` : data.delta}
                          </span>
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">
                            {cumulativeScores[p.id] !== undefined && round
                              ? cumulativeScores[p.id] -
                                (completedRounds
                                  .filter((r) => r.roundIndex > idx)
                                  .reduce((sum, r) => sum + (r.perPlayer[p.id]?.delta ?? 0), 0))
                              : '-'
                            }
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">-</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          <tr className="border-t-2 border-zinc-200 dark:border-zinc-800 font-medium">
            <td className="px-3 py-2" colSpan={2}>
              Totaal
            </td>
            {players.map((p) => (
              <td key={p.id} className="px-3 py-2 text-center tabular-nums">
                {cumulativeScores[p.id] ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
