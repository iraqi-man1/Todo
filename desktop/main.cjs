// DoneWall for Windows: a thin Electron shell around the same offline web app.
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const APP_DIR = path.join(__dirname, 'app')

// A private, secure scheme gives the app a stable origin, so IndexedDB (all your notes) persists
// between launches in the user's profile folder.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

// One window only: launching again just brings the existing one forward.
if (!app.requestSingleInstanceLock()) app.quit()

let win = null
const TITLEBAR = 32

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: 'DoneWall',
    backgroundColor: '#121B2B',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    // no native title bar or frame: the app's own background runs to the top edge, and Windows'
    // min / max / close buttons are overlaid in the app's colours (see preload.cjs)
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#152034', symbolColor: '#f1e6d4', height: TITLEBAR },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  win.once('ready-to-show', () => win.show())
  // links to other sites open in the normal browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault()
      if (/^https?:/.test(url)) void shell.openExternal(url)
    }
  })
  void win.loadURL('app://donewall/index.html')
}

// the page reports its theme colours so the window controls blend in
ipcMain.on('titlebar', (e, c) => {
  const w = BrowserWindow.fromWebContents(e.sender)
  if (!w || typeof c?.color !== 'string' || typeof c?.symbolColor !== 'string') return
  try {
    w.setTitleBarOverlay({ color: c.color, symbolColor: c.symbolColor, height: TITLEBAR })
  } catch {
    // platforms without an overlay simply ignore it
  }
})

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url)
    const file = path.normalize(path.join(APP_DIR, decodeURIComponent(pathname)))
    // never serve anything outside the app folder
    if (!file.startsWith(APP_DIR)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => app.quit())
