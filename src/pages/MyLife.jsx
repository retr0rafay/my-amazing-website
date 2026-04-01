import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import SEO from '../components/SEO/SEO'
import { auth } from '../lib/firebase'
import './MyLife.css'

function parseAllowlist(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export default function MyLife() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(null)
  const [user, setUser] = useState(null)
  const [deletingId, setDeletingId] = useState('')
  const [expandedCaptions, setExpandedCaptions] = useState({})

  const ownerEmails = parseAllowlist(import.meta.env.VITE_OWNER_EMAILS)
  const ownerUids = parseAllowlist(import.meta.env.VITE_OWNER_UIDS)
  const isOwner = !!user && (
    (user.email && ownerEmails.includes(user.email.toLowerCase())) ||
    (user.uid && ownerUids.includes(user.uid.toLowerCase()))
  )

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/haven/posts')
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
      })
      .then((res) => {
        if (!cancelled) setItems(res.items || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDelete(postId) {
    if (!isOwner || !postId || deletingId) return
    const ok = window.confirm('Delete this post permanently?')
    if (!ok) return
    try {
      setDeletingId(postId)
      const token = await user.getIdToken()
      const res = await fetch(`/api/haven/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      setItems((prev) => prev.filter((item) => item.id !== postId))
      setActive((prev) => (prev?.id === postId ? null : prev))
    } catch {
      window.alert('Delete failed. Please try again.')
    } finally {
      setDeletingId('')
    }
  }

  function isCaptionLong(caption) {
    return (caption || '').trim().length > 110
  }

  function renderCaption(caption = '', id) {
    const cleaned = caption.trim()
    if (!cleaned) return null
    const expanded = !!expandedCaptions[id]
    const long = isCaptionLong(cleaned)
    const preview = long ? `${cleaned.slice(0, 110).trim()}...` : cleaned

    return (
      <div className="my-life__caption-wrap">
        <p className="my-life__caption-inline">
          <span className="my-life__caption-author">rafay</span> {expanded ? cleaned : preview}
        </p>
        {long && (
          <button
            type="button"
            className="my-life__caption-toggle"
            onClick={() => setExpandedCaptions((prev) => ({ ...prev, [id]: !expanded }))}
          >
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </div>
    )
  }

  return (
    <main className="my-life page">
      <SEO
        title="My Life"
        description="Photos and videos from Rafay in chronological order."
        path="/my-life"
      />
      <div className="my-life__inner">
        <header className="my-life__header">
          <div>
            <h1 className="my-life__title">My Life</h1>
            <p className="my-life__subtitle">// moments</p>
          </div>
          <p className="my-life__count">{items.length} posts</p>
        </header>

        {loading && <p className="my-life__state">Loading memories...</p>}
        {error && !loading && <p className="my-life__state">Could not load posts right now.</p>}
        {!loading && !error && items.length === 0 && <p className="my-life__state">No posts yet.</p>}

        {!loading && !error && items.length > 0 && (
          <ul className="my-life__grid">
            {items.map((item) => (
              <li key={item.id} className="my-life__card">
                <button type="button" className="my-life__media-btn" onClick={() => setActive(item)}>
                  {item.mediaType === 'video' ? (
                    <video className="my-life__media" preload="metadata" src={item.mediaUrl} />
                  ) : (
                    <img className="my-life__media" src={item.mediaUrl} alt={item.caption || 'My Life post'} loading="lazy" />
                  )}
                </button>
                {renderCaption(item.caption, item.id)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {active && (
        <div className="my-life__modal" onClick={() => setActive(null)}>
          <div className="my-life__modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="my-life__modal-media-wrap">
              {active.mediaType === 'video' ? (
                <video className="my-life__modal-media" controls autoPlay src={active.mediaUrl} />
              ) : (
                <img className="my-life__modal-media" src={active.mediaUrl} alt={active.caption || 'My Life post'} />
              )}
            </div>
            <div className="my-life__modal-meta">
              <p>{active.caption || 'No caption'}</p>
              {active.createdAtMs ? <time>{new Date(active.createdAtMs).toLocaleString()}</time> : null}
              {isOwner && (
                <button
                  className="my-life__delete-btn"
                  type="button"
                  disabled={deletingId === active.id}
                  onClick={() => handleDelete(active.id)}
                >
                  {deletingId === active.id ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
