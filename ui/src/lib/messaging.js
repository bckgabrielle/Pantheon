// Bridge to the background service worker (owned by #1). The real executor
// functions (closeTab/groupTabs/bookmarkTab) live there. Until #1's messaging
// contract is finalized, this assumes a simple request/response shape:
//
//   chrome.runtime.sendMessage({ type: 'EXECUTE_ACTION', proposal, verdict })
//   -> { ok: true, outcome: string } | { ok: false, error: string }
//
// FLAG FOR #1: confirm this message `type` string and response shape match
// what background.js actually expects — this is currently my own guess,
// mirrored in this repo's own public/background.js stub so the popup has
// something real to talk to in the meantime.

const HAS_EXTENSION_RUNTIME =
  typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function'

export async function executeAction(proposal, verdict) {
  if (HAS_EXTENSION_RUNTIME) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'EXECUTE_ACTION', proposal, verdict }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message })
          return
        }
        resolve(response ?? { ok: false, error: 'No response from background worker' })
      })
    })
  }

  // Dev-mode fallback (e.g. `npm run dev` in a plain browser tab, no extension
  // context available) — mock-execute locally so the UI still works end to end.
  await new Promise((r) => setTimeout(r, 150))
  if (verdict === 'rejected') {
    return { ok: true, outcome: 'skipped (rejected by user)' }
  }
  return { ok: true, outcome: `mock-executed: ${proposal.action}` }
}
