import { render } from '@testing-library/react'
import { Environment } from '@/components/environment/Environment'
import { usePrefs } from '@/store/prefs'
import { DEFAULT_PREFS } from '@/domain/types'

describe('Cozy Night environment', () => {
  it('is the default theme', () => {
    expect(DEFAULT_PREFS.theme).toBe('night')
    expect(DEFAULT_PREFS.ambientSound).toBe(false) // never plays sound unless asked
  })
  it('renders the room for the night theme and only the window elsewhere, hidden from assistive tech', () => {
    usePrefs.setState({ prefs: { ...DEFAULT_PREFS }, ready: true })
    const { container, rerender } = render(<Environment />)
    const layer = container.firstElementChild as HTMLElement
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer.className).toContain('pointer-events-none')
    expect(container.querySelector('svg')).not.toBeNull()
    usePrefs.setState({ prefs: { ...DEFAULT_PREFS, theme: 'light' } })
    rerender(<Environment />)
    // light theme: the window (and its sky) stays, the navy room does not
    expect(container.querySelector('[data-phase]')).not.toBeNull()
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    usePrefs.setState({ prefs: { ...DEFAULT_PREFS, theme: 'light', showWindow: false } })
    rerender(<Environment />)
    expect(container.firstElementChild).toBeNull()
  })
  it('can hide the window', () => {
    usePrefs.setState({ prefs: { ...DEFAULT_PREFS, showWindow: false } })
    const { container } = render(<Environment />)
    expect(container.querySelector('canvas')).toBeNull()
  })
})
