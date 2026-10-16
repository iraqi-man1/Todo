import { useEffect, useRef, useState } from 'react'

/**
 * Returns a counter that increases only when `complete` flips from false to true for the same `key`
 * after data has been observed. Opening an already-finished day, re-rendering, or switching days never
 * triggers it.
 */
export function useCompletionTransition(key: string, complete: boolean | undefined): number {
  const prev = useRef<{ key: string; complete: boolean } | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (complete === undefined) return
    const p = prev.current
    if (p && p.key === key && !p.complete && complete) setTick((t) => t + 1)
    prev.current = { key, complete }
  }, [key, complete])
  return tick
}
