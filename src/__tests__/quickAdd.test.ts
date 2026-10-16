import { parseQuickAdd } from '@/lib/quickAdd'

// Friday
const T = '2026-10-16'

describe('quick add parsing', () => {
  it('reads English dates, times and urgency', () => {
    expect(parseQuickAdd('Call Ahmed tomorrow 9am', T)).toEqual({ title: 'Call Ahmed', date: '2026-10-17', dueTime: '09:00' })
    expect(parseQuickAdd('Report friday at 3:30pm !', T)).toEqual({ title: 'Report', date: '2026-10-23', dueTime: '15:30', priority: 'high' })
    expect(parseQuickAdd('Gym monday', T)).toEqual({ title: 'Gym', date: '2026-10-19' })
    expect(parseQuickAdd('Dinner tonight', T)).toEqual({ title: 'Dinner', date: T, dueTime: '20:00' })
    expect(parseQuickAdd('Dentist at 3', T)).toMatchObject({ title: 'Dentist', dueTime: '15:00' })
    expect(parseQuickAdd('Standup 10:15', T)).toMatchObject({ title: 'Standup', dueTime: '10:15' })
    expect(parseQuickAdd('Renew passport in 3 days', T)).toEqual({ title: 'Renew passport', date: '2026-10-19' })
    expect(parseQuickAdd('Party day after tomorrow', T)).toMatchObject({ date: '2026-10-18' })
  })
  it('reads Iraqi Arabic, including Arabic digits', () => {
    expect(parseQuickAdd('اتصل بأحمد باچر 9 الصبح', T)).toEqual({ title: 'اتصل بأحمد', date: '2026-10-17', dueTime: '09:00' })
    expect(parseQuickAdd('اجتماع الخميس الساعة ٤ العصر', T)).toEqual({ title: 'اجتماع', date: '2026-10-22', dueTime: '16:00' })
    expect(parseQuickAdd('دفع الفاتورة بعد باچر مهم', T)).toEqual({ title: 'دفع الفاتورة', date: '2026-10-18', priority: 'high' })
    expect(parseQuickAdd('رياضة يوم الإثنين', T)).toEqual({ title: 'رياضة', date: '2026-10-19' })
  })
  it('leaves ordinary text alone and never empties the title', () => {
    expect(parseQuickAdd("Plan today's menu", T)).toEqual({ title: "Plan today's menu" })
    expect(parseQuickAdd('Buy 2 apples', T)).toEqual({ title: 'Buy 2 apples' })
    expect(parseQuickAdd('tomorrow', T)).toEqual({ title: 'tomorrow' })
  })
})
