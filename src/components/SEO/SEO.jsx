import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Rafay Syed'
const DEFAULT_IMAGE = '/hero-illustration.png'

/**
 * Get the base URL for absolute links (og:image, og:url).
 * Set VITE_SITE_URL in .env for production (e.g. https://yoursite.up.railway.app).
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return import.meta.env.VITE_SITE_URL || ''
}

/**
 * Reusable SEO / link preview component. Use on each page so shared links
 * show the right title, description, and image (Open Graph + Twitter Card).
 * For articles, pass author and publishedTime so LinkedIn etc. show author and date.
 */
export default function SEO({
  title,
  description,
  image = DEFAULT_IMAGE,
  path = '',
  author,
  publishedTime,
}) {
  const baseUrl = getBaseUrl()
  const fullUrl = path ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : baseUrl
  const imageUrl = image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? image : `/${image}`}`
  const displayTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Portfolio`
  const desc = description || `Software engineer portfolio and blog — Rafay Syed.`
  const isArticle = author || publishedTime

  return (
    <Helmet>
      <title>{displayTitle}</title>
      <meta name="description" content={desc} />

      {/* Open Graph (Facebook, LinkedIn, etc.) */}
      <meta property="og:type" content={isArticle ? 'article' : 'website'} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={displayTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      {author && <meta property="article:author" content={author} />}
      {publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={displayTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  )
}
