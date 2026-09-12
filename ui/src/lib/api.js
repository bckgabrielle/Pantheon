// Stands in for #2's backend API contract:
//   GET /tabs/current
//   GET /tabs/history?since=X
//   GET /tabs/duplicates
//   POST /actions   (audit log)
//
// Swap USE_MOCK to false and point BASE_URL at the real backend once #2 ships.
// Every function below keeps the same signature either way, so callers never change.

import { mockTabs, mockProposedActions } from '../mock/mockData'

export const USE_MOCK = true
export const BASE_URL = 'http://localhost:8000' // #2's backend, once live

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getCurrentTabs() {
  if (USE_MOCK) {
    await delay()
    return mockTabs
  }
  const res = await fetch(`${BASE_URL}/tabs/current`)
  if (!res.ok) throw new Error(`GET /tabs/current failed: ${res.status}`)
  return res.json()
}

export async function getTabHistory(sinceIso) {
  if (USE_MOCK) {
    await delay()
    // mock: pretend everything older than `sinceIso` is "history"
    return mockTabs.filter((t) => !sinceIso || t.last_accessed < sinceIso)
  }
  const res = await fetch(`${BASE_URL}/tabs/history?since=${encodeURIComponent(sinceIso)}`)
  if (!res.ok) throw new Error(`GET /tabs/history failed: ${res.status}`)
  return res.json()
}

export async function getDuplicates() {
  if (USE_MOCK) {
    await delay()
    // mock: group by URL, return groups with >1 tab
    const byUrl = {}
    mockTabs.forEach((t) => {
      byUrl[t.url] = byUrl[t.url] || []
      byUrl[t.url].push(t)
    })
    return Object.values(byUrl).filter((group) => group.length > 1)
  }
  const res = await fetch(`${BASE_URL}/tabs/duplicates`)
  if (!res.ok) throw new Error(`GET /tabs/duplicates failed: ${res.status}`)
  return res.json()
}

export async function getProposedActions() {
  if (USE_MOCK) {
    await delay()
    return mockProposedActions
  }
  // Real endpoint TBD — #3 owns the agent loop that produces these.
  // Assumed shape: GET /actions/proposed — CONFIRM with #3, not yet in the published contract.
  const res = await fetch(`${BASE_URL}/actions/proposed`)
  if (!res.ok) throw new Error(`GET /actions/proposed failed: ${res.status}`)
  return res.json()
}

// Audit log — POST /actions is owned by #2 (per the build prompt's Phase 4 note).
// Until it's live, log entries just get appended to chrome.storage.local (see lib/auditLog.js).
export async function postActionLog(entry) {
  if (USE_MOCK) {
    await delay(80)
    return { ok: true, entry }
  }
  const res = await fetch(`${BASE_URL}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error(`POST /actions failed: ${res.status}`)
  return res.json()
}
