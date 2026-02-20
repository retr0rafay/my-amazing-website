import { useState, useCallback } from 'react'
import './ShareButton.css'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = window.location.href
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  return (
    <button
      type="button"
      className="share-button"
      onClick={handleClick}
      title={copied ? 'Copied!' : 'Copy link'}
      aria-label={copied ? 'Link copied to clipboard' : 'Copy link to share'}
    >
      {copied ? (
        <span className="share-button__label">Copied!</span>
      ) : (
        <>
          <span className="share-button__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </span>
          <span className="share-button__label">Share</span>
        </>
      )}
    </button>
  )
}
