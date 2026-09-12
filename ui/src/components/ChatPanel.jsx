import { useRef, useState } from 'react'
import { runAgent } from '../lib/api'

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: 'agent', text: 'I use your saved tab state to answer questions and propose changes for your approval.' },
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

    try {
      const plan = await runAgent(query)
      const suffix = plan.actions?.length ? `\n\n${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'} added to Confirm.` : ''
      setMessages((prev) => [...prev, { role: 'agent', text: `${plan.summary || 'No changes proposed.'}${suffix}` }])
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'agent', text: `I couldn’t reach the agent: ${error.message}. Check Settings.` }])
    }
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
