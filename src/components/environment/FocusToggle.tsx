import { Moon, Sun } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'

export function FocusToggle({ className }: { className?: string }) {
  const { d } = useI18n()
  const on = usePrefs((s) => s.prefs.focusMode)
  const update = usePrefs((s) => s.update)
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => update({ focusMode: !on })}
      title={`${d.focus.label} (F)`}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
        on ? 'bg-accent text-accent-ink shadow-soft' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {on ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{on ? d.focus.exit : d.focus.label}</span>
      <span className="sr-only sm:hidden">{on ? d.focus.exit : d.focus.label}</span>
    </button>
  )
}
