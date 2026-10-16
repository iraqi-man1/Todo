// Full Windows build on any OS: app files → unpacked Electron app → branded DoneWall.exe →
// portable .exe and installer (makensis). No Wine needed.
const { execFileSync, execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const dir = path.join(__dirname, '..')
const run = (cmd) => execSync(cmd, { cwd: dir, stdio: 'inherit' })
const version = require('../package.json').version

run('node prepare.cjs')
run('npx electron-builder --win dir --x64 --publish never')
run('node scripts/brand-exe.cjs')
// the portable build reuses the branded app instead of repacking Electron
run('npx electron-builder --win portable --x64 --prepackaged release/win-unpacked --publish never')

/** makensis: the system one, or the copy electron-builder keeps in its cache. */
function findMakensis() {
  try {
    execSync('makensis -VERSION', { stdio: 'ignore' })
    return { bin: 'makensis', env: process.env }
  } catch {}
  const cache = process.env.ELECTRON_BUILDER_CACHE ?? path.join(os.homedir(), process.platform === 'win32' ? 'AppData/Local/electron-builder/Cache' : '.cache/electron-builder')
  for (const v of fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('nsis-') && !d.includes('resources')) : []) {
    const base = path.join(cache, v)
    for (const sub of fs.readdirSync(base)) {
      const root = path.join(base, sub)
      const bin = process.platform === 'win32' ? path.join(root, 'makensis.exe') : path.join(root, process.platform === 'darwin' ? 'mac' : 'linux', 'makensis')
      if (fs.existsSync(bin)) return { bin, env: { ...process.env, NSISDIR: root } }
    }
  }
  throw new Error('makensis not found: install NSIS or run electron-builder once with an NSIS target')
}

const { bin, env } = findMakensis()
fs.chmodSync(bin, 0o755)
execFileSync(bin, [`-DVERSION=${version}`, '-V2', 'installer.nsi'], { cwd: path.join(dir, 'installer'), stdio: 'inherit', env })
for (const f of fs.readdirSync(path.join(dir, 'release')).filter((f) => f.endsWith('.exe'))) {
  console.log(`  ${f}  ${(fs.statSync(path.join(dir, 'release', f)).size / 1048576).toFixed(1)} MB`)
}
