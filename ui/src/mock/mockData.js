// Mock data matching the three contracts from the build prompt.
// Swap these for real fetch()/message-passing calls once #1/#2/#3 ship.

// Shape owned by #1 (Extension/Capture Engineer)
export const mockTabs = [
  { tab_id: 't1', title: 'Flights: NBO → JNB — Kenya Airways', url: 'https://www.kenya-airways.com/booking/12345', favicon: '✈️', device_id: 'd1', device_name: 'MacBook Pro', last_accessed: '2026-09-12T08:10:00Z', window_id: 'w1' },
  { tab_id: 't2', title: 'Flights: NBO → JNB — Kenya Airways', url: 'https://www.kenya-airways.com/booking/12345', favicon: '✈️', device_id: 'd1', device_name: 'MacBook Pro', last_accessed: '2026-09-11T19:42:00Z', window_id: 'w1' },
  { tab_id: 't3', title: 'Hotels in Johannesburg — booking.com', url: 'https://www.booking.com/searchresults.html?city=jhb', favicon: '🏨', device_id: 'd2', device_name: 'Pixel 8', last_accessed: '2026-09-10T14:05:00Z', window_id: 'w2' },
  { tab_id: 't4', title: 'RFC 9110: HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110', favicon: '📄', device_id: 'd1', device_name: 'MacBook Pro', last_accessed: '2026-08-29T11:00:00Z', window_id: 'w1' },
  { tab_id: 't5', title: 'Gmail — Draft: Grant proposal follow-up', url: 'https://mail.google.com/mail/u/0/#drafts/abc123', favicon: '✉️', device_id: 'd1', device_name: 'MacBook Pro', last_accessed: '2026-09-12T09:55:00Z', window_id: 'w1' },
  { tab_id: 't6', title: 'M-Pesa Statement — September', url: 'https://portal.safaricom.co.ke/statements/sept', favicon: '💳', device_id: 'd2', device_name: 'Pixel 8', last_accessed: '2026-09-05T07:20:00Z', window_id: 'w2' },
]

// Shape owned by #3 (Agent/Tools Engineer): proposed-action objects
export const mockProposedActions = [
  {
    id: 'a1',
    action: 'close_tab',
    target_tab_ids: ['t2'],
    params: {},
    rationale: 'Exact duplicate of another open tab (same URL, same booking) — the newer tab (t1) was accessed more recently.',
    requires_confirmation: true,
  },
  {
    id: 'a2',
    action: 'group_tabs',
    target_tab_ids: ['t1', 't3'],
    params: { group_name: 'JNB trip' },
    rationale: 'Both tabs relate to the same upcoming Johannesburg trip — flight booking and hotel search.',
    requires_confirmation: true,
  },
  {
    id: 'a3',
    action: 'bookmark_tab',
    target_tab_ids: ['t4'],
    params: { folder: 'Reference' },
    rationale: 'Untouched for 14 days and matches your "Reference" bookmarking pattern for spec documents.',
    requires_confirmation: true,
  },
  {
    id: 'a4',
    action: 'close_tab',
    target_tab_ids: ['t5'],
    params: {},
    rationale: 'Idle for a while, but this tab has an unsaved Gmail draft — flagging rather than auto-closing.',
    requires_confirmation: true,
    risk_note: 'Possible unsaved form data. Recommend reviewing before closing.',
  },
]

export function tabById(id) {
  return mockTabs.find((t) => t.tab_id === id)
}

// Seed data for the audit dashboard (dev-mode fallback in lib/auditLog.js,
// and a realistic starting point for #2's eventual POST /actions log).
export const mockAuditLog = [
  {
    id: 'log_1',
    timestamp: '2026-09-11T22:14:00Z',
    action: 'close_tab',
    target_tab_ids: ['t2'],
    rationale: 'Exact duplicate URL, older of the two by access time.',
    verdict: 'approved',
    outcome: 'closed',
  },
  {
    id: 'log_2',
    timestamp: '2026-09-11T22:14:05Z',
    action: 'bookmark_tab',
    target_tab_ids: ['t4'],
    rationale: 'Untouched for 14 days, matches "Reference" bookmarking pattern.',
    verdict: 'approved',
    outcome: 'bookmarked to /Reference',
  },
  {
    id: 'log_3',
    timestamp: '2026-09-10T09:02:00Z',
    action: 'close_tab',
    target_tab_ids: ['t6'],
    rationale: 'Idle 7 days, no repeat visits.',
    verdict: 'rejected',
    outcome: 'skipped (rejected by user)',
  },
  {
    id: 'log_4',
    timestamp: '2026-09-09T18:40:00Z',
    action: 'group_tabs',
    target_tab_ids: ['t1', 't3'],
    rationale: 'Both tabs relate to the same upcoming trip.',
    verdict: 'approved',
    outcome: 'grouped as "JNB trip"',
  },
]

