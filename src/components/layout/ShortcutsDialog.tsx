import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { useUI } from '@/store/ui'

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcutsOpen)
  const set = useUI((s) => s.setShortcutsOpen)
  const { d } = useI18n()
  const rows: [string[], string][] = [
    [['1', '–', '5'], d.shortcuts.nav],
    [['N'], d.shortcuts.newTask],
    [['/'], d.shortcuts.search],
    [['+', '−'], d.shortcuts.zoom],
    [['0'], d.shortcuts.reset],
    [['←', '↑', '→', '↓'], d.shortcuts.pan],
    [['?'], d.shortcuts.help],
  ]
  return (
    <Dialog open={open} onOpenChange={set}>
      <DialogContent>
        <DialogTitle>{d.shortcuts.title}</DialogTitle>
        <DialogDescription className="sr-only">{d.shortcuts.title}</DialogDescription>
        <dl className="mt-4 divide-y divide-line">
          {rows.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <dt className="text-sm">{label}</dt>
              <dd className="flex gap-1">
                {keys.map((k) =>
                  k === '–' ? (
                    <span key={k} className="px-0.5 text-ink-soft">
                      –
                    </span>
                  ) : (
                    <kbd key={k} className="min-w-7 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-center text-xs font-medium">
                      {k}
                    </kbd>
                  ),
                )}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
