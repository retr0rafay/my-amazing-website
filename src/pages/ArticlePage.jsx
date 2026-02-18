import { useParams, Link } from 'react-router-dom'
import { getArticleBySlug } from '../blog/articles'
import './Blog.css'

export default function ArticlePage() {
  const { slug } = useParams()
  const article = getArticleBySlug(slug)

  if (!article) {
    return (
      <main className="blog page">
        <div className="blog__inner">
          <p className="blog__empty">Article not found.</p>
          <Link to="/blog" className="blog__back">
            ← Back to Blog
          </Link>
        </div>
      </main>
    )
  }

  const { Component } = article

  return (
    <main className="blog page">
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
