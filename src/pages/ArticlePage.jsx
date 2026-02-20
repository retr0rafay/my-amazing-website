import { useParams, Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import { getArticleBySlug } from '../blog/articles'
import './Blog.css'

export default function ArticlePage() {
  const { slug } = useParams()
  const article = getArticleBySlug(slug)

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
        <div className="blog__content blog__content--article">
          <Component />
        </div>
      </div>
    </main>
  )
}
