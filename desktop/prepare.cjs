// Builds the web app with relative paths and copies it into desktop/app for Electron to serve.
const { execSync } = require('node:child_process')
const { cpSync, rmSync } = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const out = path.join(__dirname, 'app')
execSync(`npx vite build --base=./ --outDir "${out}" --emptyOutDir`, { cwd: root, stdio: 'inherit' })
// the service worker is for the browser PWA; the desktop app loads its files from disk
for (const f of ['sw.js', 'manifest.webmanifest']) rmSync(path.join(out, f), { force: true })
for (const f of require('node:fs').readdirSync(out)) if (/^workbox-.*\.js$/.test(f)) rmSync(path.join(out, f))
console.log('Prepared desktop app in', out)
