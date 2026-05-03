import { cn, getPlayerColorClass } from '~/lib/utils'

interface PlayerAvatarProps {
  name: string
  colorIndex: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlayerAvatar({ name, colorIndex, size = 'md', className }: PlayerAvatarProps) {
  const initial = name.charAt(0).toUpperCase()

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-14 h-14 text-xl',
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium shrink-0',
        sizeClasses[size],
        getPlayerColorClass(colorIndex),
        className,
      )}
      aria-label={name}
    >
      {initial}
    </div>
  )
}
