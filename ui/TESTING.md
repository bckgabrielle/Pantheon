# Testing — Phase 5

Manual QA scripts to start (per the build prompt); automate with Playwright once the extension is loading real data instead of mocks.

## End-to-end scenarios

### 1. Duplicate tabs correctly flagged and shown in confirmation UI
- **Setup**: `mockProposedActions` includes `a1` — a `close_tab` proposal for `t2`, a duplicate of `t1` (same URL, older `last_accessed`).
- **Steps**: Open popup → Confirm tab.
- **Expect**: A `close_tab` card appears with an amber left border, rationale mentioning "duplicate," and only the outlined "Confirm close" button (not a filled/casual-looking accept).
- **Expect**: This card is *not* affected by "Approve non-destructive" — it must be individually confirmed or rejected.

### 2. Stale tabs correctly surfaced in digest
- **Setup**: `mockTabs` includes `t4` (RFC doc, untouched since Aug 29) and `t6` (M-Pesa statement, untouched since Sep 5).
- **Steps**: Open popup → Digest tab.
- **Expect**: Tabs are grouped by topic (Reference / Docs, Finance, etc.), and any topic containing a tab untouched 3+ days shows a "haven't been touched in 3+ days" note.

### 3. Multi-device sync lag doesn't break the UI
- **Setup**: `mockTabs` includes tabs from two different `device_id`s (`d1` MacBook Pro, `d2` Pixel 8) with different `last_accessed` recency — simulating a phone tab that hasn't synced in a while.
- **Steps**: Open Digest — confirm each tab shows its `device_name`, and no tab silently disappears or crashes the render if a field is missing.
- **Manual variant to add once real data is live**: mock a tab snapshot with a *missing* `device_name` or `last_accessed` and confirm the UI degrades gracefully (shows "Unknown device" / omits the stale badge) rather than throwing.
- **Not yet covered**: an actual delayed/partial `POST /snapshots` batch from a lagging device — needs #2's real ingestion API to test properly. Flag this as an open gap until Phase 3 wiring is live end-to-end.

### 4. Agent proposing a "bad" action doesn't silently execute
- **Setup**: `mockProposedActions` includes `a4` — a `close_tab` proposal for `t5` (a Gmail tab with an unsaved draft), carrying a `risk_note`.
- **Steps**: Open popup → Confirm tab.
- **Expect**: The card renders the `risk_note` ("Possible unsaved form data...") in a visually distinct amber callout, in addition to the normal destructive-action styling.
- **Expect**: Nothing executes until "Confirm close" is explicitly clicked — verify by checking the audit log (see below) shows no entry for `a4` until it's resolved.

## Checking outcomes via the audit log
Every resolve (approve or reject) in the Confirm tab should produce exactly one new entry in the audit log (Tab Agent icon → "Audit log ↗"). Use this to verify scenarios 1 and 4 didn't fire twice, didn't fire before the click, and recorded the right verdict.

## QA pass checklist (run before each milestone)
- [ ] `npm run build` completes with no errors
- [ ] Popup opens and shows the Confirm tab by default
- [ ] All 4 scenarios above pass
- [ ] Bulk "Approve non-destructive" never resolves a `close_tab` action
- [ ] Chat panel returns a mock answer for a flight-related query and a "not found" message for a nonsense query
- [ ] Digest panel renders without errors when `mockTabs` is edited to zero tabs (empty state)
- [ ] Audit log filters (action type, verdict, date) narrow the table correctly
- [ ] Every assumption made this milestone is appended to `INTEGRATION_CHECKLIST.md`

## Automating later (Playwright)
Once loading as a real unpacked extension is part of CI, `playwright` can launch Chromium with `--load-extension=<path>` and a persistent context to open the popup directly. Not set up yet — needs a stable dev/CI Chrome binary in this environment first. Track as a follow-up rather than blocking Phase 5 sign-off on it.
