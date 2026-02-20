/**
 * Blog articles registry. Add new articles here and create a corresponding file.
 */

import HelloWorldArticle, { meta as helloWorldMeta } from './hello-world'
import SoftwareEngineersAgeOfAIArticle, { meta as softwareEngineersMeta } from './software-engineers-age-of-ai'

export const articles = [
  {
    slug: softwareEngineersMeta.slug,
    meta: softwareEngineersMeta,
    Component: SoftwareEngineersAgeOfAIArticle,
  },
  {
    slug: helloWorldMeta.slug,
    meta: helloWorldMeta,
    Component: HelloWorldArticle,
  },
]

export function getArticleBySlug(slug) {
  return articles.find((a) => a.slug === slug)
}
