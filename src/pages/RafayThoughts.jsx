import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import SEO from '../components/SEO/SEO'
import { auth } from '../lib/firebase'
import './RafayThoughts.css'

function parseAllowlist(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export default function RafayThoughts() {
  const [user, setUser] = useState(null)
  const [thoughts, setThoughts] = useState([])
  const [thoughtsLoading, setThoughtsLoading] = useState(true)
  const [thoughtsStatus, setThoughtsStatus] = useState('')
  const [thoughtText, setThoughtText] = useState('')
  const [thoughtStatus, setThoughtStatus] = useState('')
  const [isPostingThought, setIsPostingThought] = useState(false)
  const [deletingThoughtId, setDeletingThoughtId] = useState('')
  const ownerEmails = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_EMAILS), [])
  const ownerUids = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_UIDS), [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null)
    })
    return () => unsub()
  }, [])

  const isOwner = !!user && (
    (user.email && ownerEmails.includes(user.email.toLowerCase())) ||
    (user.uid && ownerUids.includes(user.uid.toLowerCase()))
  )

  async function loadThoughts() {
    try {
      setThoughtsLoading(true)
      const res = await fetch(`/api/haven/thoughts?limit=60&t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Could not load thoughts')
      const payload = await res.json()
      setThoughts(Array.isArray(payload.items) ? payload.items : [])
      setThoughtsStatus('')
    } catch {
      setThoughtsStatus('Could not load Thoughts right now.')
    } finally {
      setThoughtsLoading(false)
    }
  }

  useEffect(() => {
    loadThoughts()
  }, [])

  async function handlePostThought(e) {
    e.preventDefault()
    if (!user || !isOwner || isPostingThought) return
    const text = thoughtText.trim()
    if (!text) {
      setThoughtStatus('Write something first.')
      return
    }
    try {
      setIsPostingThought(true)
      setThoughtStatus('Posting...')
      const token = await user.getIdToken()
      const res = await fetch('/api/haven/thoughts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Could not post thought')
      setThoughtText('')
      setThoughtStatus('Posted.')
      await loadThoughts()
    } catch {
      setThoughtStatus('Could not post thought.')
    } finally {
      setIsPostingThought(false)
    }
  }

  async function handleDeleteThought(id) {
    if (!user || !isOwner || !id) return
    try {
      setDeletingThoughtId(id)
      const token = await user.getIdToken()
      const res = await fetch(`/api/haven/thoughts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Could not delete thought')
      setThoughtStatus('Thought removed.')
      setThoughts((prev) => prev.filter((item) => item.id !== id))
    } catch {
      setThoughtStatus('Could not delete thought.')
    } finally {
      setDeletingThoughtId('')
    }
  }

  function formatThoughtTime(createdAtMs) {
    if (!createdAtMs) return ''
    return new Date(createdAtMs).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <main className="thoughts page">
      <SEO
        title="Thoughts"
        description="Short updates from Rafay, posted directly on this site."
        path="/rafay-thoughts"
      />
      <div className="thoughts__inner">
        <h1 className="thoughts__title">Thoughts</h1>

        {user && isOwner && (
          <form className="thoughts__form" onSubmit={handlePostThought}>
            <textarea
              value={thoughtText}
              onChange={(e) => setThoughtText(e.target.value)}
              maxLength={280}
              placeholder="What are you thinking about right now?"
            />
            <div className="thoughts__actions">
              <button className="thoughts__btn" type="submit" disabled={isPostingThought}>
                {isPostingThought ? 'Posting...' : 'Post thought'}
              </button>
              <button className="thoughts__btn thoughts__btn--ghost" type="button" onClick={() => signOut(auth)}>
                Sign out
              </button>
            </div>
            <p className="thoughts__state">
              {thoughtText.length}/280
              {thoughtStatus ? ` · ${thoughtStatus}` : ''}
            </p>
          </form>
        )}

        {thoughtsLoading && <p className="thoughts__state">Loading thoughts...</p>}
        {!thoughtsLoading && thoughts.length === 0 && (
          <p className="thoughts__state">No thoughts posted yet.</p>
        )}
        {thoughtsStatus && <p className="thoughts__state">{thoughtsStatus}</p>}
        {thoughts.length > 0 && (
          <ul className="thoughts__list">
            {thoughts.map((item) => (
              <li key={item.id} className="thoughts__item">
                <header className="thoughts__item-header">
                  <img
                    className="thoughts__avatar"
                    src="/rafay-bot-mascot.png"
                    alt="Rafay avatar"
                    width={44}
                    height={44}
                    decoding="async"
                    loading="lazy"
                  />
                  <div className="thoughts__identity">
                    <strong className="thoughts__name">Rafay Syed</strong>
                    <div className="thoughts__meta-row">
                      <span className="thoughts__handle">@rafay</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={new Date(item.createdAtMs || Date.now()).toISOString()}>
                        {formatThoughtTime(item.createdAtMs)}
                      </time>
                    </div>
                  </div>
                </header>
                <p className="thoughts__text">{item.text}</p>
                <div className="thoughts__meta">
                  {isOwner && (
                    <button
                      type="button"
                      className="thoughts__btn thoughts__btn--ghost thoughts__btn--sm"
                      onClick={() => handleDeleteThought(item.id)}
                      disabled={deletingThoughtId === item.id}
                    >
                      {deletingThoughtId === item.id ? 'Removing...' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
