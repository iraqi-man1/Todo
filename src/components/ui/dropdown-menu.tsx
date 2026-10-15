import * as DM from '@radix-ui/react-dropdown-menu'
import * as React from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function DropdownMenu(props: React.ComponentProps<typeof DM.Root>) {
  const { dir } = useI18n()
  return <DM.Root dir={dir} {...props} />
}
export const DropdownMenuTrigger = DM.Trigger

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DM.Content>>(
  ({ className, sideOffset = 6, ...props }, ref) => {
    return (
      <DM.Portal>
        <DM.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn('z-50 min-w-44 rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-lift', className)}
          {...props}
        />
      </DM.Portal>
    )
  },
)
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DM.Item> & { danger?: boolean }>(
  ({ className, danger, ...props }, ref) => (
    <DM.Item
      ref={ref}
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-[highlighted]:bg-surface-2 [&_svg]:size-4',
        danger && 'text-danger',
        className,
      )}
      {...props}
    />
  ),
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuSeparator = () => <DM.Separator className="my-1 h-px bg-line" />
export const DropdownMenuLabel = ({ children }: { children: React.ReactNode }) => (
  <DM.Label className="px-3 pt-1.5 pb-1 text-xs font-medium text-ink-soft">{children}</DM.Label>
)
