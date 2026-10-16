// Runs before the page (isolated from it). Marks the page as the Windows app, and keeps the
// window-controls overlay (min / max / close) painted in the current theme's colours.
const { ipcRenderer } = require('electron')

function luminance(rgb) {
  const m = rgb.match(/\d+(\.\d+)?/g)
  if (!m) return 0
  const [r, g, b] = m.map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function sync() {
  const root = document.documentElement
  const css = getComputedStyle(root)
  // the colour behind the controls: the theme's title-bar tone, else its page background
  const probe = document.createElement('span')
  probe.style.color = (css.getPropertyValue('--dw-titlebar') || css.getPropertyValue('--dw-bg') || '#121B2B').trim()
  root.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  const light = luminance(color) > 0.55
  ipcRenderer.send('titlebar', { color, symbolColor: light ? '#302c28' : '#f1e6d4' })
}

window.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement
  root.dataset.desktop = 'windows'
  sync()
  // theme switches change classes on <html>; follow them
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
})
