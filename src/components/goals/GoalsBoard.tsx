import { CalendarClock, Check, CircleDashed, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { Pushpin } from '@/components/paper/Pushpin'
import { Paper } from '@/components/paper/StickyNote'
import { Dialog } from '@/components/ui/dialog'
import { Board } from '@/components/wall/Board'
import { WoodenMonthPlaque } from '@/components/wall/WoodenMonthPlaque'
import { noteRotation } from '@/domain/colors'
import type { Goal } from '@/domain/types'
import { useGoalsWithProgress } from '@/hooks/useGoalData'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { GoalEditor } from './GoalEditor'

/** A section of the wall for big goals: index cards with a brass progress rail. */
export function GoalsBoard({ narrow, level }: { narrow: boolean; level: MotionLevel }) {
  const { d, f, date } = useI18n()
  const goals = useGoalsWithProgress()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const cols = narrow ? 1 : 3
  const achieved = goals?.filter((g) => g.progress.achieved).length ?? 0

  return (
    <>
      <Board padding={narrow ? 24 : 52}>
        <WoodenMonthPlaque title={d.goals.title} subtitle={goals ? `${goals.length} · ${d.goals.achieved} ${achieved}` : undefined} className="mb-10" />
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 300px)`, gap: narrow ? 28 : 40 }}>
          {goals?.map(({ goal, tasks, progress }, i) => {
            const rot = noteRotation(goal.id, 2.2)
            return (
              <motion.button
                key={goal.id}
                type="button"
                onClick={() => setEditing(goal)}
                aria-label={`${goal.title}: ${f(d.goals.progress, { done: progress.done, target: progress.target })}, ${progress.percentage}%`}
                className="group relative block text-start"
                style={{ originY: 0 }}
                initial={level === 'off' ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0, rotate: rot }}
                transition={{ delay: level === 'full' ? i * 0.04 : 0, type: 'spring', stiffness: 260, damping: 22 }}
                whileHover={level === 'off' ? undefined : { y: -3, rotate: rot * 0.5 }}
              >
                <Paper color={goal.color} className="flex min-h-[230px] w-[300px] flex-col p-5 pt-6">
                  <span className="font-hand text-[30px] leading-[1.05] text-[#302c28]">{goal.title}</span>
                  {goal.description && <span className="mt-1 line-clamp-2 text-[13px] text-[#302c28]/65">{goal.description}</span>}
                  {/* brass rail in a wooden groove */}
                  <span className="mt-4 block">
                    <span
                      className="relative block h-3 overflow-hidden rounded-full"
                      style={{ background: 'linear-gradient(180deg, rgb(60 38 20 / 0.55), rgb(90 60 35 / 0.35))', boxShadow: 'inset 0 1px 2px rgb(0 0 0 / 0.45)' }}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress.percentage}
                      aria-label={goal.title}
                    >
                      <motion.span
                        className="absolute inset-y-0 start-0 rounded-full"
                        style={{ background: 'linear-gradient(180deg, #F4DFAE, #C89A55 55%, #8C6A2A)', boxShadow: 'inset 0 1px 0 rgb(255 240 210 / 0.7)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.percentage}%` }}
                        transition={{ delay: level === 'full' ? 0.2 + i * 0.04 : 0, duration: level === 'off' ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </span>
                    <span className="mt-1.5 flex items-center justify-between text-[12px] font-medium tabular-nums text-[#302c28]/70">
                      <span>{f(d.goals.progress, { done: progress.done, target: progress.target })}</span>
                      <span>{progress.percentage}%</span>
                    </span>
                  </span>
                  {tasks.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {tasks.slice(0, 3).map((t) => (
                        <li key={t.id} className="flex items-center gap-1.5 text-[12.5px] text-[#302c28]/70">
                          {t.completed ? <Check className="size-3.5 shrink-0 text-[#3D6B39]" /> : <CircleDashed className="size-3.5 shrink-0 text-[#302c28]/40" />}
                          <span className={cn('truncate', t.completed && 'line-through decoration-[#302c28]/35')}>{t.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-auto flex items-center justify-between pt-3 text-[11.5px] text-[#302c28]/60">
                    <span>{f(d.goals.linked, { n: tasks.length })}</span>
                    {goal.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="size-3.5" />
                        {f(d.goals.dueOn, { date: date(goal.dueDate, 'medium') })}
                      </span>
                    )}
                  </span>
                </Paper>
                <Pushpin color="brass" size={20} className="-top-2 left-1/2 -ml-[10px]" />
                {progress.achieved && (
                  <motion.span
                    className="absolute end-3 top-3"
                    initial={level === 'full' ? { scale: 1.8, opacity: 0, rotate: -25 } : false}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                  >
                    <DoneStamp size={66} label={d.goals.stamp} ink="#8C6A2A" rotate={12} />
                  </motion.span>
                )}
              </motion.button>
            )
          })}
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="dw-no-print flex min-h-[230px] w-[300px] flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-[rgb(255_248_235/0.55)] text-[rgb(255_248_235/0.85)] transition-colors hover:bg-white/10"
          >
            <Plus className="size-7" />
            <span className="font-hand text-[26px]">{d.goals.new}</span>
          </button>
        </div>
        {goals && goals.length === 0 && <p className="chalk font-hand mx-auto mt-8 max-w-md text-center text-[24px]">{d.goals.empty}</p>}
      </Board>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <GoalEditor key={editing === 'new' ? 'new' : editing.id} goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </>
  )
}
