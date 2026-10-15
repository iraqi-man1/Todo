import { Check, Download, HardDrive, Keyboard, Pause, Play, Plus, Trash2, Upload, Volume2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Segmented, Select } from '@/components/ui/fields'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { storageStatus } from '@/db/db'
import { addCategory, clearAllData, deleteCategory, deleteRecurrence, setRecurrenceActive, updateCategory } from '@/domain/actions'
import { BackupError, backupFileName, exportData, importData, parseBackup, type Backup } from '@/domain/backup'
import { NOTE_HEX } from '@/domain/colors'
import { NOTE_COLORS, type NoteColor, type Prefs, type WoodTheme } from '@/domain/types'
import { useCategories, useRecurrences } from '@/hooks/useData'
import { reportError } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { isIos, promptInstall, useInstall } from '@/lib/install'
import { playSound } from '@/lib/sound'
import { WOOD_PALETTES } from '@/lib/textures'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI } from '@/store/ui'
import { WoodSwatch } from './WoodSwatch'

const VERSION = '1.0.0'

export function SettingsPanel() {
  const { d } = useI18n()
  const prefs = usePrefs((s) => s.prefs)
  const update = usePrefs((s) => s.update)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-[calc(1.25rem+var(--safe-top))] pb-28 sm:px-6 md:pt-10 md:pb-16">
      <h1 className="mb-5 text-[28px] font-semibold tracking-tight">{d.settings.title}</h1>

      <Section title={d.settings.profile}>
        <Row label={d.settings.name} htmlFor="pref-name">
          <NameInput value={prefs.name} onSave={(name) => update({ name })} />
        </Row>
      </Section>

      <Section title={d.settings.appearance}>
        <Row label={d.settings.theme} stacked>
          <Segmented label={d.settings.theme} value={prefs.theme} onChange={(theme) => update({ theme })} className="flex w-full" options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: d.settings.themes[v] }))} />
        </Row>
        <Row label={d.settings.wood} stacked>
          <div role="radiogroup" aria-label={d.settings.wood} className="grid grid-cols-3 gap-2">
            {(Object.keys(WOOD_PALETTES) as WoodTheme[]).map((w) => {
              const on = prefs.wood === w
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ wood: w })}
                  className={cn('overflow-hidden rounded-2xl border text-start transition', on ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-ink-soft/40')}
                >
                  <WoodSwatch wood={w} />
                  <span className="flex items-center justify-between gap-1 px-2.5 py-2 text-[13px] font-medium">
                    {d.settings.woods[w]}
                    {on && <Check className="size-4 text-accent" />}
                  </span>
                </button>
              )
            })}
          </div>
        </Row>
        <Row label={d.settings.noteColor} stacked>
          <ColorPicker value={prefs.defaultNoteColor} onChange={(c) => update({ defaultNoteColor: c })} label={d.settings.noteColor} />
        </Row>
        <Row label={d.settings.motion} stacked>
          <Segmented label={d.settings.motion} value={prefs.motion} onChange={(motion) => update({ motion })} className="flex w-full" options={(['auto', 'full', 'reduced', 'off'] as const).map((v) => ({ value: v, label: d.settings.motions[v] }))} />
        </Row>
        <Row label={d.settings.motivation}>
          <Switch checked={prefs.showMotivation} onCheckedChange={(showMotivation) => update({ showMotivation })} aria-label={d.settings.motivation} />
        </Row>
      </Section>

      <Section title={d.settings.language}>
        <Row label={d.settings.languageLabel} htmlFor="pref-lang">
          <Select id="pref-lang" value={prefs.language} onChange={(e) => update({ language: e.target.value as Prefs['language'] })} className="w-44">
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Row>
        <Row label={d.settings.weekStart} htmlFor="pref-week">
          <Select id="pref-week" value={prefs.weekStartsOn} onChange={(e) => update({ weekStartsOn: Number(e.target.value) as Prefs['weekStartsOn'] })} className="w-44">
            {([1, 0, 6] as const).map((wd) => (
              <option key={wd} value={wd}>
                {new Date(2023, 0, 1 + wd).toLocaleDateString(prefs.language, { weekday: 'long' })}
              </option>
            ))}
          </Select>
        </Row>
        <Row label={d.settings.dateFormat} htmlFor="pref-df">
          <Select id="pref-df" value={prefs.dateFormat} onChange={(e) => update({ dateFormat: e.target.value as Prefs['dateFormat'] })} className="w-44">
            {(['friendly', 'dmy', 'mdy', 'iso'] as const).map((f) => (
              <option key={f} value={f}>
                {d.settings.dateFormats[f]}
              </option>
            ))}
          </Select>
        </Row>
      </Section>

      <Section title={d.settings.sound}>
        <Row label={d.settings.soundEffects}>
          <Switch
            checked={prefs.sound}
            onCheckedChange={(sound) => {
              update({ sound })
              if (sound) setTimeout(() => playSound('tap'), 30)
            }}
            aria-label={d.settings.soundEffects}
          />
        </Row>
        <Row label={d.settings.volume} stacked>
          <div className="flex items-center gap-3">
            <Slider
              value={[Math.round(prefs.volume * 100)]}
              onValueChange={([v]) => update({ volume: v / 100 })}
              max={100}
              step={5}
              disabled={!prefs.sound}
              thumbLabel={d.settings.volume}
            />
            <Button variant="secondary" size="sm" disabled={!prefs.sound} onClick={() => playSound('chime')}>
              <Volume2 /> {d.settings.testSound}
            </Button>
          </div>
        </Row>
      </Section>

      <Reminders />
      <Categories />
      <Recurring />
      <DataSection />

      <Section title={d.settings.about}>
        <InstallRow />
        <Row label={d.settings.shortcuts}>
          <Button variant="secondary" size="sm" onClick={() => useUI.getState().setShortcutsOpen(true)}>
            <Keyboard /> ?
          </Button>
        </Row>
        <p className="px-4 py-3 text-sm text-ink-soft">
          {d.appName} · {d.settings.version.replace('{v}', VERSION)} — {d.tagline}
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">{children}</div>
    </section>
  )
}

