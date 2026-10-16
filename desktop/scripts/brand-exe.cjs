// Gives DoneWall.exe its own icon and version details (what Explorer, the taskbar and
// Task Manager show). Pure JavaScript, so it works on Linux without Wine.
const fs = require('node:fs')
const path = require('node:path')
const ResEdit = require('resedit')
const PE = require('pe-library')

const pkg = require('../package.json')
const exe = path.resolve(process.argv[2] ?? path.join(__dirname, '..', 'release', 'win-unpacked', 'DoneWall.exe'))
const ico = path.join(__dirname, '..', 'build', 'icon.ico')

// drop Electron's original signature: it no longer matches once resources change
const bin = PE.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true })
const res = PE.NtExecutableResource.from(bin)

// replace every icon group (the app icon and any others) with DoneWall's
const icons = ResEdit.Data.IconFile.from(fs.readFileSync(ico)).icons.map((i) => i.data)
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
if (!groups.length) throw new Error('No icon group found in ' + exe)
for (const g of groups) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, icons)

const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
const [maj, min, patch] = pkg.version.split('.').map(Number)
const langs = vi.getAllLanguagesForStringValues()
for (const lang of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) {
  vi.setStringValues(lang, {
    ProductName: 'DoneWall',
    FileDescription: 'DoneWall',
    CompanyName: 'DoneWall',
    LegalCopyright: `© ${new Date().getFullYear()} DoneWall`,
    OriginalFilename: 'DoneWall.exe',
    InternalName: 'DoneWall',
    ProductVersion: pkg.version,
    FileVersion: pkg.version,
  })
}
vi.setFileVersion(maj, min, patch, 0, 1033)
vi.setProductVersion(maj, min, patch, 0, 1033)
vi.outputToResourceEntries(res.entries)

res.outputResource(bin)
fs.writeFileSync(exe, Buffer.from(bin.generate()))
console.log(`Branded ${path.basename(exe)}: ${groups.length} icon group(s), version ${pkg.version}`)
