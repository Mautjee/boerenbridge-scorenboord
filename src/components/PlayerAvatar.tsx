import { cn } from '@/lib/utils'

const colorMap: Record<
  number,
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  0: { bg: 'bg-indigo-100', text: 'text-indigo-700', darkBg: 'dark:bg-indigo-900', darkText: 'dark:text-indigo-200' },
  1: { bg: 'bg-rose-100', text: 'text-rose-700', darkBg: 'dark:bg-rose-900', darkText: 'dark:text-rose-200' },
  2: { bg: 'bg-emerald-100', text: 'text-emerald-700', darkBg: 'dark:bg-emerald-900', darkText: 'dark:text-emerald-200' },
  3: { bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'dark:bg-amber-900', darkText: 'dark:text-amber-200' },
  4: { bg: 'bg-sky-100', text: 'text-sky-700', darkBg: 'dark:bg-sky-900', darkText: 'dark:text-sky-200' },
  5: { bg: 'bg-violet-100', text: 'text-violet-700', darkBg: 'dark:bg-violet-900', darkText: 'dark:text-violet-200' },
  6: { bg: 'bg-teal-100', text: 'text-teal-700', darkBg: 'dark:bg-teal-900', darkText: 'dark:text-teal-200' },
  7: { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900', darkText: 'dark:text-orange-200' },
}

interface PlayerAvatarProps {
  name: string
  colorIndex: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlayerAvatar({ name, colorIndex, size = 'md', className }: PlayerAvatarProps) {
  const colors = colorMap[colorIndex % 8]
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium',
        sizeClasses[size],
        colors.bg,
        colors.text,
        colors.darkBg,
        colors.darkText,
        className
      )}
    >
      {initials}
    </div>
  )
}
