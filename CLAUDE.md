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

Content Script (content.js)
  → Receives POP_TOAST message → renders toast in bottom-right corner
  → Sends task completion message back to Service Worker
```

### Key design points

- **Three Vite entry points** produce `popup.js`, `background.js`, and `content.js`. Configured in `vite.config.ts`.
- **`src/common/`** is shared across all contexts: `types.ts` (data models), `storage.ts` (chrome.storage wrapper), `i18n.ts` (EN/ES translations).
- **Alarm persistence:** On service worker startup, `restoreAlarms()` recreates chrome alarms from stored tasks so reminders survive browser restarts.
- **Dynamic injection:** The service worker injects `content.js`/`toast.css` on-demand if the content script isn't already loaded on the target tab. Chrome system pages (`chrome://`, `edge://`, `about://`) are skipped.
- **Pending reminder pattern:** The popup stages a reminder in `pendingReminder` storage key before attaching it to a task, allowing the form to be decoupled from task creation.

### Storage schema

```ts
chrome.storage.local = {
  tasks: Task[],          // Task has optional nested Reminder
  settings: { language: "en" | "es" },
  pendingReminder: Reminder | null   // Temporary staging from popup form
}
```

### Language support

Browser language is auto-detected on first run; user can override via dropdown in popup. Preference stored in `settings.language`. All UI strings go through `getTranslation(key, language)` from `src/common/i18n.ts`.
