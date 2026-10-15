// Dev-only visual check: seeds realistic history then screenshots key screens.
// Usage: node scripts/shots.mjs <outDir> [url]
import { chromium } from 'playwright'

const out = process.argv[2] ?? 'shots'
const url = process.argv[3] ?? 'http://localhost:5173'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })

async function seed(page) {
  await page.evaluate(async () => {
    const a = await import('/src/domain/actions.ts')
    const { toKey } = await import('/src/lib/dates.ts')
    const titles = ['Morning run', 'Reply to emails', 'Read 20 pages', 'Water the plants', 'Plan the week', 'Call mom', 'Groceries', 'Write journal', 'Stretch 10 min', 'Review budget', 'Fix the bike', 'Sketch ideas']
    const colors = ['yellow', 'pink', 'mint', 'lavender', 'peach', 'blue']
    const cat = await a.addCategory('Health', 'mint')
    await a.addCategory('Work', 'blue')
    const now = new Date()
    for (let i = 75; i >= 1; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = toKey(day)
      if (i % 9 === 4) continue // a day with nothing planned
      const n = 3 + (i % 4)
      const note = await a.addNote(key, colors[i % colors.length], i % 5 === 0 ? 'Deep work' : '')
      for (let j = 0; j < n; j++) {
        const t = await a.addTask(key, { title: titles[(i + j * 5) % titles.length], categoryId: j === 0 ? cat.id : null, priority: j === 1 ? 'high' : 'none' }, { noteId: note.id })
        const finish = i % 7 === 3 ? j < n - 2 : true
        if (finish) await a.setTaskCompleted(t.id, true)
      }
      if (i % 6 === 0) await a.setDayMeta(key, { title: i % 12 === 0 ? 'Productive!' : 'Good day', personalNote: 'Felt calm and focused.' })
      if (i !== 2) await a.archiveDay(key)
    }
    const today = toKey(now)
    const note = await a.addNote(today, 'yellow', 'Today')
    const items = ['Morning run', 'Finish the report draft', 'Call the dentist', 'Read 20 pages', 'Buy groceries', 'Plan tomorrow']
    for (let j = 0; j < items.length; j++) {
      const t = await a.addTask(today, { title: items[j], dueTime: j === 2 ? '14:30' : null, priority: j === 1 ? 'high' : j === 3 ? 'low' : 'none', categoryId: j === 0 ? cat.id : null, description: j === 1 ? 'Sections 2 and 3, then send to Sam.' : '' }, { noteId: note.id })
      if (j < 4) await a.setTaskCompleted(t.id, true)
    }
  })
}

async function shoot(name, viewport, steps, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: viewport.width < 600 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message))
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', name, m.text()))
  await page.goto(url)
  await page.waitForTimeout(800)
  await seed(page)
  if (opts.prefs) await page.evaluate(async (p) => (await import('/src/domain/actions.ts')).savePrefs(p), opts.prefs)
  for (const [route, file, extra] of steps) {
    await page.goto(url + '/#/' + route)
    await page.reload()
    await page.waitForTimeout(1500)
    if (extra) await extra(page)
    await page.screenshot({ path: `${out}/${name}-${file}.png` })
  }
  await ctx.close()
}

const mobile = { width: 390, height: 844 }
const desktop = { width: 1440, height: 900 }
const all = [
  ['today', 'today'],
  ['wall', 'wall'],
  ['calendar', 'calendar'],
  ['stats', 'stats'],
  ['settings', 'settings'],
]
const which = process.env.ONLY
const runs = [
  ['m', mobile, all, {}],
  ['d', desktop, all, {}],
]
for (const [n, v, s, o] of runs) if (!which || which.includes(n)) await shoot(n, v, s, o)
if (process.env.EXTRA) {
  await shoot('d-dark', desktop, [['wall', 'wall'], ['today', 'today']], { dark: true, prefs: { theme: 'dark' } })
  await shoot('m-ar', mobile, [['today', 'today'], ['wall', 'wall']], { prefs: { language: 'ar' } })
  await shoot('d-year', desktop, [['wall', 'year', async (p) => { await p.getByRole('radio', { name: 'Year' }).click(); await p.waitForTimeout(800) }], ['wall', 'week', async (p) => { await p.getByRole('radio', { name: 'Week' }).click(); await p.waitForTimeout(800) }], ['wall', 'inspect', async (p) => { await p.locator('[data-date]').nth(12).click(); await p.waitForTimeout(1200) }]], {})
}
await browser.close()
