/**
 * Build-time script: extract article meta from .jsx files and write
 * public/articles-meta.json for the server to use when injecting OG tags.
 */
const fs = require('fs')
const path = require('path')

const articlesDir = path.join(__dirname, '../src/blog/articles')
const outPath = path.join(__dirname, '../public/articles-meta.json')

const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.jsx'))

const metaRe = /export\s+const\s+meta\s*=\s*\{([\s\S]*?)\}\s*(?:;|\n\s*export)/m
const titleRe = /title:\s*['"]([^'"]*)['"]/
const dateRe = /date:\s*['"]([^'"]*)['"]/
const slugRe = /slug:\s*['"]([^'"]*)['"]/
// Match preview string (allows \' inside)
const previewRe = /preview:\s*['"]((?:[^'"\\]|\\.)*)['"]/

const articles = []

for (const file of files) {
  const content = fs.readFileSync(path.join(articlesDir, file), 'utf8')
  const metaBlock = content.match(metaRe)
  if (!metaBlock) continue
  const block = metaBlock[1]
  const title = block.match(titleRe)?.[1]
  const date = block.match(dateRe)?.[1]
  const slug = block.match(slugRe)?.[1]
  const preview = block.match(previewRe)?.[1]
  if (slug && title) {
    articles.push({
      slug,
      title,
      date: date || '',
      preview: preview ? preview.replace(/\\'/g, "'") : '',
    })
  }
}

fs.writeFileSync(outPath, JSON.stringify(articles, null, 2), 'utf8')
console.log('Wrote', outPath, 'with', articles.length, 'articles')
