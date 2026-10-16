import { Check, CloudUpload } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { onWrite } from '@/db/db'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Every change is written immediately; this just confirms it quietly. */
export function SaveIndicator({ compact, className }: { compact?: boolean; className?: string }) {
  const { d } = useI18n()
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const off = onWrite(() => {
      clearTimeout(t)
      t = setTimeout(() => setPulse((p) => p + 1), 0)
    })
    return () => {
      off()
      clearTimeout(t)
    }
  }, [])
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (!pulse) return
    setFresh(true)
    const t = setTimeout(() => setFresh(false), 1600)
    return () => clearTimeout(t)
  }, [pulse])
  return (
    <span role="status" aria-live="polite" className={cn('flex items-center gap-1.5 text-xs text-ink-soft', className)} title={d.saved.saved}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={fresh ? 'f' : 'i'} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }}>
          {fresh ? <CloudUpload className="size-3.5 text-accent" /> : <Check className="size-3.5" />}
        </motion.span>
      </AnimatePresence>
      {!compact && <span>{fresh ? d.saved.savedShort : d.saved.saved}</span>}
      {compact && <span className="sr-only">{d.saved.saved}</span>}
    </span>
  )
}
