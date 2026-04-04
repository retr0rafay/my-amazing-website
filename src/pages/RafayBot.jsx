import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import SEO from '../components/SEO/SEO'
import { auth, provider } from '../lib/firebase'
import './RafayBot.css'

function MessageBubble({ text, role, isError }) {
  const useMd = role === 'assistant' && !isError
  if (!useMd) {
    return (
      <div className="rafay-bot__bubble rafay-bot__bubble--plain">
        <span className="rafay-bot__plain">{text}</span>
      </div>
    )
  }
  return (
    <div className="rafay-bot__bubble rafay-bot__bubble--md">
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

function parseAllowlist(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export default function RafayBot() {
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  const ownerEmails = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_EMAILS), [])
  const ownerUids = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_UIDS), [])

  const isOwner =
    !!user &&
    ((user.email && ownerEmails.includes(user.email.toLowerCase())) ||
      (user.uid && ownerUids.includes(user.uid.toLowerCase())))

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => setUser(next || null))
    return () => unsub()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || !isOwner || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/owner-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || res.statusText || 'Request failed')
      }
      setMessages((m) => [...m, { role: 'assistant', text: data.text || '(empty response)' }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Error: ${String(e.message || e)}`, isError: true },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, isOwner, loading])

  return (
    <main className="rafay-bot page">
      <SEO title="Rafay Bot" description="Private agent chat for Rafay." path="/rafay-bot" noindex />
      <div className="rafay-bot__inner">
        <h1 className="rafay-bot__title">Rafay Bot</h1>
        <p className="rafay-bot__subtitle">Signed-in owner only. Same agent as /api/a2a, without pasting secrets.</p>

        {!user && (
          <button className="rafay-bot__btn" type="button" onClick={() => signInWithPopup(auth, provider)}>
            Sign in with Google
          </button>
        )}

        {user && !isOwner && (
          <div className="rafay-bot__gate">
            <p>Signed in as {user.email || user.uid}, but this area is allowlisted.</p>
            <button className="rafay-bot__btn" type="button" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        )}

        {user && isOwner && (
          <>
            <div className="rafay-bot__toolbar">
              <span className="rafay-bot__signed">Signed in as {user.email || user.uid}</span>
              <button className="rafay-bot__btn rafay-bot__btn--ghost" type="button" onClick={() => signOut(auth)}>
                Sign out
              </button>
            </div>
            <div className="rafay-bot__thread" role="log" aria-live="polite">
              {messages.length === 0 && (
                <p className="rafay-bot__hint">Ask anything — bio, trips (Tesla + Google), etc.</p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={`${i}-${msg.role}`}
                  className={`rafay-bot__msg rafay-bot__msg--${msg.role}${msg.isError ? ' rafay-bot__msg--error' : ''}`}
                >
                  <span className="rafay-bot__role">{msg.role === 'user' ? 'You' : 'Agent'}</span>
                  <MessageBubble text={msg.text} role={msg.role} isError={msg.isError} />
                </div>
              ))}
              {loading && (
                <div className="rafay-bot__msg rafay-bot__msg--assistant">
                  <span className="rafay-bot__role">Agent</span>
                  <div className="rafay-bot__bubble rafay-bot__bubble--typing">…</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form
              className="rafay-bot__form"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <textarea
                className="rafay-bot__input"
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message…"
                disabled={loading}
              />
              <button className="rafay-bot__btn" type="submit" disabled={loading || !input.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
