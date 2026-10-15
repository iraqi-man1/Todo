import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionConfig } from 'motion/react'
import { db, resetDbForTests } from '@/db/db'
import { TodayBoard } from '@/components/today/TodayBoard'
import { TaskEditor } from '@/components/today/TaskEditor'
import { usePrefs } from '@/store/prefs'
import { DEFAULT_PREFS } from '@/domain/types'

function setup() {
  usePrefs.setState({ prefs: { ...DEFAULT_PREFS, motion: 'off' }, ready: true })
  return render(
    <MotionConfig reducedMotion="always">
      <TodayBoard />
      <TaskEditor />
    </MotionConfig>,
  )
}

beforeEach(async () => {
  await resetDbForTests()
})

describe('Today planner', () => {
  it('adds tasks from the empty state, completes them with the keyboard, and offers pinning', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Add task' }))
    const input = await screen.findByRole('textbox', { name: 'Add task' })
    await user.type(input, 'Write report{Enter}')
    await user.type(input, 'Walk{Enter}')
    await screen.findByText('Walk')
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '0 of 2 tasks completed — 0%'))

    const box = screen.getByRole('checkbox', { name: 'Mark “Write report” complete' })
    box.focus()
    await user.keyboard(' ')
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50'))

    await user.click(screen.getByRole('checkbox', { name: 'Mark “Walk” complete' }))
    const pin = await screen.findByRole('button', { name: /Pin to My Wall/ })
    expect(screen.getByText('Everything done!')).toBeInTheDocument()

    // Adding a task after 100% withdraws the celebration — nothing is archived prematurely.
    await user.type(screen.getByRole('textbox', { name: 'Add task' }), 'One more{Enter}')
    await waitFor(() => expect(screen.queryByText('Everything done!')).not.toBeInTheDocument())
    expect(await db.archives.count()).toBe(0)
    expect(pin).not.toBeInTheDocument()
  })

  it('edits a task in the full editor', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Add task' }))
    await user.type(await screen.findByRole('textbox', { name: 'Add task' }), 'Draft{Enter}')
    await user.click(await screen.findByRole('button', { name: /^Draft, Edit task/ }))
    const title = await screen.findByLabelText('Task')
    await user.clear(title)
    await user.type(title, 'Final draft')
    await user.click(screen.getByRole('radio', { name: 'High' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Final draft')
    expect((await db.tasks.toArray())[0]).toMatchObject({ title: 'Final draft', priority: 'high' })
  })

  it('validates the editor title', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'New task' }))
    await user.click(await screen.findByRole('button', { name: 'Add task' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a task.')
  })
})