function Row({ label, children, htmlFor, stacked, help }: { label: string; children: React.ReactNode; htmlFor?: string; stacked?: boolean; help?: string }) {
  return (
    <div className={cn('px-4 py-3.5', stacked ? 'flex flex-col gap-2.5' : 'flex min-h-14 items-center justify-between gap-4')}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-[15px] font-medium">
          {label}
        </label>
        {help && <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{help}</p>}
      </div>
      {children}
    </div>
  )
}

function NameInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const { d } = useI18n()
  const [v, setV] = useState(value)
  return <Input id="pref-name" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== value && onSave(v.trim())} placeholder={d.settings.namePlaceholder} maxLength={40} className="w-48" />
}

function ColorPicker({ value, onChange, label }: { value: NoteColor; onChange: (c: NoteColor) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {NOTE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn('grid size-11 place-items-center rounded-[6px] shadow-[0_1px_2px_rgb(60_40_20/0.15),0_3px_6px_-2px_rgb(60_40_20/0.2)] transition', value === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'hover:-translate-y-0.5')}
          style={{ background: NOTE_HEX[c] }}
        >
          {value === c && <Check className="size-5 text-[#302c28]" />}
        </button>
      ))}
    </div>
  )
}

function Reminders() {
  const { d } = useI18n()
  const prefs = usePrefs((s) => s.prefs)
  const update = usePrefs((s) => s.update)
  const supported = typeof Notification !== 'undefined'
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  const toggle = async (on: boolean) => {
    if (on && supported && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      setPerm(p)
      if (p !== 'granted') return
    }
    update({ remindersEnabled: on })
  }
  return (
    <Section title={d.settings.reminders}>
      <Row label={d.settings.dailyReminder} help={!supported ? d.settings.reminderUnsupported : perm === 'denied' ? d.settings.reminderDenied : d.settings.reminderHelp}>
        <Switch checked={prefs.remindersEnabled && perm === 'granted'} onCheckedChange={toggle} disabled={!supported || perm === 'denied'} aria-label={d.settings.dailyReminder} />
      </Row>
      {prefs.remindersEnabled && perm === 'granted' && (
        <Row label={d.settings.reminderTime} htmlFor="pref-rtime">
          <Input id="pref-rtime" type="time" value={prefs.reminderTime} onChange={(e) => e.target.value && update({ reminderTime: e.target.value })} className="w-36" />
        </Row>
      )}
    </Section>
  )
}

function Categories() {
  const { d, f } = useI18n()
  const categories = useCategories()
  const [name, setName] = useState('')
  const [color, setColor] = useState<NoteColor>('mint')
  return (
    <Section title={d.settings.categories}>
      {categories.length === 0 && <p className="px-4 py-3.5 text-sm text-ink-soft">{d.settings.noCategories}</p>}
      {categories.map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            aria-label={`${c.name}: ${c.color}`}
            onClick={() => updateCategory(c.id, { color: NOTE_COLORS[(NOTE_COLORS.indexOf(c.color) + 1) % NOTE_COLORS.length] }).catch(reportError)}
            className="size-7 shrink-0 rounded-[4px] shadow-sm"
            style={{ background: NOTE_HEX[c.color] }}
          />
          <input
            defaultValue={c.name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && updateCategory(c.id, { name: e.target.value.trim() }).catch(reportError)}
            className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[15px] hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            aria-label={d.task.category}
            maxLength={30}
          />
          <Button variant="ghost" size="iconSm" onClick={() => deleteCategory(c.id).catch(reportError)} aria-label={f(d.settings.deleteCategory, { name: c.name })}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <form
        className="flex items-center gap-2 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          addCategory(name, color).then(() => setName(''), reportError)
          setColor(NOTE_COLORS[(NOTE_COLORS.indexOf(color) + 1) % NOTE_COLORS.length])
        }}
      >
        <button
          type="button"
          aria-label={color}
          onClick={() => setColor(NOTE_COLORS[(NOTE_COLORS.indexOf(color) + 1) % NOTE_COLORS.length])}
          className="size-7 shrink-0 rounded-[4px] shadow-sm"
          style={{ background: NOTE_HEX[color] }}
        />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={d.settings.categoryPlaceholder} aria-label={d.settings.categoryPlaceholder} maxLength={30} className="h-10" />
        <Button type="submit" variant="secondary" size="sm" disabled={!name.trim()}>
          <Plus /> {d.settings.addCategory}
        </Button>
      </form>
    </Section>
  )
}

