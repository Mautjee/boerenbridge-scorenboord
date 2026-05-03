import * as React from 'react'
import { cn } from '@/lib/utils'

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'ghost' | 'outline' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    asChild?: boolean
  }
>(({ className, variant = 'default', size = 'default', asChild = false, children, ...props }, ref) => {
  const classes = cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    variant === 'default' && 'bg-indigo-500 text-white hover:bg-indigo-600',
    variant === 'ghost' && 'hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
    variant === 'outline' && 'border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
    variant === 'destructive' && 'bg-red-500 text-white hover:bg-red-600',
    size === 'default' && 'h-10 px-4 py-2',
    size === 'sm' && 'h-8 px-3 text-xs',
    size === 'lg' && 'h-12 px-6 text-base',
    size === 'icon' && 'h-10 w-10',
    className
  )

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      className: cn(classes, (children as React.ReactElement).props.className),
      ref,
      ...(props as Record<string, unknown>),
    })
  }

  return (
    <button
      ref={ref}
      className={classes}
      {...props}
    >
      {children}
    </button>
  )
})
Button.displayName = 'Button'

export { Button }
