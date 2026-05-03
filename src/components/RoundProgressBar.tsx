interface RoundProgressBarProps {
  rounds: number[]
  currentRoundIndex: number
}

export function RoundProgressBar({ rounds, currentRoundIndex }: RoundProgressBarProps) {
  const total = rounds.length
  const progress = total > 0 ? (currentRoundIndex / total) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Ronde {currentRoundIndex + 1} van {total}</span>
        <span>{rounds[currentRoundIndex]} kaarten</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={currentRoundIndex}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      <div className="flex gap-0.5">
        {rounds.map((cardCount, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-colors ${
              i < currentRoundIndex
                ? 'bg-primary'
                : i === currentRoundIndex
                ? 'bg-primary/50'
                : 'bg-secondary'
            }`}
            title={`Ronde ${i + 1}: ${cardCount} kaarten`}
          />
        ))}
      </div>
    </div>
  )
}
