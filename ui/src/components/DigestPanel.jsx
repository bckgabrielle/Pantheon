import { useEffect, useState } from 'react'
import { getCurrentTabs } from '../lib/api'
import { clusterTabs } from '../lib/cluster'

export default function DigestPanel() {
  const [clusters, setClusters] = useState(null)

  useEffect(() => {
    getCurrentTabs().then((tabs) => setClusters(clusterTabs(tabs)))
  }, [])

  if (clusters === null) return <div className="empty-state">Building today's digest…</div>

  return (
    <div className="digest-list">
      {clusters.map(({ topic, tabs, staleCount }) => (
        <div className="digest-card" key={topic}>
          <div className="digest-card-top">
            <span className="digest-topic">{topic}</span>
            <span className="digest-count">{tabs.length} tab{tabs.length === 1 ? '' : 's'}</span>
          </div>
          {tabs.map((t) => (
            <div className="tab-ref" key={t.tab_id}>
              <span className="fav">{t.favicon}</span>
              <span className="title" title={t.title}>{t.title}</span>
              <span className="device-tag">{t.device_name}</span>
            </div>
          ))}
          {staleCount > 0 && (
            <div className="stale-note">
              {staleCount} of these haven't been touched in 3+ days
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
