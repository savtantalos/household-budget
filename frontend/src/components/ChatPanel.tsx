import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { ChatMessage } from '../types'

const SUGGESTIONS = [
  'Can we afford a £300 holiday next month?',
  'Where could we cut back?',
  'Explain our settlement in simple terms.',
]

function readable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  const match = text.match(/"detail":\s*"([^"]+)"/)
  return match ? match[1] : text
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.chatHistory().then(setMessages, (e) => setError(readable(e)))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages, pending])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || pending) return
    setPending(question)
    setDraft('')
    setError(null)
    try {
      const added = await api.sendChat(question)
      setMessages((current) => [...current, ...added])
    } catch (e) {
      setError(readable(e))
      setDraft(question)
    } finally {
      setPending(null)
    }
  }

  const clear = async () => {
    await api.clearChat()
    setMessages([])
    setError(null)
  }

  return (
    <section className="card chat">
      <div className="chat-head">
        <div>
          <h2>Ask about your budget</h2>
          <p className="muted">
            Claude sees your dashboard numbers and this conversation. Chats are saved to your
            account.
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="secondary" onClick={clear} disabled={!!pending}>
            Clear chat
          </button>
        )}
      </div>

      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && !pending && (
          <div className="chat-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="secondary" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {pending && (
          <>
            <div className="chat-msg human">{pending}</div>
            <div className="chat-msg ai muted">Thinking…</div>
          </>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="chat-error negative">{error}</p>}

      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question about your money…"
          aria-label="Message"
          maxLength={4000}
          disabled={!!pending}
        />
        <button type="submit" className="primary" disabled={!!pending || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
