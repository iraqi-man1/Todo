import { useMemo } from 'react'
import { resolveCollection, type Collection } from '@/domain/collection'
import { usePrefs } from '@/store/prefs'
import { useAchievementRecords } from './useData'

export function useCollection(): Collection {
  const records = useAchievementRecords()
  const pinStyle = usePrefs((s) => s.prefs.pinStyle)
  const stampStyle = usePrefs((s) => s.prefs.stampStyle)
  return useMemo(() => resolveCollection({ pinStyle, stampStyle }, new Set(records.map((r) => r.id))), [records, pinStyle, stampStyle])
}
