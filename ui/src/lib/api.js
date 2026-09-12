const DEFAULTS = { backendUrl: 'http://localhost:8001', agentUrl: 'http://localhost:8000', apiKey: '', userId: 'default' }
const STORAGE_KEY = 'pantheonConnection'
const hasChromeStorage = () => typeof chrome !== 'undefined' && chrome.storage?.local

export async function getConnection() {
  if (hasChromeStorage()) {
    const saved = await chrome.storage.local.get(STORAGE_KEY)
    return { ...DEFAULTS, ...(saved[STORAGE_KEY] || {}) }
  }
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } } catch { return DEFAULTS }
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
    headers: { 'Content-Type': 'application/json', ...(connection.apiKey ? { 'X-API-Key': connection.apiKey } : {}), ...options.headers },
  })
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`)
  return response.json()
}
const userPath = async () => (await getConnection()).userId
export async function getCurrentTabs() { return (await request(`/tabs/current?user_id=${encodeURIComponent(await userPath())}`)).tabs }
export async function getTabHistory(since) { return (await request(`/tabs/history?user_id=${encodeURIComponent(await userPath())}&since=${encodeURIComponent(since)}`)).observations }
export async function getDuplicates() { return (await request(`/tabs/duplicates?user_id=${encodeURIComponent(await userPath())}`)).duplicate_groups }
export async function getActions() { return (await request(`/actions?user_id=${encodeURIComponent(await userPath())}`)).actions }
export async function getDashboard() { return request(`/dashboard/${encodeURIComponent(await userPath())}`) }
export async function getProfile() { return request(`/users/${encodeURIComponent(await userPath())}/profile`) }
export async function saveProfile(profile) { return request(`/users/${encodeURIComponent(await userPath())}/profile`, { method: 'PUT', body: JSON.stringify(profile) }) }
export async function getJobs() { return (await request(`/jobs/${encodeURIComponent(await userPath())}`)).jobs }
export async function getApplications() { return (await request(`/applications/${encodeURIComponent(await userPath())}`)).applications }
export async function getReminders() { return (await request(`/reminders/${encodeURIComponent(await userPath())}`)).reminders }
export async function createJob(job) { return request('/jobs', { method: 'POST', body: JSON.stringify({ user_id: await userPath(), ...job }) }) }
export async function createApplication(application) { return request('/applications', { method: 'POST', body: JSON.stringify({ user_id: await userPath(), ...application }) }) }
export async function createReminder(reminder) { return request('/reminders', { method: 'POST', body: JSON.stringify({ user_id: await userPath(), ...reminder }) }) }
export async function postActionLog(action) { return request('/actions', { method: 'POST', body: JSON.stringify({ user_id: await userPath(), ...action }) }) }

export async function runAgent(query) {
  const connection = await getConnection()
  const response = await fetch(`${connection.agentUrl.replace(/\/$/, '')}/agent/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, session_id: `ui-${connection.userId}` }) })
  if (!response.ok) throw new Error(`Agent request failed (${response.status})`)
  return response.json()
}
export async function checkConnection() {
  const connection = await getConnection()
  const response = await fetch(`${connection.backendUrl.replace(/\/$/, '')}/health`)
  if (!response.ok) throw new Error('Backend is unavailable')
  return response.json()
}
