import { useRef, useState } from 'react'
import { getCurrentTabs } from '../lib/api'

// Mock query handling — a real implementation calls the backend/agent (owned
// by #2/#3) rather than doing keyword matching client-side. This exists so
// the chat UI and message list are fully built ahead of that being ready.
async function mockAnswer(query) {
  const tabs = await getCurrentTabs()
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const matches = tabs.filter((t) =>
    words.some((w) => t.title.toLowerCase().includes(w) || t.url.toLowerCase().includes(w))
  )

  if (matches.length === 0) {
    return "I couldn't find any open tabs matching that — try different wording, or ask about a specific site or topic."
  }
  const list = matches.map((t) => `• ${t.favicon} ${t.title} (${t.device_name})`).join('\n')
  return `Found ${matches.length} matching tab${matches.length === 1 ? '' : 's'}:\n${list}`
}

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: 'agent', text: 'Ask me things like "what tabs do I have open about flights?"' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  async function send() {
    const query = input.trim()
    if (!query || busy) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: query }])
    setBusy(true)

    const answer = await mockAnswer(query)
    setMessages((prev) => [...prev, { role: 'agent', text: answer }])
    setBusy(false)
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.text.split('\n').map((line, j) => (
              <span key={j}>{line}<br /></span>
            ))}
          </div>
        ))}
        {busy && <div className="chat-bubble agent typing">thinking…</div>}
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          value={input}
          placeholder="Ask about your open tabs…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />
        <button onClick={send} disabled={busy || !input.trim()}>Send</button>
      </div>
    </div>
  )
}
