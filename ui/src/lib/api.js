import { mockProposedActions, mockTabs } from '../mock/mockData'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const DEFAULTS = {
  backendUrl: import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8001',
  agentUrl: import.meta.env.VITE_AGENT_BASE_URL ?? 'http://localhost:8000',
  apiKey: import.meta.env.VITE_PANTHEON_API_KEY ?? '',
  userId: import.meta.env.VITE_BACKEND_USER_ID ?? 'default',
}
const STORAGE_KEY = 'pantheonConnection'
const hasChromeStorage = () => typeof chrome !== 'undefined' && chrome.storage?.local

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getConnection() {
  if (hasChromeStorage()) {
    const saved = await chrome.storage.local.get(STORAGE_KEY)
    return { ...DEFAULTS, ...(saved[STORAGE_KEY] || {}) }
  }
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

export async function saveConnection(connection) {
  const value = { ...DEFAULTS, ...connection }
  if (hasChromeStorage()) await chrome.storage.local.set({ [STORAGE_KEY]: value })
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  return value
}

async function request(path, options = {}) {
  const connection = await getConnection()
  const response = await fetch(`${connection.backendUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(connection.apiKey ? { 'X-API-Key': connection.apiKey } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`)
  return response.json()
}

const userPath = async () => (await getConnection()).userId

function normalizeTab(tab) {
  const tabId = String(tab.tab_id ?? tab.external_tab_id ?? tab.id)
  return {
    ...tab,
    id: tab.id,
    tab_id: tabId,
    title: tab.title ?? '',
    url: tab.url ?? '',
    favicon: tab.favicon ?? '*',
    device_id: String(tab.device_id ?? tab.device_name ?? ''),
    device_name: tab.device_name ?? 'Unknown device',
    window_id: String(tab.window_id ?? ''),
    active: Boolean(tab.active),
    last_accessed: tab.last_accessed ?? tab.last_accessed_at ?? null,
    is_duplicate: Boolean(tab.is_duplicate ?? tab.likely_duplicate ?? false),
  }
}

function normalizeTabsPayload(payload) {
  const tabs = Array.isArray(payload) ? payload : payload.tabs ?? []
  return tabs.map(normalizeTab)
}

function targetTabIds(action) {
  if (action.type === 'group_tabs') return action.params?.tab_ids ?? []
  if (action.params?.tab_id !== undefined) return [action.params.tab_id]
  return []
}

export function proposalFromAgentAction(action, tabs = []) {
  const ids = targetTabIds(action).map(String)
  const byTabId = new Map(tabs.map((tab) => [String(tab.tab_id), tab]))
  const byId = new Map(tabs.map((tab) => [String(tab.id), tab]))
  return {
    id: action.action_id,
    action: action.type,
    target_tab_ids: ids,
    tabs: ids.map((id) => byTabId.get(id) ?? byId.get(id)).filter(Boolean),
    params: action.params ?? {},
    rationale: action.reason ?? '',
    requires_confirmation: action.requires_confirmation ?? true,
  }
}

export async function getCurrentTabs() {
  if (USE_MOCK) {
    await delay()
    return mockTabs
  }
  return normalizeTabsPayload(await request(`/tabs/current?user_id=${encodeURIComponent(await userPath())}`))
}

export async function getTabHistory(since) {
  if (USE_MOCK) {
    await delay()
    return mockTabs.filter((tab) => !since || tab.last_accessed < since)
  }
  const payload = await request(`/tabs/history?user_id=${encodeURIComponent(await userPath())}&since=${encodeURIComponent(since)}`)
  return payload.observations ?? payload
}

export async function getDuplicates() {
  if (USE_MOCK) {
    await delay()
    const byUrl = {}
    mockTabs.forEach((tab) => {
      byUrl[tab.url] = byUrl[tab.url] || []
      byUrl[tab.url].push(tab)
    })
    return Object.values(byUrl).filter((group) => group.length > 1)
  }
  const payload = await request(`/tabs/duplicates?user_id=${encodeURIComponent(await userPath())}`)
  return payload.duplicate_groups ?? payload
}

export async function getActions() {
  return (await request(`/actions?user_id=${encodeURIComponent(await userPath())}`)).actions
}

export async function getDashboard() {
  return request(`/dashboard/${encodeURIComponent(await userPath())}`)
}

export async function getProfile() {
  return request(`/users/${encodeURIComponent(await userPath())}/profile`)
}

export async function saveProfile(profile) {
  return request(`/users/${encodeURIComponent(await userPath())}/profile`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}

export async function getJobs() {
  return (await request(`/jobs/${encodeURIComponent(await userPath())}`)).jobs
}

export async function getApplications() {
  return (await request(`/applications/${encodeURIComponent(await userPath())}`)).applications
}

export async function getReminders() {
  return (await request(`/reminders/${encodeURIComponent(await userPath())}`)).reminders
}

export async function createJob(job) {
  return request('/jobs', { method: 'POST', body: JSON.stringify({ user_id: await userPath(), ...job }) })
}

export async function createApplication(application) {
  return request('/applications', { method: 'POST', body: JSON.stringify({ user_id: await userPath(), ...application }) })
}

export async function createReminder(reminder) {
  return request('/reminders', { method: 'POST', body: JSON.stringify({ user_id: await userPath(), ...reminder }) })
}

export async function runAgent(query = 'Review my open tabs and propose a cleanup plan.') {
  if (USE_MOCK) {
    await delay()
    return {
      plan_id: 'mock-plan',
      summary: 'Mock cleanup plan ready.',
      actions: mockProposedActions.map((action) => ({
        action_id: action.id,
        type: action.action,
        params: action.params,
        reason: action.rationale,
        requires_confirmation: action.requires_confirmation,
      })),
      batch_warning: null,
      truncated_action_count: 0,
    }
  }

  const connection = await getConnection()
  const response = await fetch(`${connection.agentUrl.replace(/\/$/, '')}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: `ui-${connection.userId}` }),
  })
  if (!response.ok) throw new Error(`Agent request failed (${response.status})`)
  return response.json()
}

export async function getProposedActions() {
  if (USE_MOCK) {
    await delay()
    return mockProposedActions
  }
  const [tabs, plan] = await Promise.all([getCurrentTabs(), runAgent()])
  return (plan.actions ?? []).map((action) => proposalFromAgentAction(action, tabs))
}

export async function postActionLog(entry) {
  if (USE_MOCK) {
    await delay(80)
    return { ok: true, entry }
  }

  if (entry.action_type) {
    return request('/actions', {
      method: 'POST',
      body: JSON.stringify({ user_id: await userPath(), ...entry }),
    })
  }

  const rawTabId = entry.target_tab_ids?.[0]
  const numericTabId = Number(rawTabId)
  const status = entry.outcome?.startsWith?.('error:')
    ? 'failed'
    : entry.verdict === 'approved'
      ? 'executed'
      : 'rejected'

  return request('/actions', {
    method: 'POST',
    body: JSON.stringify({
      user_id: await userPath(),
      tab_id: Number.isInteger(numericTabId) ? numericTabId : null,
      action_type: entry.action,
      status,
      proposed: false,
      rationale: entry.rationale,
      payload: {
        target_tab_ids: entry.target_tab_ids ?? [],
        verdict: entry.verdict,
        outcome: entry.outcome,
      },
      outcome: { message: entry.outcome },
    }),
  })
}

export async function checkConnection() {
  const connection = await getConnection()
  const response = await fetch(`${connection.backendUrl.replace(/\/$/, '')}/health`)
  if (!response.ok) throw new Error('Backend is unavailable')
  return response.json()
}
