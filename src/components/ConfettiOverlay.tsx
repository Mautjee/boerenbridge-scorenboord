import { useEffect, useRef } from 'react'

const CONFETTI_COLORS = [
  'bg-indigo-400', 'bg-rose-400', 'bg-emerald-400',
  'bg-amber-400', 'bg-sky-400', 'bg-violet-400',
]

interface ConfettiPiece {
  id: number
  color: string
  left: number
  delay: number
  duration: number
  x: number
}

function generatePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? 'bg-indigo-400',
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    x: (Math.random() - 0.5) * 200,
  }))
}

const pieces = generatePieces(60)

export function ConfettiOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className={`absolute w-2 h-2 rounded-sm confetti-piece ${p.color}`}
          style={{
            left: `${p.left}%`,
            top: '-8px',
            '--confetti-delay': `${p.delay}s`,
            '--confetti-duration': `${p.duration}s`,
            '--confetti-x': `${p.x}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
