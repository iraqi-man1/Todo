import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...p }, ref) => <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold tracking-tight', className)} {...p} />,
)
DialogTitle.displayName = 'DialogTitle'
export const DialogDescription = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...p }, ref) => <DialogPrimitive.Description ref={ref} className={cn('text-sm text-ink-soft', className)} {...p} />,
)
DialogDescription.displayName = 'DialogDescription'

/**
 * Bottom sheet on phones, centered card on larger screens. Radix provides focus trapping,
 * Escape to close, scroll locking and aria wiring.
 */
export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => {
  const { d } = useI18n()
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dw-overlay fixed inset-0 z-50 bg-[rgb(30_20_10/0.38)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'dw-sheet fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-y-auto bg-surface text-ink shadow-lift outline-none',
          'inset-x-0 bottom-0 rounded-t-3xl px-5 pt-5 pb-[calc(1.25rem+var(--safe-bottom))]',
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6',
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto -mt-2 mb-3 h-1.5 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute end-3 top-3 grid size-10 place-items-center rounded-full text-ink-soft hover:bg-surface-2 hover:text-ink"
            aria-label={d.common.close}
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
DialogContent.displayName = 'DialogContent'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}) {
  const { d } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="sm:w-[min(26rem,calc(100vw-2rem))]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">{body}</DialogDescription>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <button className="h-11 rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface-2">{d.common.cancel}</button>
          </DialogClose>
          <button
            className={cn(
              'h-11 rounded-xl px-4 text-sm font-medium',
              danger ? 'bg-danger text-white' : 'bg-accent text-accent-ink',
            )}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
