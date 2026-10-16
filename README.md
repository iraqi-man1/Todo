# DoneWall

*Make every day worth remembering.*

DoneWall is a cozy, offline-first to-do app. Plan your day on sticky notes; when every task is done, pin the day to a wooden achievement wall that hangs beside a rainy night window. Over time the wall becomes a visual history of your good days.

## Features

- **Today planner**: several colored notes per day, tasks with descriptions, priority, due time, category and repeat (daily, weekdays, weekly). Drag to reorder (mouse, touch or keyboard), swipe to delete with undo, and a hand-drawn check animation.
- **Pin to My Wall**: at 100% you get a quiet celebration. Nothing is archived until you choose to pin. The note flies off the planner and attaches itself to the wall, with a pushpin and a DONE stamp. Each pin is a frozen snapshot, one per date, and duplicates are impossible.
- **Wooden wall**: Day, Week, Month and Year views. Pan, pinch or wheel zoom with inertia. Search pinned tasks, filter by status, and tap a note to lift it off the wall and read it. Unfinished days stay visible, marked gently. Unfinished tasks can be carried forward to today.
- **Calendar and Statistics**: monthly calendar with swipe navigation; streaks, weekly and monthly completion, best weekday, monthly trend; achievement stamps.
- **Cozy Night environment** (default): a navy room, a framed window with moon, city lights and rain on the glass, and a warm desk lamp lighting the wall. Rain, rain intensity, ambient motion, lamp brightness, window visibility and a generated rain ambience (with its own volume) can each be changed in Settings. The window has subtle pointer parallax and a few flickering city lights, all of which stop with reduced motion or Focus Mode. Light and Dark themes are also available.
- **Quality of life**: undo/redo for task, note and pin changes (`Ctrl+Z` / `Ctrl+Shift+Z`, plus Undo on toasts). Click a task title to rename it in place. Hide completed tasks, and see a progress bar on each note. `Ctrl+K` searches every task and action, and `T` jumps to today's note. Changes save automatically, with a quiet "saved" indicator. Your wall view, filter and zoom position are remembered.
- **Wall interaction**: hold a pinned note to pick it up and nudge it within its slot. It snaps to a grid and never overlaps its neighbours; `Alt+Arrow` does the same from the keyboard, and "Reset position" restores it. Zoom controls include a live zoom level, fit-to-screen and go-to-today. Period changes slide in the direction you navigate.
- **Paper physics**: wall notes lean toward the cursor and sway on their pins as you pass. Carried notes tilt with the drag speed, cast a growing shadow, and settle back with a soft overshoot. Planner notes lift with light and shadow only, so text stays crisp.
- **Completion moments**: checking a task bounces the checkbox, draws the check and strikethrough, and throws a few warm sparkles, with an optional pencil sound. Finishing the last task of the day, and only that transition, brings a golden glow, a green *Completed* stamp and a gentle lift. Pinning flies the note toward the wall, where the pin presses in and the paper swings to rest. Esc or a click skips it.
- **Page-turn months**: the wooden board stays put while the old page folds away and the new month's notes settle in one by one.
- **Wallpapers** (Settings → Wallpapers): upload JPG, PNG or WebP, preview it, drag to position, zoom to crop, and choose Fill, Fit or Center. Use it for the whole workspace and/or as the window scenery; the frame and rain stay. Brightness, blur, opacity, overlay and parallax can be adjusted. Images are downscaled, de-duplicated and stored locally (offline); damaged or missing images fall back to the original scene.
- **Motion & Effects**: animation intensity (Off/Subtle/Lively), reduced motion (follows your device by default), note physics, completion effects, end-of-day celebration, window parallax and sounds, all remembered.
- **Steps (subtasks)**: break a task into steps in the editor. Tick them right on the note; a small progress bar fills as you go, and finishing the last step completes the task (undoable).
- **Big goals**: a Goals board on the wall holds index cards for long-term goals. Link daily tasks to a goal in the editor; a brass progress rail fills against a target count (or all linked tasks), with an optional due date and an *Achieved* stamp when you get there.
- **Mood of the day**: pick one of five faces under today's progress. It shows as a sticker on the wall note and in the calendar, and Statistics compares your mood with how much you got done.
- **Pins & stamps collection**: achievements unlock new pins (gold, copper, crystal, star, heart) and DONE stamps (star, laurel, heart, moon). Choose them in Statistics → Pins & stamps, or keep a random mix of pins.
- **Seasons, weather and sky**: the window follows the time of day (dawn, day, dusk, night) and the season: snow and snow-capped roofs in winter, rain in spring, clear summer skies, falling leaves in autumn. Weather and sky can be fixed in Settings → Environment. The window also appears in the Light and Dark themes, and the optional ambience follows the weather.
- **Print the wall**: the printer button on My Wall prints the board you are looking at (day, week, month, year, heatmap or goals) as a landscape poster on A4 or A3, with a title and footer.
- **Smart quick add**: type “call Ahmed tomorrow 9am”, “report friday at 3 !” or, in Arabic, “اتصل بأحمد باچر 9 الصبح”. A live preview shows the date, time and urgency DoneWall understood, and tasks for another day go straight to that day.
- **Welcome tour**: three short steps for first-time users (write a task, finish the day, pin it), ending in today's note ready to type. It can be replayed from Settings → About.
- **Year heatmap**: switch the Year view between pinned notes and a heatmap in wood tones, darker for days you finished. Pinned days carry a brass dot.
- **Settings search**: a search field and section shortcuts at the top of Settings.
- **Haptics**: a light vibration on supported phones when you check a task, finish the day or pin a note (can be turned off).
- **Task Shelf**: a personal library of reusable tasks, opened with the bookmark beside any note's "Add a task" field (or "From Task Shelf" on an empty day). Search instantly, save new tasks, tick several and add them together, or tap + to add one. Saved tasks can be renamed, deleted (with confirmation and undo) and reordered, and sorted by your own order or by recent use. Save any existing task with its bookmark. Added tasks are independent, incomplete copies: completing or editing them never touches the template or other days, and a task already on the note isn't added twice. Nothing repeats on its own. The shelf works offline and is included in backups.
- **Focus Mode** (`F`): calms the room, dims the interface, highlights your current note and pins your notes onto the wood.
- **Personalization**: three wood themes, default note color, animation level (follows `prefers-reduced-motion`), optional sounds (off by default), English and Arabic (RTL), first weekday, date format, and daily reminders where the browser supports them.
- **Your data stays local**: stored in IndexedDB on your device. Export and import JSON backups with merge or replace. If storage is unavailable, the app falls back to in-memory storage and tells you.
- **PWA**: installable on Android, iOS and desktop, and works fully offline. Updates ask before reloading and never touch your data.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest + React Testing Library
npm run build      # typecheck + production build (with service worker)
npm run preview
```

`node scripts/shots.mjs <outDir>` seeds sample history in the dev server and takes mobile and desktop screenshots (dev only).

## Architecture

| Path | Purpose |
| --- | --- |
| `src/domain` | Pure business logic: types, summaries, stats and streaks, achievements, actions (Dexie mutations), the Task Shelf, backup |
| `src/db` | Dexie schema (versioned for migrations) and storage fallback |
| `src/store` | Zustand: UI state (routing, wall view, editor) and the preferences mirror |
| `src/hooks` | Live queries, date rollover at midnight, motion level, shortcuts, reminders, ambience |
| `src/components` | `today/`, `wall/`, `calendar/`, `stats/`, `settings/`, `environment/`, `paper/`, `ui/` |
| `src/lib` | Dates, i18n, procedural wood and paper textures, synthesized sounds |

Dates are stored as local calendar keys (`yyyy-MM-dd`), so midnight and time zone changes never move a day. Wood grain, paper fibre, rain and sounds are generated at runtime, so there are no heavy assets.

### Keyboard shortcuts

`1`–`5` sections · `N` new task · `T` today's note · `Ctrl+K` search everything · `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo · `/` search the wall · `F` focus mode · `Alt+Arrows` nudge a focused wall note · `+` / `−` / `0` / arrows: zoom, reset and pan the wall · `?` help
