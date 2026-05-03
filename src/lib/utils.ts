import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const PLAYER_COLORS = [
  { light: 'bg-indigo-100 text-indigo-700', dark: 'dark:bg-indigo-900 dark:text-indigo-200' },
  { light: 'bg-rose-100 text-rose-700', dark: 'dark:bg-rose-900 dark:text-rose-200' },
  { light: 'bg-emerald-100 text-emerald-700', dark: 'dark:bg-emerald-900 dark:text-emerald-200' },
  { light: 'bg-amber-100 text-amber-700', dark: 'dark:bg-amber-900 dark:text-amber-200' },
  { light: 'bg-sky-100 text-sky-700', dark: 'dark:bg-sky-900 dark:text-sky-200' },
  { light: 'bg-violet-100 text-violet-700', dark: 'dark:bg-violet-900 dark:text-violet-200' },
  { light: 'bg-teal-100 text-teal-700', dark: 'dark:bg-teal-900 dark:text-teal-200' },
  { light: 'bg-orange-100 text-orange-700', dark: 'dark:bg-orange-900 dark:text-orange-200' },
] as const

export function getPlayerColorClass(colorIndex: number): string {
  const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]
  return `${color?.light ?? ''} ${color?.dark ?? ''}`
}
