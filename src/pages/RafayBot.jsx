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

const VOICE_LS_KEY = 'rafay-bot-voice'

export default function RafayBot() {
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(VOICE_LS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [voiceStatusLoaded, setVoiceStatusLoaded] = useState(false)
  const bottomRef = useRef(null)
  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)

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

  const stopVoice = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.src = ''
      } catch {
        /* ignore */
      }
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(() => () => stopVoice(), [stopVoice])

  useEffect(() => {
    if (!isOwner || !user) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const token = await auth.currentUser.getIdToken()
        const r = await fetch('/api/owner-tts/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        if (!r.ok) {
          setVoiceAvailable(false)
          setVoiceStatusLoaded(true)
          return
        }
        const d = await r.json().catch(() => ({}))
        if (!cancelled) {
          setVoiceAvailable(!!d.enabled)
          setVoiceStatusLoaded(true)
        }
      } catch {
        if (!cancelled) setVoiceStatusLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwner, user])

  const playTts = useCallback(
    async (text) => {
      if (!text?.trim() || !voiceOn || !voiceAvailable) return
      stopVoice()
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/owner-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      })
      const ct = res.headers.get('content-type') || ''
      if (!res.ok || !ct.includes('audio')) {
        const err = ct.includes('json') ? await res.json().catch(() => ({})) : {}
        const parts = [err.error, err.elevenLabsDetail].filter(Boolean)
        throw new Error(parts.join(' — ') || res.statusText || 'Voice request failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url)
          objectUrlRef.current = null
        }
        audioRef.current = null
      }
      await audio.play()
    },
    [voiceOn, voiceAvailable, stopVoice],
  )

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
      const reply = data.text || '(empty response)'
      setMessages((m) => [...m, { role: 'assistant', text: reply }])
      if (voiceOn && voiceAvailable) {
        try {
          await playTts(reply)
        } catch (ve) {
          console.warn('[voice]', ve)
        }
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Error: ${String(e.message || e)}`, isError: true },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, isOwner, loading, voiceOn, voiceAvailable, playTts])

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
              <div className="rafay-bot__toolbar-right">
                <label
                  className={`rafay-bot__voice${!voiceStatusLoaded ? ' rafay-bot__voice--pending' : ''}`}
                  title={
                    !voiceStatusLoaded
                      ? 'Checking voice…'
                      : !voiceAvailable
                        ? 'Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID on the server.'
                        : 'Play assistant replies with Eleven Labs text-to-speech.'
                  }
                >
                  <input
                    type="checkbox"
                    role="switch"
                    checked={voiceOn}
                    disabled={!voiceStatusLoaded || !voiceAvailable}
                    onChange={(e) => {
                      const on = e.target.checked
                      setVoiceOn(on)
                      try {
                        localStorage.setItem(VOICE_LS_KEY, on ? '1' : '0')
                      } catch {
                        /* ignore */
                      }
                      if (!on) stopVoice()
                    }}
                  />
                  <span className="rafay-bot__voice-label">Speak replies</span>
                </label>
                <button className="rafay-bot__btn rafay-bot__btn--ghost" type="button" onClick={() => signOut(auth)}>
                  Sign out
                </button>
              </div>
            </div>
            {voiceStatusLoaded && !voiceAvailable && (
              <p className="rafay-bot__voice-hint">
                Voice is off until the server has <code>ELEVENLABS_API_KEY</code> and <code>ELEVENLABS_VOICE_ID</code>.
              </p>
            )}
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
