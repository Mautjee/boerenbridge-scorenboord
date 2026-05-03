import { cn } from '~/lib/utils'
import { PlayerAvatar } from './PlayerAvatar'
import type { Player } from '~/server/db/schema'

interface TrickRowProps {
  player: Player
  bid: number
  value: number | null
  flashResult?: { hit: boolean; delta: number } | null
  onChange: (value: number | null) => void
  onEnter?: () => void
}

export function TrickRow({ player, bid, value, flashResult, onChange, onEnter }: TrickRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg p-3 transition-colors duration-600',
        flashResult?.hit === true && 'bg-green-50 dark:bg-green-950',
        flashResult?.hit === false && flashResult?.delta !== undefined && 'bg-red-50 dark:bg-red-950',
      )}
    >
      <PlayerAvatar name={player.name} colorIndex={player.colorIndex} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{player.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Bod: {bid}</div>
      </div>
      {flashResult !== null && flashResult !== undefined ? (
        <div className={cn(
          'text-sm font-medium font-tabular',
          flashResult.hit ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300',
        )}>
          {flashResult.delta > 0 ? `+${flashResult.delta}` : flashResult.delta}
        </div>
      ) : null}
      <input
        type="number"
        min={0}
        value={value ?? ''}
        aria-label={`Slagen van ${player.name}`}
        className={cn(
          'w-16 rounded-md border border-input bg-background px-2 py-1.5 text-center text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          'font-tabular transition-colors',
        )}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') { onChange(null); return }
          const n = parseInt(v, 10)
          if (!isNaN(n)) onChange(n)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.()
        }}
      />
    </div>
  )
}
