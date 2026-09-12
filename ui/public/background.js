async function closeTab(tabId) {
  const numericId = Number(tabId)
  const tab = await chrome.tabs.get(numericId).catch(() => undefined)
  if (!tab) throw new Error(`Tab ${tabId} no longer exists`)
  await chrome.tabs.remove(numericId)
  return `closed tab ${tabId}`
}

async function groupTabs(tabIds, groupName) {
  const numericIds = tabIds.map(Number).filter(Number.isInteger)
  if (!numericIds.length) throw new Error('At least one tab is required')
  const tabs = await Promise.all(numericIds.map((id) => chrome.tabs.get(id).catch(() => undefined)))
  const existingIds = tabs.flatMap((tab) => (tab?.id === undefined ? [] : [tab.id]))
  if (!existingIds.length) throw new Error('None of the requested tabs still exist')
  const groupId = await chrome.tabs.group({ tabIds: existingIds })
  await chrome.tabGroups.update(groupId, { title: groupName || 'Tab Agent', color: 'blue' })
  return `grouped ${existingIds.length} tab${existingIds.length === 1 ? '' : 's'} as "${groupName || 'Tab Agent'}"`
}

async function bookmarkTab(tabId, folder = 'Tab Agent') {
  const numericId = Number(tabId)
  const tab = await chrome.tabs.get(numericId).catch(() => undefined)
  if (!tab?.url) throw new Error(`Tab ${tabId} no longer exists or cannot be bookmarked`)
  const tree = await chrome.bookmarks.getTree()
  const existingFolder = tree[0]?.children?.find((node) => node.title === folder)
  const parentId = existingFolder?.id ?? (await chrome.bookmarks.create({ parentId: '1', title: folder })).id
  await chrome.bookmarks.create({ parentId, title: tab.title, url: tab.url })
  return `bookmarked "${tab.title || tab.url}" to ${folder}`
}

async function executeApprovedAction(proposal) {
  switch (proposal.action) {
    case 'close_tab':
      return closeTab(proposal.target_tab_ids[0])
    case 'group_tabs':
      return groupTabs(proposal.target_tab_ids, proposal.params?.group_name)
    case 'bookmark_tab':
      return bookmarkTab(proposal.target_tab_ids[0], proposal.params?.folder)
    default:
      throw new Error(`Unknown action type: ${proposal.action}`)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'EXECUTE_ACTION') return false

  ;(async () => {
    const { proposal, verdict } = message
    const outcome = verdict === 'rejected'
      ? 'skipped (rejected by user)'
      : await executeApprovedAction(proposal)

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
  })().catch((error) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
  })

  return true
})
