import * as React from 'react'
import { NOTE_HEX } from '@/domain/colors'
import type { NoteColor } from '@/domain/types'
import { cn } from '@/lib/utils'

/** The paper itself: color, grain, top adhesive band, soft shadow and a curled corner. */
export const Paper = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { color: NoteColor; curl?: boolean; ruled?: boolean }
>(({ color, curl = true, ruled, className, style, children, ...rest }, ref) => (
  <div
    ref={ref}
    className={cn('paper', curl && 'paper-curl', className)}
    style={{ ...style, ['--note-bg' as string]: NOTE_HEX[color] }}
    {...rest}
  >
    {ruled && <div aria-hidden className="ruled pointer-events-none absolute inset-x-0 top-14 bottom-4" />}
    {children}
  </div>
))
Paper.displayName = 'Paper'
