/**
 * Blog articles registry. Add new articles here and create a corresponding file.
 */

import HelloWorldArticle, { meta as helloWorldMeta } from './hello-world'
import SoftwareEngineersAgeOfAIArticle, { meta as softwareEngineersMeta } from './software-engineers-age-of-ai'
import JuniorSoftwareEngineersInTheAIEraArticle, { meta as juniorEngineersMeta } from './junior-software-engineers-in-the-ai-era'
import ThingsILearnedInMarch2026Article, { meta as thingsILearnedInMarch2026Meta } from './things-i-learned-in-march-2026'
import BuildingYourOwnAIAssistantArticle, { meta as buildingYourOwnAIAssistantMeta } from './building-your-own-ai-assistant'

export const articles = [
  {
    slug: buildingYourOwnAIAssistantMeta.slug,
    meta: buildingYourOwnAIAssistantMeta,
    Component: BuildingYourOwnAIAssistantArticle,
  },
  {
    slug: thingsILearnedInMarch2026Meta.slug,
    meta: thingsILearnedInMarch2026Meta,
    Component: ThingsILearnedInMarch2026Article,
  },
  {
    slug: juniorEngineersMeta.slug,
    meta: juniorEngineersMeta,
    Component: JuniorSoftwareEngineersInTheAIEraArticle,
  },
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
