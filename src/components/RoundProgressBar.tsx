import { cn } from '@/lib/utils'

interface RoundProgressBarProps {
  rounds: number[]
  currentRoundIndex: number
}

export function RoundProgressBar({ rounds, currentRoundIndex }: RoundProgressBarProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {rounds.map((cardCount, idx) => (
        <div
          key={idx}
          className={cn(
            'flex flex-col items-center gap-0.5 min-w-[2rem]',
            idx < currentRoundIndex && 'opacity-50',
            idx === currentRoundIndex && 'opacity-100',
            idx > currentRoundIndex && 'opacity-30'
          )}
        >
          <div
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
              idx < currentRoundIndex && 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
              idx === currentRoundIndex && 'bg-indigo-500 text-white',
              idx > currentRoundIndex && 'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600'
            )}
          >
            {cardCount}
          </div>
          <span className="text-[10px] text-zinc-400 tabular-nums">{idx + 1}</span>
        </div>
      ))}
    </div>
  )
}
