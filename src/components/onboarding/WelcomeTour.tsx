import { CalendarDays, Clock } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { HandCheck } from '@/components/paper/HandCheck'
import { Pushpin } from '@/components/paper/Pushpin'
import { Paper } from '@/components/paper/StickyNote'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useMotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI } from '@/store/ui'

/** Little paper scenes, one per step, built from the same pieces the app uses. */
function Scene({ step }: { step: number }) {
  const { d } = useI18n()
  const level = useMotionLevel()
  if (step === 0)
    return (
      <Paper color="yellow" className="mx-auto w-64 rotate-[-1.5deg] p-4 text-start">
        <p className="font-hand text-[22px] text-[#302c28]">{d.onboarding.sampleNote}</p>
        <p className="mt-2 border-b border-[#302c28]/20 pb-1 text-[14px] text-[#302c28]">{d.onboarding.sampleTask}</p>
        <p className="mt-1.5 flex gap-1.5 text-[11.5px] font-medium text-[#302c28]/70">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] px-2 py-0.5">
            <CalendarDays className="size-3" /> {d.quickAdd.tomorrow}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] px-2 py-0.5">
            <Clock className="size-3" /> 09:00
          </span>
        </p>
      </Paper>
    )
  if (step === 1)
    return (
      <div className="relative mx-auto w-64">
        <Paper color="mint" className="rotate-[1deg] p-4 text-start">
          {[d.onboarding.sampleDone1, d.onboarding.sampleDone2, d.onboarding.sampleDone3].map((t) => (
            <p key={t} className="flex items-center gap-2 py-1 text-[14px] text-[#302c28]/55 line-through decoration-[#302c28]/40">
              <span className="grid size-5 place-items-center rounded-[5px] border-[1.5px] border-[#4F7A4A] text-[#3D6B39]">
                <HandCheck checked level={level} className="size-4" />
              </span>
              {t}
            </p>
          ))}
        </Paper>
        <DoneStamp size={70} label={d.stamp} className="absolute -end-3 -top-4" rotate={14} />
      </div>
    )
  return (
    <div
      className="relative mx-auto h-40 w-72 rounded-xl p-5"
      style={{ backgroundColor: '#8A5E3B', backgroundImage: 'linear-gradient(rgb(60 35 15 / 0.25), rgb(60 35 15 / 0.25)), var(--wood-texture)', backgroundSize: '100% 100%, 600px 600px', boxShadow: 'inset 0 2px 8px rgb(0 0 0 / 0.4)' }}
    >
      {(['pink', 'yellow', 'blue'] as const).map((c, i) => (
        <div key={c} className="absolute top-7" style={{ insetInlineStart: 22 + i * 82, transform: `rotate(${[-4, 2, -1][i]}deg)` }}>
          <Paper color={c} className="grid size-[72px] place-items-center">
            <span className="font-hand text-[28px] text-[#302c28]">{12 + i}</span>
          </Paper>
          <Pushpin color={(['red', 'brass', 'sage'] as const)[i]} size={14} className="-top-1.5 left-1/2 -ml-[7px]" />
        </div>
      ))}
    </div>
  )
}

/** A three-step welcome for first-time users: write a task, finish the day, pin it to the wall. */
export function WelcomeTour() {
  const { d } = useI18n()
  const onboarded = usePrefs((s) => s.prefs.onboarded)
  const update = usePrefs((s) => s.update)
  const level = useMotionLevel()
  const [step, setStep] = useState(0)
  const steps = d.onboarding.steps
  const last = step === steps.length - 1
  const finish = () => {
    update({ onboarded: true })
    setStep(0)
    useUI.getState().navigate({ name: 'today' })
    // land in the add field of today's note so the first task is one keystroke away
    // (on a blank day, open the first note the same way its "Add a task" button does)
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('input[enterkeyhint="done"]')
      if (input) input.focus()
      else document.querySelector<HTMLButtonElement>('[data-start-day]')?.click()
    }, 250)
  }

  return (
    <Dialog open={!onboarded} onOpenChange={(o) => !o && finish()}>
      <DialogContent hideClose className="text-center sm:w-[min(28rem,calc(100vw-2rem))]">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-ink-soft uppercase">{d.onboarding.welcome}</p>
        <div className="relative my-6 grid h-44 place-items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={level === 'off' ? false : { opacity: 0, y: 10, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={level === 'off' ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <Scene step={step} />
            </motion.div>
          </AnimatePresence>
        </div>
        <DialogTitle className="text-[22px] font-semibold tracking-tight">{steps[step].title}</DialogTitle>
        <DialogDescription className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-soft">{steps[step].body}</DialogDescription>
        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span key={s.title} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-accent' : 'w-1.5 bg-line')} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {step + 1} / {steps.length}
        </p>
        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={finish}>
            {d.onboarding.skip}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                {d.onboarding.back}
              </Button>
            )}
            <Button variant="primary" onClick={() => (last ? finish() : setStep((s) => s + 1))} autoFocus>
              {last ? d.onboarding.start : d.onboarding.next}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
