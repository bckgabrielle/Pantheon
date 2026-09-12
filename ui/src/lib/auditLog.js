// Reads/writes the audit log. Prefers chrome.storage.local (persists across
// popup opens/closes, which is the point of an audit trail); falls back to an
// in-memory array when running outside an extension context (`npm run dev`).
//
// Real shape once #2's `POST /actions` / log storage exists: swap the two
// functions below to call lib/api.js instead of chrome.storage.

import { mockAuditLog } from '../mock/mockData'

const HAS_STORAGE = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
const STORAGE_KEY = 'tabAgentAuditLog'

let memoryLog = null // lazily seeded with mock entries on first read, dev-mode only
export async function getAuditLog() {
  if (HAS_STORAGE) {
    const { [STORAGE_KEY]: log } = await chrome.storage.local.get(STORAGE_KEY)
    return log ?? []
  }
  if (memoryLog === null) memoryLog = [...mockAuditLog]
  return memoryLog
}

export async function appendAuditEntry(entry) {
  const current = await getAuditLog()
  const next = [entry, ...current] // newest first

  if (HAS_STORAGE) {
    await chrome.storage.local.set({ [STORAGE_KEY]: next })
  } else {
    memoryLog = next
  }
  return next
}
