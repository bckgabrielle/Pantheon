# Integration Checklist — assumptions made while building against mocks

Running log of every assumption baked into the Phase 1 build, to flag back to #1/#2/#3 in async check-in. Update this file every phase, don't rewrite history — append.

## Phase 1 — Confirmation UI

**Assumptions about #1's tab snapshot schema:**
- `favicon` is treated as a displayable string (mocked as an emoji glyph). If it's actually a favicon URL, `ActionCard.jsx`'s `<span className="fav">` needs to become an `<img>` with a fallback for missing/broken favicons.
- No `tab_group_id` or existing-group field is in the published schema — assumed a tab isn't already in a browser-native tab group when the agent proposes `group_tabs`. Need to confirm how #1's executor handles "add to existing group" vs. "create new group."

**Assumptions about #3's proposed-action schema:**
- Added an optional `risk_note` field (not in the original contract) to support the "agent proposes a bad action" QA scenario from Phase 5 — e.g. flagging a tab with an unsaved form. **This needs to be added to the real schema by #3**, or the UI has nothing to render for that case.
- Assumed `requires_confirmation: false` (if it ever appears) means the action is informational and shouldn't render a card in this list at all — not yet handled, since all mock data has it `true`.
- Assumed `id` is present on every proposed-action object for React keys / resolution tracking — not explicitly in the published shape, needs confirming with #3.
- Destructive-vs-not is currently a hardcoded set (`{'close_tab'}`) on the UI side. If #3's agent ever tags actions with a severity/risk level itself, that should replace this local guess.

**Bulk-approve behavior (my own product decision, flagging for visibility):**
- "Approve non-destructive" bulk button intentionally excludes `close_tab` — those always require an individual per-item click, per the "keep copy honest about risk" constraint. Confirm this matches what #1's executor expects to receive (i.e., it should never receive a bulk-approved `close_tab`).

## Not yet wired (expected — later phases)
- No connection to background service worker / message-passing (Phase 3).
- No real `GET /tabs/current`, `/tabs/history`, `/tabs/duplicates` calls (Phase 3, needs #2's live API).
- No real executor calls on "Confirm close" — currently just flips local UI state (Phase 3, needs #1).

## Phase 3 — end-to-end wiring

**Message contract with #1 (my own stub, needs confirming):**
- `public/background.js` is a **stub I wrote standing in for #1's real service worker**, not a real implementation. It listens for `{ type: 'EXECUTE_ACTION', proposal, verdict }` and responds `{ ok, outcome }`. **#1 needs to confirm or replace this message shape** — I picked it, it isn't from a published contract.
- Real executors (`closeTab`, `groupTabs`, `bookmarkTab`) are only logged as `[stub] would ...` strings right now, not actually called against `chrome.tabs`/`chrome.tabGroups`/`chrome.bookmarks`.
- `src/lib/messaging.js` falls back to a local mock executor when `chrome.runtime` isn't available (e.g. `npm run dev` outside an extension context) — this fallback should never fire once loaded as a real unpacked extension; if it does, something's wrong with the manifest's service worker registration.

**Backend contract with #2 (`src/lib/api.js`):**
- Added an endpoint that isn't in the original published list: `GET /actions/proposed` (assumed shape) for fetching #3's proposed actions. **Needs confirming with #3** — the original doc only specified #2 owns tab/snapshot endpoints and #3 owns the agent loop, but didn't say where the popup should fetch *proposed actions* from at runtime.
- `POST /actions` (audit log) is called via `postActionLog()` in the mock path, but the real wiring currently writes to `chrome.storage.local` instead (see below) — these two need to be reconciled once #2's endpoint exists, probably by having the background worker call `POST /actions` after execution rather than (or in addition to) local storage.

## Phase 4 — observability/audit dashboard

- Audit entries are stored in `chrome.storage.local` under the key `tabAgentAuditLog`, not on #2's backend. This was a deliberate choice so the dashboard works before #2's log-storage endpoint exists, but it means **the log is currently per-browser-profile, not centralized** — flag this if a multi-device audit view is expected later (the build prompt's "observability dashboard" doesn't specify whether the log needs to be cross-device).
- `audit.html` is a separate extension page (opened via `chrome.tabs.create`), not part of the popup — popups close on blur, which doesn't suit a page you want to leave open and filter.

## Integrated Python stack update

- `src/lib/api.js` now defaults to real services instead of mocks: `POST /agent/run` on the agent service and `/tabs/*` plus `/actions` on the Pantheon backend.
- `Plan.actions` from #3 are adapted locally into UI proposals: `action_id -> id`, `type -> action`, `reason -> rationale`, and `params.tab_id` / `params.tab_ids -> target_tab_ids`.
- `public/background.js` now calls real Chrome APIs after an explicit approved verdict. Rejected actions are never executed.
- `VITE_USE_MOCK=true` keeps the old mocked behavior available for isolated UI work.
- Browser-exposed `VITE_PANTHEON_API_KEY` is suitable for local/demo wiring only. Production should put a narrow UI gateway or extension-mediated auth in front of privileged backend APIs.
