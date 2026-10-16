import { format as dfFormat } from 'date-fns'
import { ar as arLocale, enUS } from 'date-fns/locale'
import { useMemo } from 'react'
import { ar } from '@/locales/ar'
import { en, type Dict } from '@/locales/en'
import { usePrefs } from '@/store/prefs'
import type { DateFormatPref, DateKey, Language } from '@/domain/types'
import { fromKey } from './dates'
import { fill } from './utils'

export const DICTS: Record<Language, Dict> = { en, ar }

export type DateStyle = 'long' | 'medium' | 'short' | 'weekday' | 'weekdayShort' | 'month' | 'monthYear' | 'monthShort' | 'day' | 'year'

const PATTERNS: Record<DateFormatPref, Partial<Record<DateStyle, string>>> = {
  friendly: { long: 'EEEE, MMMM d', medium: 'MMM d, yyyy', short: 'MMM d' },
  dmy: { long: 'EEEE, dd/MM/yyyy', medium: 'dd/MM/yyyy', short: 'dd/MM' },
  mdy: { long: 'EEEE, MM/dd/yyyy', medium: 'MM/dd/yyyy', short: 'MM/dd' },
  iso: { long: 'EEEE, yyyy-MM-dd', medium: 'yyyy-MM-dd', short: 'MM-dd' },
}

const FIXED: Partial<Record<DateStyle, string>> = {
  weekday: 'EEEE',
  weekdayShort: 'EEE',
  month: 'MMMM',
  monthShort: 'MMM',
  monthYear: 'MMMM yyyy',
  day: 'd',
  year: 'yyyy',
}

export function formatKey(key: DateKey | Date, style: DateStyle, lang: Language, pref: DateFormatPref): string {
  const date = typeof key === 'string' ? fromKey(key) : key
  const pattern = FIXED[style] ?? PATTERNS[pref][style] ?? 'PP'
  return dfFormat(date, pattern, { locale: lang === 'ar' ? arLocale : enUS })
}

export function useI18n() {
  const lang = usePrefs((s) => s.prefs.language)
  const dateFormat = usePrefs((s) => s.prefs.dateFormat)
  return useMemo(() => {
    const d = DICTS[lang]
    return {
      d,
      lang,
      dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const),
      f: fill,
      date: (key: DateKey | Date, style: DateStyle = 'medium') => formatKey(key, style, lang, dateFormat),
      num: (n: number) => n.toLocaleString(lang === 'ar' ? 'ar' : 'en'),
      time: (ms: number) =>
        new Date(ms).toLocaleTimeString(lang === 'ar' ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' }),
    }
  }, [lang, dateFormat])
}
