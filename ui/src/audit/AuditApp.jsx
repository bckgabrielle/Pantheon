import { useEffect, useMemo, useState } from 'react'
import { getAuditLog } from '../lib/auditLog'
import { tabById } from '../mock/mockData'

const ACTION_TYPES = ['close_tab', 'group_tabs', 'bookmark_tab']

export default function AuditApp() {
  const [log, setLog] = useState(null)
  const [actionFilter, setActionFilter] = useState('all')
  const [verdictFilter, setVerdictFilter] = useState('all')
  const [sinceDate, setSinceDate] = useState('')

  useEffect(() => {
    getAuditLog().then(setLog)
  }, [])

  const filtered = useMemo(() => {
    if (!log) return []
    return log.filter((entry) => {
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false
      if (verdictFilter !== 'all' && entry.verdict !== verdictFilter) return false
      if (sinceDate && new Date(entry.timestamp) < new Date(sinceDate)) return false
      return true
    })
  }, [log, actionFilter, verdictFilter, sinceDate])

  return (
    <div className="audit-page">
      <header className="audit-header">
        <h1 className="app-title"><span className="dot" /> Tab Agent — Audit Log</h1>
        <p className="app-subtitle">What the agent decided, when, why, and whether you approved it.</p>
      </header>

      <div className="audit-filters">
        <label>
          Action
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">All</option>
            {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Verdict
          <select value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>
          Since
          <input type="date" value={sinceDate} onChange={(e) => setSinceDate(e.target.value)} />
        </label>
        <span className="audit-count">{filtered.length} of {log?.length ?? 0} entries</span>
      </div>

      {log === null ? (
        <div className="empty-state">Loading audit log…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No entries match these filters.</div>
      ) : (
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Tab(s)</th>
              <th>Rationale</th>
              <th>Verdict</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id}>
                <td className="mono">{new Date(entry.timestamp).toLocaleString()}</td>
                <td className="mono">{entry.action}</td>
                <td>
                  {entry.target_tab_ids.map((id) => tabById(id)?.title ?? id).join(', ')}
                </td>
                <td className="rationale-cell">{entry.rationale}</td>
                <td>
                  <span className={`verdict-pill ${entry.verdict}`}>{entry.verdict}</span>
                </td>
                <td className="mono">{entry.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
