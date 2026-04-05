import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import SEO from '../components/SEO/SEO'
import AgentIntegrations from '../components/AgentIntegrations/AgentIntegrations'
import RafayBotAvatar from '../components/RafayBotAvatar/RafayBotAvatar'
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
  const [ttsLoading, setTtsLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceCaption, setVoiceCaption] = useState('')
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
    setTtsLoading(false)
    setIsSpeaking(false)
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
      setVoiceCaption(text.length > 140 ? `${text.slice(0, 137)}…` : text)
      setTtsLoading(true)
      try {
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
        const clearSpeaking = () => setIsSpeaking(false)
        audio.addEventListener('playing', () => setIsSpeaking(true))
        audio.addEventListener('pause', clearSpeaking)
        audio.onended = () => {
          clearSpeaking()
          if (objectUrlRef.current === url) {
            URL.revokeObjectURL(url)
            objectUrlRef.current = null
          }
          audioRef.current = null
        }
        await audio.play()
        setTtsLoading(false)
      } catch (e) {
        setTtsLoading(false)
        setIsSpeaking(false)
        throw e
      }
    },
    [voiceOn, voiceAvailable, stopVoice],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || !isOwner || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)
    let reply = ''
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
      reply = data.text || '(empty response)'
      setMessages((m) => [...m, { role: 'assistant', text: reply }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Error: ${String(e.message || e)}`, isError: true },
      ])
    } finally {
      setLoading(false)
    }
    if (reply && voiceOn && voiceAvailable) {
      void playTts(reply).catch((ve) => {
        console.warn('[voice]', ve)
      })
    }
  }, [input, isOwner, loading, voiceOn, voiceAvailable, playTts])

  const avatarMood = loading ? 'thinking' : ttsLoading ? 'preparing' : isSpeaking ? 'speaking' : 'idle'
  const avatarSubtitle = loading
    ? 'Thinking…'
    : ttsLoading
      ? 'Preparing voice…'
      : isSpeaking
        ? voiceCaption || 'Speaking…'
        : 'Standing by.'

  return (
    <main className="rafay-bot page">
      <SEO title="Rafay Bot" description="Private agent chat for Rafay." path="/rafay-bot" noindex />
      <div className="rafay-bot__inner">
        <header className="rafay-bot__hero">
          <span className="rafay-bot__hero-badge">Assistant</span>
          <h1 className="rafay-bot__title">Rafay Bot</h1>
          <p className="rafay-bot__subtitle">
            Hey Rafay! It&apos;s me, your assistant. Please let me know how I can be of help.
          </p>
          <p className="rafay-bot__hero-meta">
            <span className="rafay-bot__hero-meta-bit">Personal suite</span>
            <span className="rafay-bot__hero-meta-sep">·</span>
            <span className="rafay-bot__hero-meta-bit">Secure session</span>
          </p>
          <AgentIntegrations />
        </header>

        {!user && (
          <div className="rafay-bot__card rafay-bot__card--center">
            <p className="rafay-bot__card-text">Sign in with Google to open your private assistant.</p>
            <button className="rafay-bot__btn rafay-bot__btn--primary" type="button" onClick={() => signInWithPopup(auth, provider)}>
              Sign in with Google
            </button>
          </div>
        )}

        {user && !isOwner && (
          <div className="rafay-bot__card">
            <p className="rafay-bot__card-text">Signed in as {user.email || user.uid}, but this area is allowlisted.</p>
            <button className="rafay-bot__btn rafay-bot__btn--ghost" type="button" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        )}

        {user && isOwner && (
          <div className="rafay-bot__shell">
            <aside className="rafay-bot__aside" aria-label="Assistant avatar">
              <RafayBotAvatar mood={avatarMood} subtitle={avatarSubtitle} />
            </aside>
            <div
              className={`rafay-bot__main${loading ? ' rafay-bot__main--thinking' : ''}${ttsLoading ? ' rafay-bot__main--preparing' : ''}${isSpeaking ? ' rafay-bot__main--speaking' : ''}`}
            >
              <div className="rafay-bot__hud-frame" aria-hidden>
                <span className="rafay-bot__hud-corner rafay-bot__hud-corner--tl" />
                <span className="rafay-bot__hud-corner rafay-bot__hud-corner--tr" />
                <span className="rafay-bot__hud-corner rafay-bot__hud-corner--bl" />
                <span className="rafay-bot__hud-corner rafay-bot__hud-corner--br" />
              </div>
              <div className="rafay-bot__toolbar">
                <div className="rafay-bot__toolbar-left">
                  <span className="rafay-bot__status" title="Session active">
                    <span className="rafay-bot__status-dot" />
                    <span className="rafay-bot__status-label">Link active</span>
                  </span>
                  <span className="rafay-bot__toolbar-sep" aria-hidden />
                  <span className="rafay-bot__signed">{user.email || user.uid}</span>
                  {isSpeaking && (
                    <div className="rafay-bot__voice-meter" aria-hidden>
                      <span className="rafay-bot__voice-meter-bar" />
                      <span className="rafay-bot__voice-meter-bar" />
                      <span className="rafay-bot__voice-meter-bar" />
                      <span className="rafay-bot__voice-meter-bar" />
                      <span className="rafay-bot__voice-meter-bar" />
                    </div>
                  )}
                </div>
                <div className="rafay-bot__toolbar-right">
                  <label
                    className={`rafay-bot__voice-toggle${!voiceStatusLoaded ? ' rafay-bot__voice-toggle--pending' : ''}${!voiceStatusLoaded || !voiceAvailable ? ' rafay-bot__voice-toggle--disabled' : ''}`}
                    title={
                      !voiceStatusLoaded
                        ? 'Checking voice…'
                        : !voiceAvailable
                          ? 'Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID on the server.'
                          : 'Play assistant replies with Eleven Labs text-to-speech.'
                    }
                  >
                    <span className="rafay-bot__voice-toggle-text">Speak replies</span>
                    <span className="rafay-bot__voice-toggle-slot">
                      <input
                        type="checkbox"
                        role="switch"
                        className="rafay-bot__voice-toggle-input"
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
                      <span className="rafay-bot__voice-toggle-track" aria-hidden />
                      <span className="rafay-bot__voice-toggle-thumb" aria-hidden />
                    </span>
                  </label>
                  <button className="rafay-bot__btn rafay-bot__btn--ghost" type="button" onClick={() => signOut(auth)}>
                    Sign out
                  </button>
                </div>
              </div>
              {voiceStatusLoaded && !voiceAvailable && (
                <p className="rafay-bot__voice-hint">
                  Voice needs <code>ELEVENLABS_API_KEY</code> and <code>ELEVENLABS_VOICE_ID</code> on the server.
                </p>
              )}
              <div className="rafay-bot__thread" role="log" aria-live="polite">
                {messages.length === 0 && (
                  <div className="rafay-bot__empty">
                    <p className="rafay-bot__empty-title">Start a conversation</p>
                    <p className="rafay-bot__empty-lead">
                      Scoped to you and this site — not a general web chatbot. Try one of these:
                    </p>
                    <ul className="rafay-bot__empty-chips">
                      <li>Your background &amp; career</li>
                      <li>This site &amp; the public A2A agent</li>
                      <li>Interests &amp; hobbies</li>
                      <li>Tesla range / trips (with voice if enabled)</li>
                    </ul>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={`${i}-${msg.role}`}
                    className={`rafay-bot__msg rafay-bot__msg--${msg.role}${msg.isError ? ' rafay-bot__msg--error' : ''}`}
                  >
                    <div className="rafay-bot__msg-inner">
                      <span
                        className={`rafay-bot__msg-avatar rafay-bot__msg-avatar--${msg.role}`}
                        aria-hidden
                      >
                        {msg.role === 'user' ? 'Y' : 'R'}
                      </span>
                      <div className="rafay-bot__msg-body">
                        <span className="rafay-bot__role">{msg.role === 'user' ? 'You' : 'Rafay Bot'}</span>
                        <MessageBubble text={msg.text} role={msg.role} isError={msg.isError} />
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="rafay-bot__msg rafay-bot__msg--assistant">
                    <div className="rafay-bot__msg-inner">
                      <span className="rafay-bot__msg-avatar rafay-bot__msg-avatar--assistant" aria-hidden>
                        R
                      </span>
                      <div className="rafay-bot__msg-body">
                        <span className="rafay-bot__role">Rafay Bot</span>
                        <div className="rafay-bot__bubble rafay-bot__bubble--typing">
                          <span className="rafay-bot__typing-dots" aria-hidden>
                            <span />
                            <span />
                            <span />
                          </span>
                        </div>
                      </div>
                    </div>
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
                <div className="rafay-bot__composer">
                  <textarea
                    className="rafay-bot__input"
                    rows={3}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        if (!loading && input.trim()) send()
                      }
                    }}
                    placeholder="Message your assistant…"
                    disabled={loading}
                    aria-label="Message"
                  />
                  <div className="rafay-bot__composer-actions">
                    <span className="rafay-bot__composer-hint" title="Send without clicking the button">
                      <kbd className="rafay-bot__kbd">⌘</kbd>
                      <span className="rafay-bot__kbd-plus">+</span>
                      <kbd className="rafay-bot__kbd">Enter</kbd>
                      <span className="rafay-bot__composer-hint-sep">·</span>
                      <kbd className="rafay-bot__kbd">Ctrl</kbd>
                      <span className="rafay-bot__kbd-plus">+</span>
                      <kbd className="rafay-bot__kbd">Enter</kbd>
                      <span className="rafay-bot__composer-hint-label">to send</span>
                    </span>
                    <button
                      className="rafay-bot__btn rafay-bot__btn--primary rafay-bot__send"
                      type="submit"
                      disabled={loading || !input.trim()}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
