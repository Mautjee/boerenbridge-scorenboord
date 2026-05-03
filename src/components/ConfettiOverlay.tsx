import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

function randomRange(min: number, max: number) {
  return Math.random() * (max - min) + min
}

export function ConfettiOverlay() {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; delay: number; duration: number; color: string }>>([])

  useEffect(() => {
    const colors = [
      'bg-red-400',
      'bg-blue-400',
      'bg-green-400',
      'bg-yellow-400',
      'bg-purple-400',
      'bg-pink-400',
      'bg-indigo-400',
      'bg-orange-400',
    ]
    const p = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: randomRange(0, 100),
      delay: randomRange(0, 2),
      duration: randomRange(2, 4),
      color: colors[Math.floor(randomRange(0, colors.length))],
    }))
    setPieces(p)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <div
          key={p.id}
          className={cn('absolute w-2 h-2 rounded-sm', p.color)}
          style={{
            left: `${p.left}%`,
            top: '-8px',
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg) translateX(${randomRange(-50, 50)}px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
