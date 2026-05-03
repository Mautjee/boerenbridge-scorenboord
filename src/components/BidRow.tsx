import { Input } from './ui/input'
import { PlayerAvatar } from './PlayerAvatar'
import type { Player } from '@/stores/gameStore'
import { cn } from '@/lib/utils'

interface BidRowProps {
  player: Player
  value: number | null
  onChange: (value: number | null) => void
  isLastBidder: boolean
  forbiddenBid: number | null
  disabled?: boolean
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function BidRow({ player, value, onChange, isLastBidder, forbiddenBid, disabled, inputRef, onKeyDown }: BidRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        isLastBidder && 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
        !isLastBidder && 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      )}
    >
      <PlayerAvatar name={player.name} colorIndex={player.colorIndex} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">{player.name}</span>
          {isLastBidder && forbiddenBid !== null && (
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              Mag niet {forbiddenBid} bieden
            </span>
          )}
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
          aria-label={`Bod voor ${player.name}`}
        />
      </div>
    </div>
  )
}
