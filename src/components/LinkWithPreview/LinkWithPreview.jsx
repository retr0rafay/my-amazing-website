import { useState, useRef, useCallback } from 'react'
import './LinkWithPreview.css'

const PREVIEW_API = 'https://api.microlink.io'

export default function LinkWithPreview({ href, children, className = '', ...props }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hover, setHover] = useState(false)
  const hoverTimerRef = useRef(null)
  const fetchedRef = useRef(false)

  const fetchPreview = useCallback(() => {
    if (!href || fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    setError(false)
    const encoded = encodeURIComponent(href)
    fetch(`${PREVIEW_API}?url=${encoded}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.data) {
          setPreview({
            title: data.data.title || new URL(href).hostname,
            description: data.data.description || '',
            image: data.data.image?.url,
            url: data.data.url || href,
          })
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false)
      })
  }, [href])

  const handleMouseEnter = () => {
    setHover(true)
    hoverTimerRef.current = window.setTimeout(fetchPreview, 400)
  }

  const handleMouseLeave = () => {
    setHover(false)
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  const showCard = hover && (preview || loading || error)

  return (
    <span className="link-preview-wrap">
      <a
        href={href}
        className={`article__link link--post ${className}`.trim()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </a>
      {showCard && (
        <span
          className="link-preview-card"
          role="tooltip"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {loading && (
            <span className="link-preview-card__loading">Loading preview…</span>
          )}
          {error && !loading && (
            <span className="link-preview-card__fallback">{href}</span>
          )}
          {preview && !loading && (
            <>
              {preview.image && (
                <span className="link-preview-card__image-wrap">
                  <img
                    src={preview.image}
                    alt=""
                    className="link-preview-card__image"
                  />
                </span>
              )}
              <span className="link-preview-card__body">
                <span className="link-preview-card__title">{preview.title}</span>
                {preview.description && (
                  <span className="link-preview-card__description">
                    {preview.description}
                  </span>
                )}
                <span className="link-preview-card__url">{preview.url}</span>
              </span>
            </>
          )}
        </span>
      )}
    </span>
  )
}
