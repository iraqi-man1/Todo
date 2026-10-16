import type { DateKey, Priority } from '@/domain/types'
import { addDaysKey, fromKey } from './dates'

export interface QuickAdd {
  title: string
  date?: DateKey
  dueTime?: string
  priority?: Priority
}

// Arabic has no \b in JS regexes, so words are bounded by whitespace, punctuation or the string ends.
const B = '(?<=^|[\\s,،.!?؟])'
const E = '(?=$|[\\s,،.!?؟])'

const EN_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const EN_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** Fold Arabic letter variants and digits so "الإثنين", "٩" and "9" all match. */
function fold(s: string) {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[إأآ]/g, 'ا')
}

const PM_WORDS = 'pm|p\\.m\\.|مساء|مساءً|مساءا|المسا|المساء|بالليل|الليل|العصر|عصرا|عصراً|الظهر|ظهرا|ظهراً|م'
const AM_WORDS = 'am|a\\.m\\.|صباحا|صباحاً|الصبح|الصباح|صبحا|ص'

/**
 * Pull a date, a time and an urgency marker out of a quick-add line, in English or (Iraqi) Arabic:
 * "call Ahmed tomorrow 9am", "اتصل بأحمد باچر 9 الصبح", "report friday at 3:30 !".
 * Whatever is recognised is removed from the title; anything ambiguous is left alone.
 */
export function parseQuickAdd(input: string, today: DateKey): QuickAdd {
  let text = ` ${input.trim()} `
  const folded = () => fold(text)
  const out: QuickAdd = { title: '' }
  // Remove a match found in the folded copy from the original text (both have equal length).
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = folded().match(re)
    if (!m || m.index === undefined) return null
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`
    return m
  }

  // urgency: a trailing "!" or "!!", or the words urgent / مهم / عاجل
  if (take(new RegExp(`${B}(!{1,3}|urgent|important|مهم|ضروري|عاجل)${E}`, 'i'))) out.priority = 'high'

  // dates
  // A weekday always means the next one to come; naming today's weekday means a week from now.
  const weekday = (target: number) => addDaysKey(today, (target - fromKey(today).getDay() + 7) % 7 || 7)
  if (take(new RegExp(`${B}(the day after tomorrow|day after tomorrow|بعد باچر|بعد باكر|بعد بكرة|بعد بكره|بعد غد|بعد الغد)${E}`, 'i'))) out.date = addDaysKey(today, 2)
  else if (take(new RegExp(`${B}(tomorrow|tmrw|باچر|باكر|بكرة|بكره|غدا|غداً|الغد)${E}`, 'i'))) out.date = addDaysKey(today, 1)
  else if (take(new RegExp(`${B}(today|اليوم)${E}`, 'i'))) out.date = today
  else if (take(new RegExp(`${B}(tonight|الليلة|الليله)${E}`, 'i'))) {
    out.date = today
    out.dueTime = '20:00'
  } else {
    const inDays = take(new RegExp(`${B}(?:in (\\d{1,2}) days?|بعد (\\d{1,2}) (?:ايام|أيام|يوم))${E}`, 'i'))
    if (inDays) out.date = addDaysKey(today, Number(inDays[1] ?? inDays[2]))
    else {
      const en = take(new RegExp(`${B}(?:(next|on) )?(${EN_DAYS.join('|')}|${EN_SHORT.join('|')})${E}`, 'i'))
      if (en) {
        const name = en[2].toLowerCase()
        const idx = EN_DAYS.indexOf(name) >= 0 ? EN_DAYS.indexOf(name) : EN_SHORT.indexOf(name)
        out.date = weekday(idx)
      } else {
        const ar = take(new RegExp(`${B}(?:يوم |ب)?(${AR_DAYS.map(fold).join('|')})( الجاي| القادم)?${E}`))
        if (ar) out.date = weekday(AR_DAYS.map(fold).indexOf(ar[1]))
      }
    }
  }

  // times: "9am", "9:30 pm", "at 21:00", "الساعة 9", "9 الصبح", "3 العصر"
  const time =
    take(new RegExp(`${B}(?:at |@ ?|الساعة |الساعه |ساعة |ساعه )?(\\d{1,2})(?::(\\d{2}))? ?(${PM_WORDS}|${AM_WORDS})${E}`, 'i')) ??
    take(new RegExp(`${B}(?:at |@ ?|الساعة |الساعه |ساعة |ساعه )(\\d{1,2})(?::(\\d{2}))?()${E}`, 'i')) ??
    take(new RegExp(`${B}()(\\d{1,2}):(\\d{2})()${E}`))
  if (time) {
    // the third regex shifts groups by one (an empty first group keeps the indices aligned)
    const [h0, m0, mark] = time[0].match(/^\s*\d{1,2}:\d{2}\s*$/) ? [time[2], time[3], ''] : [time[1], time[2], time[3] ?? '']
    let h = Number(h0)
    const m = Number(m0 ?? 0)
    const pm = mark && new RegExp(`^(${PM_WORDS})$`, 'i').test(mark)
    const am = mark && new RegExp(`^(${AM_WORDS})$`, 'i').test(mark)
    if (pm && h < 12) h += 12
    if (am && h === 12) h = 0
    // "at 3" with no am/pm most likely means the afternoon
    if (!pm && !am && !m0 && h >= 1 && h <= 7) h += 12
    if (h <= 23 && m <= 59) out.dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  out.title = text.replace(/\s+/g, ' ').trim()
  // never leave an empty title: fall back to what the user typed
  if (!out.title) return { title: input.trim() }
  return out
}
