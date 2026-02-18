import { Link } from 'react-router-dom'
import { articles } from '../blog/articles'
import './Blog.css'

export default function Blog() {
  return (
    <main className="blog page">
      <div className="blog__inner">
        <header className="blog__header">
          <h1 className="blog__title">Blog</h1>
          <p className="blog__subtitle">// writings & thoughts</p>
        </header>
        <ul className="blog__list">
          {articles.map(({ slug, meta, Component }) => (
            <li key={slug} className="blog__item">
              <Link to={`/blog/${slug}`} className="blog__link">
                <h2 className="blog__item-title">{meta.title}</h2>
                <time className="blog__item-date" dateTime={meta.date}>
                  {meta.date}
                </time>
                <p className="blog__preview">{meta.preview}</p>
                <span className="blog__read-more">Read more →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
