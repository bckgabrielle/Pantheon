import { tabById } from '../mock/mockData'

const ACTION_LABELS = {
  close_tab: 'CLOSE TAB',
  group_tabs: 'GROUP TABS',
  bookmark_tab: 'BOOKMARK',
}

const DESTRUCTIVE_ACTIONS = new Set(['close_tab'])

export default function ActionCard({ proposal, resolution, isPending, onResolve }) {
  const isDestructive = DESTRUCTIVE_ACTIONS.has(proposal.action)
  const tabs = proposal.target_tab_ids.map(tabById).filter(Boolean)
  const isResolved = Boolean(resolution)

  return (
    <div className={`action-card ${isDestructive ? 'destructive' : ''} ${isResolved ? 'resolved' : ''}`}>
      <div className="action-card-top">
        <span className="action-kind">{ACTION_LABELS[proposal.action] ?? proposal.action}</span>
      </div>

      <div className="tab-refs">
        {tabs.map((t) => (
          <div className="tab-ref" key={t.tab_id}>
            <span className="fav">{t.favicon}</span>
            <span className="title" title={t.title}>{t.title}</span>
          </div>
        ))}
      </div>

      {proposal.params?.group_name && (
        <div className="group-name-pill">→ group: "{proposal.params.group_name}"</div>
      )}
      {proposal.params?.folder && (
        <div className="folder-pill">→ bookmarks / {proposal.params.folder}</div>
      )}

      <p className="rationale">{proposal.rationale}</p>

      {proposal.risk_note && (
        <div className="risk-note">
          <span>⚠</span>
          <span>{proposal.risk_note}</span>
        </div>
      )}

      {!isResolved ? (
        <div className="action-buttons">
          <button
            className={`btn btn-accept ${isDestructive ? 'destructive-accept' : ''}`}
            disabled={isPending}
            onClick={() => onResolve(proposal.id, 'approved')}
          >
            {isPending ? 'Working…' : isDestructive ? 'Confirm close' : 'Accept'}
          </button>
          <button className="btn btn-reject" disabled={isPending} onClick={() => onResolve(proposal.id, 'rejected')}>
            Reject
          </button>
        </div>
      ) : (
        <div className={`resolution-tag ${resolution}`}>
          {resolution === 'approved' ? '✓ approved — queued for execution' : '✕ rejected'}
        </div>
      )}
    </div>
  )
}
