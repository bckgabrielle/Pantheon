# Tab Agent - Popup UI (Role #4: UX/Integration)

All 5 phases from the build prompt are wired into the broader Pantheon stack. See `INTEGRATION_CHECKLIST.md` for integration assumptions and `TESTING.md` for QA scenarios.

## Run It

```bash
npm install
npm run dev
npm run build
```

By default the UI talks to the real local services:

```env
VITE_AGENT_BASE_URL=http://localhost:8000
VITE_BACKEND_BASE_URL=http://localhost:8001
VITE_PANTHEON_API_KEY=replace-with-a-long-random-secret
VITE_BACKEND_USER_ID=default
VITE_USE_MOCK=false
```

Set `VITE_USE_MOCK=true` only when you want the UI to run entirely from local mock data.

## Load As An Unpacked Extension

1. `npm run build`
2. Add three placeholder PNG icons (16/48/128px) to `dist/` as `icon16.png`, `icon48.png`, `icon128.png` - referenced by `manifest.json` but not included here.
3. Go to `chrome://extensions`, enable Developer mode, click "Load unpacked," select the `dist/` folder.
4. Pin the extension and click it to open the popup. Click "Audit log" in the popup header to open the dashboard as its own tab.

## What's Here

- **Phase 1 - Confirmation UI**: `src/components/ConfirmationList.jsx` + `ActionCard.jsx`. Bulk approve/reject, with destructive actions (`close_tab`) always requiring an individual confirm click.
- **Phase 2 - Chat / Digest**: `src/components/ChatPanel.jsx` calls `/agent/run`; `DigestPanel.jsx` summarizes topic-clustered stale tabs.
- **Phase 3 - End-to-end wiring**: `src/lib/api.js` stores connection settings, calls the Pantheon backend and Python agent service, and adapts `Plan.actions` into UI proposal cards.
- **Phase 4 - Audit dashboard**: `audit.html` / `src/audit/` lists approve/reject history using the backend action log plus local extension storage.
- **Phase 5 - Testing**: `TESTING.md` covers duplicates, staleness, multi-device lag, and a bad proposal scenario.

## Integration Notes

- Proposed model actions remain confirmation-gated. The Python service only proposes `close_tab`, `group_tabs`, and `bookmark_tab`; the extension service worker executes browser actions only after an approved UI verdict.
- Audit log writes remain in `chrome.storage.local` for extension usability and are also best-effort posted to Pantheon's `POST /actions`.
- The browser-exposed `VITE_PANTHEON_API_KEY` is acceptable for local/demo testing only. Production should replace it with a safer auth flow or gateway.
