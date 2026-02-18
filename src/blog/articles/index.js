/**
 * Blog articles registry. Add new articles here and create a corresponding file.
 */

import HelloWorldArticle, { meta as helloWorldMeta } from './hello-world'

export const articles = [
  {
    slug: helloWorldMeta.slug,
    meta: helloWorldMeta,
    Component: HelloWorldArticle,
  },
]

export function getArticleBySlug(slug) {
  return articles.find((a) => a.slug === slug)
}
