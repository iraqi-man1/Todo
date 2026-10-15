# DoneWall

*Make every day worth remembering.*

DoneWall is a cozy, offline-first to-do app. Plan your day on sticky notes; when every task is done, pin the day to a wooden achievement wall that hangs beside a rainy night window. Over time the wall becomes a visual history of your good days.

## Features

- **Today planner**: several colored notes per day, tasks with descriptions, priority, due time, category and repeat (daily, weekdays, weekly). Drag to reorder (mouse, touch or keyboard), swipe to delete with undo, and a hand-drawn check animation.
- **Pin to My Wall**: at 100% you get a quiet celebration. Nothing is archived until you choose to pin. The note flies off the planner and attaches itself to the wall, with a pushpin and a DONE stamp. Each pin is a frozen snapshot, one per date, and duplicates are impossible.
- **Wooden wall**: Day, Week, Month and Year views. Pan, pinch or wheel zoom with inertia. Search pinned tasks, filter by status, and tap a note to lift it off the wall and read it. Unfinished days stay visible, marked gently. Unfinished tasks can be carried forward to today.
- **Calendar and Statistics**: monthly calendar with swipe navigation; streaks, weekly and monthly completion, best weekday, monthly trend; achievement stamps.
- **Cozy Night environment** (default): a navy room, a framed window with moon, city lights and rain on the glass, and a warm desk lamp lighting the wall. Rain, rain intensity, ambient motion, lamp brightness, window visibility and a generated rain ambience can each be changed in Settings. Light and Dark themes are also available.
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
| `src/domain` | Pure business logic: types, summaries, stats and streaks, achievements, actions (Dexie mutations), backup |
| `src/db` | Dexie schema (versioned for migrations) and storage fallback |
| `src/store` | Zustand: UI state (routing, wall view, editor) and the preferences mirror |
| `src/hooks` | Live queries, date rollover at midnight, motion level, shortcuts, reminders, ambience |
| `src/components` | `today/`, `wall/`, `calendar/`, `stats/`, `settings/`, `environment/`, `paper/`, `ui/` |
| `src/lib` | Dates, i18n, procedural wood and paper textures, synthesized sounds |

Dates are stored as local calendar keys (`yyyy-MM-dd`), so midnight and time zone changes never move a day. Wood grain, paper fibre, rain and sounds are generated at runtime, so there are no heavy assets.

### Keyboard shortcuts

`1`–`5` sections · `N` new task · `/` search the wall · `F` focus mode · `+` / `−` / `0` / arrows: zoom, reset and pan the wall · `?` help
