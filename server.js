/**
 * Serves the built SPA and injects Open Graph meta into the initial HTML
 * for crawlers (LinkedIn, Facebook, Twitter, etc.) that don't run JavaScript.
 * Set SITE_URL in production (e.g. https://www.rafaysyed.dev) for correct absolute URLs.
 */
import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const app = express()
const DIST = path.join(__dirname, 'dist')
const SITE_NAME = 'Rafay Syed'
const DEFAULT_IMAGE = '/hero-illustration.png'

// Load article meta (written at build time)
let articlesMeta = []
const metaPath = path.join(DIST, 'articles-meta.json')
if (fs.existsSync(metaPath)) {
  articlesMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
}

function getBaseUrl(req) {
  const env = process.env.SITE_URL
  if (env) return env.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

function getMetaForPath(pathname, baseUrl) {
  if (pathname === '/' || pathname === '') {
    return {
      title: `${SITE_NAME} | Portfolio`,
      description: 'Software engineer portfolio and blog — Rafay Syed.',
      image: `${baseUrl}${DEFAULT_IMAGE}`,
      url: baseUrl,
    }
  }
  if (pathname === '/blog') {
    return {
      title: `Blog | ${SITE_NAME}`,
      description: 'Writings and thoughts on tech, software engineering, and more.',
      image: `${baseUrl}${DEFAULT_IMAGE}`,
      url: `${baseUrl}/blog`,
    }
  }
  const blogMatch = pathname.match(/^\/blog\/([^/]+)\/?$/)
  if (blogMatch) {
    const slug = blogMatch[1]
    const article = articlesMeta.find((a) => a.slug === slug)
    if (article) {
      return {
        title: `${article.title} | ${SITE_NAME}`,
        description: article.preview || article.title,
        image: `${baseUrl}${DEFAULT_IMAGE}`,
        url: `${baseUrl}/blog/${slug}`,
      }
    }
  }
  return null
}

function injectMeta(html, meta) {
  const titleTag = `<title>${escapeHtml(meta.title)}</title>`
  const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${escapeHtml(meta.image)}" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeHtml(meta.url)}" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />
    <meta name="description" content="${escapeHtml(meta.description)}" />`
  let out = html.replace(/<title>[\s\S]*?<\/title>/, titleTag)
  out = out.replace('</head>', ogTags + '\n  </head>')
  return out
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Static assets first
app.use(express.static(DIST, { index: false }))

// SPA fallback: serve index.html with injected OG meta for crawlers
app.get('*', (req, res) => {
  const baseUrl = getBaseUrl(req)
  const meta = getMetaForPath(req.path, baseUrl) || getMetaForPath('/', baseUrl)
  const indexPath = path.join(DIST, 'index.html')
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Not found. Run npm run build first.')
  }
  let html = fs.readFileSync(indexPath, 'utf8')
  html = injectMeta(html, meta)
  res.setHeader('Content-Type', 'text/html')
  res.send(html)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
