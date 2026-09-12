import { useState } from 'react'
import ConfirmationList from './components/ConfirmationList'
import ChatPanel from './components/ChatPanel'
import DigestPanel from './components/DigestPanel'
import WorkspacePanel from './components/WorkspacePanel'
import SettingsPanel from './components/SettingsPanel'

const VIEWS = ['Confirm', 'Chat', 'Digest', 'Workspace', 'Settings']

export default function App() {
  const [view, setView] = useState('Confirm')

  function openAuditLog() {
    const url = typeof chrome !== 'undefined' && chrome.runtime
      ? chrome.runtime.getURL('audit.html')
      : '/audit.html'
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-row">
          <h1 className="app-title"><span className="dot" /> Tab Agent</h1>
          <button className="audit-link" onClick={openAuditLog}>Audit log ↗</button>
        </div>
        <p className="app-subtitle">Reviews your tabs, proposes cleanup — nothing runs without your say-so.</p>
        <nav className="tabs-nav">
          {VIEWS.map((v) => (
            <button key={v} className={v === view ? 'active' : ''} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </nav>
      </header>

      {view === 'Confirm' && <ConfirmationList />}
      {view === 'Chat' && <ChatPanel />}
      {view === 'Digest' && <DigestPanel />}
      {view === 'Workspace' && <WorkspacePanel />}
      {view === 'Settings' && <SettingsPanel />}
    </div>
  )
}
