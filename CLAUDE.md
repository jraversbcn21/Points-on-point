# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run build      # Build extension to dist/
npm run dev        # Development mode with Vite hot reload
npm run zip        # Build and package as points-on-point.zip
```

There is no test suite. To test manually, load the `dist/` folder as an unpacked extension in Chrome (`chrome://extensions/` → Developer mode → Load unpacked).

## Architecture

This is a **Chrome Extension (Manifest V3)** built with React + TypeScript + Vite. It has three isolated execution contexts that communicate via Chrome APIs:

```
Popup (React UI)
  → chrome.storage.local     (persist tasks)
  → chrome.alarms.create     (schedule reminder)

Service Worker (background.js)
  → chrome.alarms.onAlarm    (fires at reminder time)
  → chrome.runtime.sendMessage → Content Script
  → chrome.scripting.executeScript (injects content script on demand)
  → Reschedules recurring reminders (daily/weekly) after firing

Content Script (content.js)
  → Receives POP_TOAST message → renders toast in bottom-right corner
  → Plays notification sound via chrome.runtime.getURL (when enabled)
  → Sends task completion message back to Service Worker
```

### Key design points

- **Three Vite entry points** produce `popup.js`, `background.js`, and `content.js`. Configured in `vite.config.ts` with a `copyStaticAssets` plugin that copies `manifest.json`, `icons/`, `sounds/`, `toast.css`, and generates `popup.html` with the correct script reference.
- **`src/common/`** is shared across all contexts: `types.ts` (data models), `storage.ts` (chrome.storage wrapper), `i18n.ts` (EN/ES translations).
- **Alarm persistence:** On service worker startup, `restoreAlarms()` recreates chrome alarms from stored tasks. Completed tasks are skipped unless they have a recurring reminder. For recurring reminders whose `dueAt` is in the past, it advances to the next future interval before scheduling.
- **Dynamic injection:** The service worker injects `content.js`/`toast.css` on-demand if the content script isn't already loaded on the target tab. Chrome system pages (`chrome://`, `edge://`, `about://`) are skipped.
- **Reminder system:** Reminders can be attached to new tasks (via `pendingReminder` staging pattern) or to existing tasks (direct update). Supports one-time, daily, and weekly recurrence. The service worker reschedules recurring alarms after each firing. Recurring reminders are independent of task completion: marking a recurring task as completed does not cancel its recurrence — when the next alarm fires, the task is automatically reset to uncompleted.
- **Notification sound:** A WAV chime (`sounds/notification.wav`) plays via the content script's `Audio` API when a toast appears. Toggled on/off via `settings.soundEnabled`. The sound file is declared in `web_accessible_resources` in the manifest.
- **Inline task editing:** Double-click a task's text to edit it. Enter/blur saves, Escape cancels.
- **Drag & drop reordering:** Tasks are stored in display order (newest first by default). HTML5 drag and drop with visual drop indicators. Order persists to storage on drop.

### Storage schema

```ts
chrome.storage.local = {
  tasks: Task[],                     // Stored in display order
  settings: {
    language: "en" | "es",
    soundEnabled: boolean
  },
  pendingReminder: Reminder | null   // Staging for new task creation
}
```

### Data models

```ts
type Recurrence = 'none' | 'daily' | 'weekly'

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
  reminder?: Reminder
}

interface Reminder {
  id: string
  taskId: string
  dueAt: number        // timestamp, updated after each recurrence firing
  message?: string
  recurrence?: Recurrence
}
```

### Language support

Browser language is auto-detected on first run; user can override via compact EN/ES dropdown in popup header. Preference stored in `settings.language`. All UI strings go through `getTranslation(key, language)` from `src/common/i18n.ts`.
