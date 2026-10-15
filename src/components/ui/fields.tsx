import * as React from 'react'
import { cn } from '@/lib/utils'

const field =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-soft/70 transition-shadow focus:border-accent/60 focus:outline-none focus:ring-3 focus:ring-accent/15'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, 'h-11', className)} {...p} />,
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, 'min-h-20 py-2.5 leading-relaxed', className)} {...p} />,
)
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...p }, ref) => (
    <select
      ref={ref}
      className={cn(
        field,
        'h-11 appearance-none bg-[length:16px] bg-[position:right_0.75rem_center] bg-no-repeat pe-9 rtl:bg-[position:left_0.75rem_center]',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2381786f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...p}
    />
  ),
)
Select.displayName = 'Select'

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-ink-soft', className)} {...p} />
}

/** Radio-group styled as a segmented control. Arrow keys move between options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const idx = options.findIndex((o) => o.value === value)
  const onKey = (e: React.KeyboardEvent) => {
    const rtl = document.documentElement.dir === 'rtl'
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    let next = -1
    if (e.key === fwd || e.key === 'ArrowDown') next = (idx + 1) % options.length
    if (e.key === back || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length
    if (next >= 0) {
      e.preventDefault()
      onChange(options[next].value)
      refs.current[next]?.focus()
    }
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={cn('inline-flex rounded-xl bg-surface-2 p-1', className)}>
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-lg px-3 font-medium whitespace-nowrap transition-all',
              size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
              active ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(64_42_20/0.12)]' : 'text-ink-soft hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
