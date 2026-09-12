import { useEffect, useMemo, useState } from 'react'
import ActionCard from './ActionCard'
import { getActions, getCurrentTabs, postActionLog } from '../lib/api'
import { executeAction } from '../lib/messaging'
import { appendAuditEntry } from '../lib/auditLog'

const DESTRUCTIVE_ACTIONS = new Set(['close_tab'])

export default function ConfirmationList() {
  const [proposals, setProposals] = useState(null) // null = loading
  const [resolutions, setResolutions] = useState({}) // { [id]: 'approved' | 'rejected' }
  const [pendingIds, setPendingIds] = useState(new Set()) // ids currently mid-flight

  useEffect(() => {
    Promise.all([getActions(), getCurrentTabs()]).then(([actions, tabs]) => {
      const tabMap = new Map(tabs.map((tab) => [tab.id, tab]))
      setProposals(actions.filter((action) => action.proposed && action.status === 'proposed').map((action) => {
        const params = action.payload?.params || action.payload || {}
        const targetIds = params.tab_ids || (params.tab_id ? [params.tab_id] : action.tab_id ? [action.tab_id] : [])
        return { id: action.id, action: action.action_type, target_tab_ids: targetIds, params, rationale: action.rationale || 'No rationale provided.', tabs: targetIds.map((id) => tabMap.get(Number(id))).filter(Boolean) }
      }))
    }).catch(() => setProposals([]))
  }, [])

  const pendingCount = useMemo(() => {
    if (!proposals) return 0
    return proposals.filter((a) => !resolutions[a.id]).length
  }, [proposals, resolutions])

  async function resolve(id, verdict) {
    const proposal = proposals.find((p) => p.id === id)
    setPendingIds((prev) => new Set(prev).add(id))
    try {
      const result = await executeAction(proposal, verdict)
      const outcome = result.ok ? result.outcome : `error: ${result.error}`
      await postActionLog({
        tab_id: proposal.tabs?.[0]?.id ?? null,
        action_type: proposal.action,
        status: verdict,
        proposed: false,
        rationale: proposal.rationale,
        payload: proposal.params,
        outcome: { result: outcome },
      })
      await appendAuditEntry({ id: `log_${Date.now()}_${id}`, timestamp: new Date().toISOString(), action: proposal.action, target_tab_ids: proposal.target_tab_ids, rationale: proposal.rationale, verdict, outcome })
      setResolutions((prev) => ({ ...prev, [id]: verdict }))
    } finally {
      setPendingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  function bulkApproveNonDestructive() {
    proposals
      .filter((a) => !resolutions[a.id] && !DESTRUCTIVE_ACTIONS.has(a.action))
      .forEach((a) => resolve(a.id, 'approved'))
  }

  function bulkReject() {
    proposals.filter((a) => !resolutions[a.id]).forEach((a) => resolve(a.id, 'rejected'))
  }

  if (proposals === null) {
    return <div className="empty-state">Loading proposed actions…</div>
  }

  if (proposals.length === 0) {
    return (
      <div className="empty-state">
        <div className="glyph">—</div>
        No proposed actions right now. Tab Agent will surface suggestions here as it reviews your open tabs.
      </div>
    )
  }

  return (
    <>
      <div className="bulk-bar">
        <span className="count">{pendingCount} pending / {proposals.length} total</span>
        <div className="buttons">
          <button className="bulk-btn" disabled={pendingCount === 0} onClick={bulkApproveNonDestructive}>
            Approve non-destructive
          </button>
          <button className="bulk-btn" disabled={pendingCount === 0} onClick={bulkReject}>
            Reject all
          </button>
        </div>
      </div>
      <div className="action-list">
        {proposals.map((proposal) => (
          <ActionCard
            key={proposal.id}
            proposal={proposal}
            resolution={resolutions[proposal.id]}
            isPending={pendingIds.has(proposal.id)}
            onResolve={resolve}
          />
        ))}
      </div>
    </>
  )
}
