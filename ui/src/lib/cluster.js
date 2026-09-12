// Very simple keyword-based topic clustering for the digest view.
// This is a UI-side placeholder — real topic clustering is squarely #3's
// (Agent/Tools Engineer) job once the agent loop exists. Replace this
// entirely once `GET /tabs/current` responses come with agent-assigned
// topics, or once #3 exposes a `/tabs/clusters`-style endpoint.

const TOPIC_RULES = [
  { topic: 'Travel', match: /flight|hotel|booking|airways|airport|trip/i },
  { topic: 'Finance', match: /mpesa|m-pesa|statement|bank|invoice|payment/i },
  { topic: 'Communication', match: /mail|gmail|slack|draft/i },
  { topic: 'Reference / Docs', match: /rfc|docs?\.|documentation|spec|wiki/i },
]

const STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

export function clusterTabs(tabs, nowIso = new Date().toISOString()) {
  const now = new Date(nowIso).getTime()
  const groups = new Map()

  for (const tab of tabs) {
    const rule = TOPIC_RULES.find((r) => r.match.test(tab.title) || r.match.test(tab.url))
    const topic = rule?.topic ?? 'Other'
    if (!groups.has(topic)) groups.set(topic, [])
    groups.get(topic).push(tab)
  }

  return Array.from(groups.entries())
    .map(([topic, tabsInTopic]) => {
      const staleCount = tabsInTopic.filter(
        (t) => now - new Date(t.last_accessed_at || t.last_accessed || t.last_seen_at).getTime() > STALE_THRESHOLD_MS
      ).length
      return { topic, tabs: tabsInTopic, staleCount }
    })
    .sort((a, b) => b.tabs.length - a.tabs.length)
}
