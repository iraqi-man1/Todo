import { Check, Lock, Shuffle } from 'lucide-react'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { Pushpin } from '@/components/paper/Pushpin'
import { PIN_UNLOCKS, STAMP_UNLOCKS } from '@/domain/collection'
import { PIN_STYLES, STAMP_STYLES, type AchievementId } from '@/domain/types'
import { useCollection } from '@/hooks/useCollection'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'

/** Choose how the wall looks from the pins and stamps you've unlocked. */
export function CollectionPanel() {
  const { d, f } = useI18n()
  const col = useCollection()
  const pinStyle = usePrefs((s) => s.prefs.pinStyle)
  const update = usePrefs((s) => s.update)
  const how = (id: AchievementId | null) => (id ? f(d.collection.locked, { how: d.achievements[id].desc }) : '')

  const tile = (on: boolean, locked: boolean) =>
    cn(
      'relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-xs font-medium transition',
      locked ? 'cursor-not-allowed border-dashed border-line opacity-55' : 'border-line hover:border-accent/50',
      on && 'border-accent ring-2 ring-accent/30',
    )
  const wood = { backgroundColor: '#B98B60', backgroundImage: 'var(--wood-texture)', backgroundSize: '400px 400px' }

  return (
    <section className="mt-8" aria-label={d.collection.title}>
      <h2 className="text-lg font-semibold">{d.collection.title}</h2>
      <p className="mb-3 text-[13px] text-ink-soft">{d.collection.help}</p>

      <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">{d.collection.pins}</h3>
      <div role="radiogroup" aria-label={d.collection.pins} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <button type="button" role="radio" aria-checked={pinStyle === 'mixed'} onClick={() => update({ pinStyle: 'mixed' })} className={tile(pinStyle === 'mixed', false)} title={d.collection.mixedHelp}>
          <span className="relative grid h-12 w-full place-items-center rounded-lg" style={wood}>
            <Shuffle className="size-5 text-[#302c28]/70" />
          </span>
          {d.collection.mixed}
        </button>
        {PIN_STYLES.map((p) => {
          const locked = !col.pins.includes(p)
          const on = pinStyle === p
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={locked}
              aria-label={`${d.collection.pinNames[p]}${locked ? `, ${how(PIN_UNLOCKS[p])}` : ''}`}
              title={locked ? how(PIN_UNLOCKS[p]) : d.collection.pinNames[p]}
              onClick={() => !locked && update({ pinStyle: p })}
              className={tile(on, locked)}
            >
              <span className="relative grid h-12 w-full place-items-center rounded-lg" style={wood}>
                <Pushpin color={p} size={24} className="relative" />
                {locked && <Lock className="absolute end-1.5 top-1.5 size-3.5 text-[#302c28]/70" />}
              </span>
              {d.collection.pinNames[p]}
              {on && <Check className="absolute end-2 top-2 size-3.5 text-accent" />}
            </button>
          )
        })}
      </div>

      <h3 className="mt-5 mb-2 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">{d.collection.stamps}</h3>
      <div role="radiogroup" aria-label={d.collection.stamps} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {STAMP_STYLES.map((s) => {
          const locked = !col.stamps.includes(s)
          const on = col.stamp === s
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={locked}
              aria-label={`${d.collection.stampNames[s]}${locked ? `, ${how(STAMP_UNLOCKS[s])}` : ''}`}
              title={locked ? how(STAMP_UNLOCKS[s]) : d.collection.stampNames[s]}
              onClick={() => !locked && update({ stampStyle: s })}
              className={tile(on, locked)}
            >
              <span className="relative grid h-16 w-full place-items-center rounded-lg bg-note-yellow">
                <DoneStamp size={54} label={d.stamp} variant={s} rotate={-8} />
                {locked && <Lock className="absolute end-1.5 top-1.5 size-3.5 text-[#302c28]/70" />}
              </span>
              {d.collection.stampNames[s]}
              {on && <Check className="absolute end-2 top-2 size-3.5 text-accent" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
