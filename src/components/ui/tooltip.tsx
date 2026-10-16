import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider

/**
 * Small, quiet label for icon-only controls. Appears after a short delay on hover or keyboard focus;
 * touch users already get the aria-label, so nothing is hidden behind hover.
 */
export function Tip({
  label,
  side = 'top',
  shortcut,
  children,
}: {
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  shortcut?: string
  children: React.ReactElement
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'dw-tip z-[60] flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-soft',
            '[backdrop-filter:blur(12px)]',
          )}
        >
          {label}
          {shortcut && <kbd className="rounded border border-line px-1 text-[10px] text-ink-soft">{shortcut}</kbd>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
