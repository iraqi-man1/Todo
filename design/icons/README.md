# DoneWall icon

A DONE stamp pressed onto paper: the app's own stamp, as its mark.

- `icon.svg`: the full stamp (rings, "DONE ✦ DONEWALL" lettering, check, uneven ink). Used from 64px up.
- `icon-small.svg`: drawn for 16–48px (no lettering, bolder strokes). Also used for `public/favicon.svg` and the in-app logo.
- `icon-square.svg`: full-bleed version for the iPhone home screen (iOS rounds the corners itself).
- `icon-maskable.svg`: full-bleed version with the stamp inside Android's 80% safe zone.

`public/*.png`, `public/favicon.ico`, `desktop/build/icon.png` and `desktop/build/icon.ico` are rendered from these files. Each size in the .ico files is its own drawing, not a downscale.
