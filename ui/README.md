# Tab Agent — Popup UI (Role #4: UX/Integration)

All 5 phases from the build prompt, built against mocked contracts from #1/#2/#3. See `INTEGRATION_CHECKLIST.md` for every assumption made — flag those in async check-in before treating any of this as final. See `TESTING.md` for QA scenarios and the pre-milestone checklist.

## Run it

```bash
npm install
npm run dev       # local dev server — good for iterating on the UI in a browser tab
npm run build     # produces dist/ for loading as an actual extension
```

## Load as an unpacked extension

1. `npm run build`
2. Add three placeholder PNG icons (16/48/128px) to `dist/` as `icon16.png`, `icon48.png`, `icon128.png` — referenced by `manifest.json` but not included here.
3. Go to `chrome://extensions`, enable Developer mode, click "Load unpacked," select the `dist/` folder.
4. Pin the extension and click it to open the popup. Click "Audit log ↗" in the popup header to open the dashboard as its own tab.

## What's here

- **Phase 1 — Confirmation UI**: `src/components/ConfirmationList.jsx` + `ActionCard.jsx`. Bulk approve/reject, with destructive actions (`close_tab`) always requiring an individual confirm click.
- **Phase 2 — Chat / Digest**: `src/components/ChatPanel.jsx` (keyword-matched mock Q&A over open tabs) and `DigestPanel.jsx` (topic-clustered stale-tab summary, via `src/lib/cluster.js`). Toggle between Confirm / Chat / Digest in the popup header.
- **Phase 3 — End-to-end wiring**: `src/lib/api.js` (mock backend calls matching #2's contract shape), `src/lib/messaging.js` + `public/background.js` (message-passing to a stub service worker standing in for #1's real executors). Swap `USE_MOCK` in `api.js` and replace `background.js`'s stub logic once the real pieces exist.
- **Phase 4 — Audit dashboard**: `audit.html` / `src/audit/`. A separate extension page (not the popup, since popups close on blur) listing every approve/reject with filters by action type, verdict, and date. Reads from `chrome.storage.local` via `src/lib/auditLog.js`.
- **Phase 5 — Testing**: `TESTING.md` — four end-to-end scenarios (duplicates, staleness, multi-device lag, a "bad" agent proposal) plus a pre-milestone QA checklist.

## Biggest open items for #1/#2/#3 (full list in `INTEGRATION_CHECKLIST.md`)

- `background.js`'s message shape (`EXECUTE_ACTION` / `{ ok, outcome }`) is my own guess — needs #1's sign-off or replacement.
- The proposed-action schema needs a `risk_note` field added for the "bad action" scenario, and an `id` field for UI state tracking — currently assumed, not confirmed with #3.
- Audit log currently lives in `chrome.storage.local`, not on #2's backend — needs reconciling with wherever `POST /actions` ends up living.
