// STUB — real implementation owned by #1 (Extension/Capture Engineer).
// This exists only so Role #4's popup has a real message-passing partner
// during development. Replace the body of the EXECUTE_ACTION handler with
// #1's actual executors (closeTab/groupTabs/bookmarkTab) once ready — the
// message shape below is what the popup currently sends; confirm/adjust with #1.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'EXECUTE_ACTION') return false

  const { proposal, verdict } = message

  ;(async () => {
    let outcome

    if (verdict === 'rejected') {
      outcome = 'skipped (rejected by user)'
    } else {
      // TODO(#1): replace with real chrome.tabs / chrome.tabGroups / chrome.bookmarks calls
      switch (proposal.action) {
        case 'close_tab':
          outcome = `[stub] would close tab(s): ${proposal.target_tab_ids.join(', ')}`
          break
        case 'group_tabs':
          outcome = `[stub] would group tab(s) into "${proposal.params?.group_name ?? 'Untitled'}"`
          break
        case 'bookmark_tab':
          outcome = `[stub] would bookmark tab(s) into "${proposal.params?.folder ?? 'Uncategorized'}"`
          break
        default:
          outcome = `[stub] unknown action type: ${proposal.action}`
      }
    }

    // Append to the same audit log the audit dashboard reads from.
    const { tabAgentAuditLog: log = [] } = await chrome.storage.local.get('tabAgentAuditLog')
    const entry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: proposal.action,
      target_tab_ids: proposal.target_tab_ids,
      rationale: proposal.rationale,
      verdict,
      outcome,
    }
    await chrome.storage.local.set({ tabAgentAuditLog: [entry, ...log] })

    sendResponse({ ok: true, outcome })
  })()

  return true // keep the message channel open for the async sendResponse
})
