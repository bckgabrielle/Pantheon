import { useEffect, useState } from 'react'
import { checkConnection, getConnection, saveConnection } from '../lib/api'

export default function SettingsPanel() {
  const [connection, setConnection] = useState(null)
  const [status, setStatus] = useState('')
  useEffect(() => { getConnection().then(setConnection) }, [])
  if (!connection) return <div className="empty-state">Loading connection settings…</div>
  async function submit(e) { e.preventDefault(); await saveConnection(connection); setStatus('Saved.'); try { await checkConnection(); setStatus('Saved — backend connected.'); } catch (error) { setStatus(`Saved, but ${error.message}`) } }
  return <form className="settings-panel panel-form" onSubmit={submit}>
    <div className="section-heading">Connection <span>saved in browser storage</span></div>
    <label>Backend URL<input value={connection.backendUrl} onChange={(e) => setConnection({ ...connection, backendUrl: e.target.value })} /></label>
    <label>Agent URL<input value={connection.agentUrl} onChange={(e) => setConnection({ ...connection, agentUrl: e.target.value })} /></label>
    <label>API key<input type="password" value={connection.apiKey} placeholder="PANTHEON_API_KEY" onChange={(e) => setConnection({ ...connection, apiKey: e.target.value })} /></label>
    <label>User ID<input value={connection.userId} onChange={(e) => setConnection({ ...connection, userId: e.target.value })} /></label>
    <button className="btn btn-accept" type="submit">Save & test</button>
    {status && <div className="notice">{status}</div>}
  </form>
}
