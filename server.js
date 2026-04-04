/**
 * Serves the built SPA and injects Open Graph meta into the initial HTML
 * for crawlers (LinkedIn, Facebook, Twitter, etc.) that don't run JavaScript.
 * Set SITE_URL in production (e.g. https://www.rafaysyed.dev) for correct absolute URLs.
 */
import 'dotenv/config'
import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import gamingRouter from './api/gaming.js'
import havenRouter from './api/haven.js'
import a2aRouter from './api/a2a.js'
import { setupTeslaChargeNotifications } from './api/teslaChargeNotify.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const app = express()
app.use(express.json({ limit: '2mb' }))

// API (PSN gaming) before static so /api/gaming is hit
app.use('/api', gamingRouter)
app.use('/api', havenRouter)
app.use('/api', a2aRouter)
setupTeslaChargeNotifications(app)
const DIST = path.join(__dirname, 'dist')
const TESLA_PUBLIC_KEY_PEM = path.join(
  DIST,
  '.well-known/appspecific/com.tesla.3p.public-key.pem',
)
const SITE_NAME = 'Rafay Syed'
const AUTHOR = 'Rafay Syed'
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
  if (pathname === '/gaming') {
    return {
      title: `Gaming | ${SITE_NAME}`,
      description: 'Recently played PlayStation games and playtime.',
      image: `${baseUrl}${DEFAULT_IMAGE}`,
      url: `${baseUrl}/gaming`,
    }
  }
  if (pathname === '/my-life') {
    return {
      title: `My Life | ${SITE_NAME}`,
      description: 'Photos and videos from Rafay in chronological order.',
      image: `${baseUrl}/api/haven/og-image`,
      url: `${baseUrl}/my-life`,
    }
  }
  const blogMatch = pathname.match(/^\/blog\/([^/]+)\/?$/)
  if (blogMatch) {
    const slug = blogMatch[1]
    const article = articlesMeta.find((a) => a.slug === slug)
    if (article) {
      const publishedTime = article.date ? `${article.date}T00:00:00Z` : null
      return {
        type: 'article',
        title: `${article.title} | ${SITE_NAME}`,
        description: article.preview || article.title,
        image: `${baseUrl}${DEFAULT_IMAGE}`,
        url: `${baseUrl}/blog/${slug}`,
        author: AUTHOR,
        publishedTime,
      }
    }
  }
  return null
}

function injectMeta(html, meta) {
  const titleTag = `<title>${escapeHtml(meta.title)}</title>`
  const ogType = meta.type === 'article' ? 'article' : 'website'
  let ogTags = `
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${escapeHtml(meta.image)}" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`
  if (meta.author) {
    ogTags += `
    <meta property="article:author" content="${escapeHtml(meta.author)}" />`
  }
  if (meta.publishedTime) {
    ogTags += `
    <meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}" />`
  }
  ogTags += `
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

// Tesla Fleet partner verification: must be 200 + PEM body (not SPA HTML).
app.get('/.well-known/appspecific/com.tesla.3p.public-key.pem', (req, res) => {
  if (!fs.existsSync(TESLA_PUBLIC_KEY_PEM)) {
    return res
      .status(404)
      .type('text/plain')
      .send('Public key missing from build output. Run npm run build and redeploy.')
  }
  res.setHeader('Content-Type', 'application/x-pem-file')
  res.sendFile(TESLA_PUBLIC_KEY_PEM)
})

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
