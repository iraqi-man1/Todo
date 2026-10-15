import { toast } from 'sonner'
import { ArchivedDayError } from '@/domain/actions'
import { usePrefs } from '@/store/prefs'
import { DICTS } from './i18n'

export function reportError(e: unknown) {
  const d = DICTS[usePrefs.getState().prefs.language]
  console.error(e)
  toast.error(e instanceof ArchivedDayError ? d.errors.archived : d.errors.generic)
}
