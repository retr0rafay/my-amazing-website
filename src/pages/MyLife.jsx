import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import Giscus from '@giscus/react'
import SEO from '../components/SEO/SEO'
import { auth } from '../lib/firebase'
import { useTheme } from '../context/ThemeContext'
import './MyLife.css'

function parseAllowlist(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export default function MyLife() {
  const { theme } = useTheme()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const [feedStartIndex, setFeedStartIndex] = useState(0)
  const [visibleIndex, setVisibleIndex] = useState(0)
  const [user, setUser] = useState(null)
  const [deletingId, setDeletingId] = useState('')
  const [expandedCaptions, setExpandedCaptions] = useState({})
  const [commentsExpanded, setCommentsExpanded] = useState({})

  const feedScrollRef = useRef(null)
  const prevFeedOpenRef = useRef(false)

  const ownerEmails = parseAllowlist(import.meta.env.VITE_OWNER_EMAILS)
  const ownerUids = parseAllowlist(import.meta.env.VITE_OWNER_UIDS)
  const giscusRepo = import.meta.env.VITE_GISCUS_REPO
  const giscusRepoId = import.meta.env.VITE_GISCUS_REPO_ID
  const giscusCategory = import.meta.env.VITE_GISCUS_CATEGORY
  const giscusCategoryId = import.meta.env.VITE_GISCUS_CATEGORY_ID
  const hasGiscusConfig = !!(giscusRepo && giscusRepoId && giscusCategory && giscusCategoryId)
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

  useEffect(() => {
    if (!feedOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setFeedOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedOpen])

  useEffect(() => {
    if (!feedOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [feedOpen])

  const openFeed = useCallback((index) => {
    const i = Math.max(0, Math.min(index, items.length - 1))
    setFeedStartIndex(i)
    setVisibleIndex(i)
    setFeedOpen(true)
  }, [items.length])

  const closeFeed = useCallback(() => {
    setFeedOpen(false)
  }, [])

  useLayoutEffect(() => {
    if (!feedOpen || !items.length) {
      prevFeedOpenRef.current = feedOpen
      return undefined
    }
    const justOpened = feedOpen && !prevFeedOpenRef.current
    prevFeedOpenRef.current = feedOpen
    if (!justOpened) return undefined
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById(`my-life-feed-slide-${items[feedStartIndex]?.id}`)
      el?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [feedOpen, feedStartIndex, items])

  useEffect(() => {
    if (!feedOpen || !items.length) return undefined
    const root = feedScrollRef.current
    if (!root) return undefined

    const slides = items
      .map((it) => document.getElementById(`my-life-feed-slide-${it.id}`))
      .filter(Boolean)

    const obs = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.2)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!best?.target?.id) return
        const postId = best.target.id.replace('my-life-feed-slide-', '')
        const idx = items.findIndex((x) => x.id === postId)
        if (idx >= 0) setVisibleIndex(idx)
      },
      { root, rootMargin: '0px', threshold: [0.25, 0.5, 0.75] },
    )

    slides.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [feedOpen, items])

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
      setItems((prev) => {
        const next = prev.filter((item) => item.id !== postId)
        if (next.length === 0) setFeedOpen(false)
        return next
      })
      setCommentsExpanded((prev) => {
        const { [postId]: _, ...rest } = prev
        return rest
      })
    } catch {
      window.alert('Delete failed. Please try again.')
    } finally {
      setDeletingId('')
    }
  }

  function toggleCommentsExpanded(postId) {
    setCommentsExpanded((prev) => ({ ...prev, [postId]: !prev[postId] }))
  }

  const anyCommentsExpanded = Object.values(commentsExpanded).some(Boolean)

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

  function renderCommentsBlock(item) {
    if (!hasGiscusConfig) return null
    const expanded = !!commentsExpanded[item.id]

    return (
      <div className="my-life__comments" aria-label="Discussion for this post">
        {!expanded ? (
          <div className="my-life__comments-preview">
            <p className="my-life__comments-preview-text">
              Add a comment — discussion is powered by GitHub (sign in to reply).
            </p>
            <button
              type="button"
              className="my-life__comments-preview-cta"
              onClick={() => toggleCommentsExpanded(item.id)}
            >
              View all comments
            </button>
          </div>
        ) : (
          <>
            <div className="my-life__comments-head">
              <h3 className="my-life__comments-title">Discussion</h3>
              <span className="my-life__comments-hint">GitHub</span>
            </div>
            <button
              type="button"
              className="my-life__comments-collapse"
              onClick={() => toggleCommentsExpanded(item.id)}
            >
              Hide discussion
            </button>
            <p className="my-life__comments-sub">Same thread as this memory — sign in with GitHub to reply.</p>
            <div className="my-life__comments-body">
              <Giscus
                id={`my-life-comments-${item.id}`}
                repo={giscusRepo}
                repoId={giscusRepoId}
                category={giscusCategory}
                categoryId={giscusCategoryId}
                mapping="specific"
                term={`my-life:${item.id}`}
                strict="1"
                reactionsEnabled="0"
                emitMetadata="0"
                inputPosition="top"
                theme={theme === 'light' ? 'light' : 'dark_dimmed'}
                lang="en"
                loading="lazy"
              />
            </div>
          </>
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
            {items.map((item, index) => (
              <li key={item.id} className="my-life__card">
                <button type="button" className="my-life__media-btn" onClick={() => openFeed(index)}>
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

      {feedOpen && items.length > 0 && (
        <div className="my-life__feed" role="dialog" aria-modal="true" aria-label="My Life feed">
          <header className="my-life__feed-bar">
            <button
              type="button"
              className="my-life__feed-back"
              onClick={closeFeed}
              aria-label="Return to the My Life photo grid"
            >
              <span className="my-life__feed-back-arrow" aria-hidden>
                ←
              </span>
              <span className="my-life__feed-back-label">Grid</span>
            </button>
            <span className="my-life__feed-counter">
              {visibleIndex + 1} / {items.length}
            </span>
          </header>
          <div
            className={
              anyCommentsExpanded
                ? 'my-life__feed-scroll my-life__feed-scroll--no-snap'
                : 'my-life__feed-scroll'
            }
            ref={feedScrollRef}
          >
            {items.map((item) => (
              <article
                key={item.id}
                id={`my-life-feed-slide-${item.id}`}
                className="my-life__feed-slide"
              >
                <div className="my-life__feed-slide-inner" onClick={(e) => e.stopPropagation()}>
                  <div className="my-life__modal-media-wrap">
                    {item.mediaType === 'video' ? (
                      <video className="my-life__modal-media" controls playsInline src={item.mediaUrl} />
                    ) : (
                      <img
                        className="my-life__modal-media"
                        src={item.mediaUrl}
                        alt={item.caption || 'My Life post'}
                      />
                    )}
                  </div>
                  <div className="my-life__modal-side">
                    <div className="my-life__modal-meta">
                      <p>{item.caption || 'No caption'}</p>
                      {item.createdAtMs ? <time>{new Date(item.createdAtMs).toLocaleString()}</time> : null}
                      {isOwner && (
                        <button
                          className="my-life__delete-btn"
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>
                    {renderCommentsBlock(item)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
