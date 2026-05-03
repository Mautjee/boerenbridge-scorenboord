import { Input } from './ui/input'
import { PlayerAvatar } from './PlayerAvatar'
import type { Player } from '@/stores/gameStore'
import { cn } from '@/lib/utils'

interface TrickRowProps {
  player: Player
  bid: number
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: (e: React.KeyboardEvent) => void
  flash?: 'hit' | 'miss' | null
  delta?: number | null
}

export function TrickRow({ player, bid, value, onChange, disabled, inputRef, onKeyDown, flash, delta }: TrickRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors relative overflow-hidden',
        flash === 'hit' && 'bg-green-50 dark:bg-green-950/30',
        flash === 'miss' && 'bg-red-50 dark:bg-red-950/30',
        !flash && 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      )}
    >
      <PlayerAvatar name={player.name} colorIndex={player.colorIndex} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">{player.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Bod: {bid}
          </span>
        </div>
        <Input
          ref={inputRef}
          type="number"
          min={0}
          value={value ?? ''}
          onChange={(e) => {
            const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
            onChange(isNaN(val as number) ? null : val)
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className="mt-1"
          placeholder="0"
          aria-label={`Slagen voor ${player.name}`}
        />
      </div>
      {delta !== null && delta !== undefined && (
        <div
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-xs font-bold shadow-sm z-10',
            delta >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          )}
        >
          {delta > 0 ? `+${delta}` : delta}
        </div>
      )}
    </div>
  )
}
