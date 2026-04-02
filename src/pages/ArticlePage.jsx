import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import { getArticleBySlug } from '../blog/articles'
import './Blog.css'

export default function ArticlePage() {
  const { slug } = useParams()
  const article = getArticleBySlug(slug)
  const [activeImage, setActiveImage] = useState(null)

  useEffect(() => {
    if (!activeImage) {
      return
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveImage(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeImage])

  if (!article) {
    return (
      <main className="blog page">
        <SEO title="Article not found" />
        <div className="blog__inner">
          <p className="blog__empty">Article not found.</p>
          <Link to="/blog" className="blog__back">
            ← Back to Blog
          </Link>
        </div>
      </main>
    )
  }

  const { Component, meta } = article

  return (
    <main className="blog page">
      <SEO
        title={meta.title}
        description={meta.preview}
        path={`/blog/${slug}`}
        author="Rafay Syed"
        publishedTime={meta.date ? `${meta.date}T00:00:00Z` : undefined}
      />
      <div className="blog__inner">
        <Link to="/blog" className="blog__back">
          ← Back to Blog
        </Link>
        <div
          className="blog__content blog__content--article"
          onClick={(event) => {
            const clickedImage = event.target.closest('.article__img')
            if (!clickedImage) {
              return
            }

            setActiveImage({
              src: clickedImage.getAttribute('src'),
              alt: clickedImage.getAttribute('alt') || 'Expanded blog image',
            })
          }}
        >
          <Component />
        </div>
      </div>
      {activeImage ? (
        <div
          className="article__modal"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded blog image"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setActiveImage(null)
            }
          }}
        >
          <button
            type="button"
            className="article__modal-close"
            aria-label="Close image preview"
            onClick={() => setActiveImage(null)}
          >
            ×
          </button>
          <img
            src={activeImage.src}
            alt={activeImage.alt}
            className="article__modal-img"
          />
        </div>
      ) : null}
    </main>
  )
}