function Recurring() {
  const { d } = useI18n()
  const recs = useRecurrences()
  return (
    <Section title={d.settings.recurring}>
      {recs.length === 0 && <p className="px-4 py-3.5 text-sm text-ink-soft">{d.settings.noRecurring}</p>}
      {recs.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className={cn('min-w-0 flex-1', !r.active && 'opacity-55')}>
            <p className="truncate text-[15px]">{r.title}</p>
            <p className="text-xs text-ink-soft">
              {d.task.repeatOptions[r.frequency]}
              {r.frequency === 'weekly' && ` ${r.weekdays.map((wd) => new Date(2023, 0, 1 + wd).toLocaleDateString(document.documentElement.lang, { weekday: 'short' })).join(', ')}`}
              {!r.active && ` · ${d.settings.paused}`}
            </p>
          </div>
          <Button variant="ghost" size="iconSm" onClick={() => setRecurrenceActive(r.id, !r.active).catch(reportError)} aria-label={r.active ? d.settings.pause : d.settings.resume}>
            {r.active ? <Pause /> : <Play />}
          </Button>
          <Button variant="ghost" size="iconSm" onClick={() => deleteRecurrence(r.id).catch(reportError)} aria-label={d.settings.deleteRecurring}>
            <X />
          </Button>
        </div>
      ))}
    </Section>
  )
}

function DataSection() {
  const { d, f } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const status = storageStatus()

  const doExport = async () => {
    try {
      const data = await exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName()
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      reportError(e)
    }
  }

  const onFile = async (file: File) => {
    try {
      setPending(parseBackup(await file.text()))
    } catch (e) {
      toast.error(e instanceof BackupError && e.message === 'newer-version' ? d.settings.importNewer : d.settings.importError)
    }
  }

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    try {
      const r = await importData(pending, mode)
      toast.success(f(d.settings.imported, { added: r.added, updated: r.updated }), {
        description: r.archiveConflicts ? f(d.settings.importConflicts, { n: r.archiveConflicts }) : undefined,
      })
      const prefs = pending.data.prefs[0]
      if (prefs) usePrefs.getState().hydrate({ ...usePrefs.getState().prefs, ...prefs })
    } catch (e) {
      reportError(e)
    } finally {
      setPending(null)
    }
  }

  return (
    <Section title={d.settings.data}>
      <Row label={d.settings.storage} help={status === 'memory' ? d.settings.storageMemory : status === 'persistent' ? d.settings.storagePersistent : d.settings.storageOk}>
        <HardDrive className={cn('size-5 shrink-0', status === 'memory' ? 'text-danger' : 'text-success')} aria-hidden />
      </Row>
      <div className="flex flex-col gap-2 px-4 py-3.5">
        <p className="text-[13px] text-ink-soft">{d.settings.dataHelp}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doExport}>
            <Download /> {d.settings.export}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload /> {d.settings.import}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      <Row label={d.settings.reset}>
        <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmReset(true)}>
          <Trash2 /> {d.settings.reset}
        </Button>
      </Row>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogTitle>{d.settings.importTitle}</DialogTitle>
          <DialogDescription className="mt-2">{d.settings.importBody}</DialogDescription>
          {pending && (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-soft tabular-nums">
              {pending.exportedAt && new Date(pending.exportedAt).toLocaleString()} · {pending.data.tasks.length} · {pending.data.archives.length}
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="primary" onClick={() => doImport('merge')}>
              {d.settings.importMerge}
            </Button>
            <Button variant="secondary" className="text-danger" onClick={() => doImport('replace')}>
              {d.settings.importReplace}
            </Button>
            <DialogClose asChild>
              <Button variant="ghost">{d.common.cancel}</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={d.settings.resetTitle}
        body={d.settings.resetBody}
        confirmLabel={d.settings.resetConfirm}
        danger
        onConfirm={() => clearAllData().then(() => toast(d.settings.resetDone), reportError)}
      />
    </Section>
  )
}

function InstallRow() {
  const { d } = useI18n()
  const event = useInstall((s) => s.event)
  const installed = useInstall((s) => s.installed)
  if (installed) return <Row label={d.settings.install} help={d.settings.installed}>{null}</Row>
  if (event)
    return (
      <Row label={d.settings.install} help={d.settings.installHelp}>
        <Button variant="primary" size="sm" onClick={() => void promptInstall()}>
          <Download /> {d.settings.install}
        </Button>
      </Row>
    )
  return <Row label={d.settings.install} help={isIos() ? d.settings.installIos : d.settings.installHelp}>{null}</Row>
}
