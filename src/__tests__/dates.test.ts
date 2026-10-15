import { addDaysKey, fromKey, isValidKey, monthGrid, msUntilMidnight, toKey, weekDays } from '@/lib/dates'

describe('dates', () => {
  it('round-trips local date keys', () => {
    expect(toKey(fromKey('2026-10-15'))).toBe('2026-10-15')
    expect(fromKey('2026-10-15').getHours()).toBe(0)
  })
  it('validates keys strictly', () => {
    expect(isValidKey('2026-02-28')).toBe(true)
    expect(isValidKey('2026-02-30')).toBe(false)
    expect(isValidKey('2026-2-3')).toBe(false)
    expect(isValidKey(42)).toBe(false)
  })
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('builds weeks honouring the first weekday', () => {
    expect(weekDays('2026-10-15', 1)[0]).toBe('2026-10-12') // Monday
    expect(weekDays('2026-10-15', 0)[0]).toBe('2026-10-11') // Sunday
    expect(weekDays('2026-10-15', 6)[0]).toBe('2026-10-10') // Saturday
  })
  it('builds full-week month grids', () => {
    const g = monthGrid('2026-10-01', 1)
    expect(g.length % 7).toBe(0)
    expect(g.indexOf('2026-10-01')).toBe(3) // Thursday
    expect(g.filter(Boolean)).toHaveLength(31)
  })
  it('computes time to next midnight', () => {
    expect(msUntilMidnight(new Date(2026, 9, 15, 23, 59, 59))).toBeLessThan(2000)
  })
})
