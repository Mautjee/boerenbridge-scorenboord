import { useRef, useEffect } from 'react'
import { cn } from '~/lib/utils'
import { PlayerAvatar } from './PlayerAvatar'
import type { Player } from '~/server/db/schema'

interface BidRowProps {
  player: Player
  value: number | null
  cardCount: number
  isLastBidder: boolean
  forbiddenBid: number | null
  disabled?: boolean
  onChange: (value: number | null) => void
  onEnter?: () => void
}

export function BidRow({
  player,
  value,
  cardCount,
  isLastBidder,
  forbiddenBid,
  disabled,
  onChange,
  onEnter,
}: BidRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg p-3',
        isLastBidder && 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800',
      )}
    >
      <PlayerAvatar name={player.name} colorIndex={player.colorIndex} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{player.name}</div>
        {isLastBidder && forbiddenBid !== null && (
          <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Bod van {forbiddenBid} is niet toegestaan
          </div>
        )}
        {isLastBidder && forbiddenBid === null && (
          <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Blinde bieder — elk bod toegestaan
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={cardCount}
        value={value ?? ''}
        disabled={disabled}
        aria-label={`Bod van ${player.name}`}
        className={cn(
          'w-16 rounded-md border border-input bg-background px-2 py-1.5 text-center text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          'font-tabular transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          value !== null && forbiddenBid !== null && value === forbiddenBid && 'border-red-500',
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
