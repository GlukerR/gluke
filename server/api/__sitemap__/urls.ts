import { queryCollection } from '@nuxt/content/server'
import { DEFAULT_LOCALE, LOCALE_CODES } from '#shared/i18n'

/**
 * Источник динамических URL для sitemap: опубликованные кейсы, статьи базы
 * знаний и глоссарий из Nuxt Content 3.
 *
 * `lastmod` берётся из поля `updated`, которое проставляет `pnpm lastmod` из
 * git-истории (см. scripts/update-lastmod.mjs). Считать дату прямо здесь нельзя:
 * handler живёт в рантайме, где git-истории нет вовсе. На сборке Vercel даты
 * пересчитывает buildCommand (`git fetch --unshallow && pnpm lastmod`) — полная
 * история даёт реальные даты по каждому файлу; без неё используются
 * закоммиченные `updated`.
 *
 * У кейса и статьи два файла — RU и EN, — а URL после `_i18nTransform` один
 * на пару, поэтому берётся более поздняя из двух дат: правка любой локали
 * означает, что страницу стоит переобойти. Что пара всегда полная, проверяет
 * `pnpm validate:content`.
 */
export default defineSitemapEventHandler(async (event) => {
  const projects = await queryCollection(event, 'projects')
    .where('status', '=', 'published')
    .select('slug', 'position', 'locale', 'updated')
    .all()

  const latestBySlug = new Map<string, string | undefined>()
  const positionBySlug = new Map<string, number>()

  for (const project of projects) {
    const known = latestBySlug.get(project.slug)
    if (!known || (project.updated && project.updated > known)) {
      latestBySlug.set(project.slug, project.updated ?? known)
    }
    if (project.locale === DEFAULT_LOCALE) {
      positionBySlug.set(project.slug, project.position)
    }
  }

  const articles = await queryCollection(event, 'knowledge')
    .where('status', '=', 'published')
    .select('slug', 'updated')
    .all()

  const articleUpdated = new Map<string, string | undefined>()
  for (const article of articles) {
    const known = articleUpdated.get(article.slug)
    if (!known || (article.updated && article.updated > known)) {
      articleUpdated.set(article.slug, article.updated ?? known)
    }
  }

  /* Глоссарий — один адрес на пару файлов ru/en, дата — более поздняя. */
  const glossary = await queryCollection(event, 'glossary')
    .select('updated')
    .all()
  const glossaryUpdated = glossary.map(item => item.updated).filter(Boolean).sort().at(-1)

  const site = await queryCollection(event, 'site')
    .where('locale', 'IN', LOCALE_CODES as unknown as string[])
    .select('updated')
    .all()

  /* Главная меняется вместе с содержимым site/*.yml, страница «Проекты» — вместе
     с любым кейсом в списке. */
  const siteUpdated = site.map(item => item.updated).filter(Boolean).sort().at(-1)
  const projectsUpdated = [...latestBySlug.values()].filter(Boolean).sort().at(-1)

  const caseUrls = [...positionBySlug.keys()]
    .sort((a, b) => (positionBySlug.get(a) ?? 0) - (positionBySlug.get(b) ?? 0))
    .map(slug => ({
      loc: `/projects/${slug}`,
      lastmod: latestBySlug.get(slug),
      _i18nTransform: true,
    }))

  /* Хаб базы знаний меняется вместе с любой статьёй в нём. */
  const knowledgeUpdated = [...articleUpdated.values()].filter(Boolean).sort().at(-1)

  const articleUrls = [...articleUpdated.keys()]
    .sort()
    .map(slug => ({
      loc: `/knowledge/${slug}`,
      lastmod: articleUpdated.get(slug),
      _i18nTransform: true,
    }))

  return [
    { loc: '/', lastmod: siteUpdated, _i18nTransform: true },
    { loc: '/projects', lastmod: projectsUpdated, _i18nTransform: true },
    ...caseUrls,
    ...(articleUrls.length
      ? [{ loc: '/knowledge', lastmod: knowledgeUpdated, _i18nTransform: true }, ...articleUrls]
      : []),
    ...(glossary.length
      ? [{ loc: '/knowledge/glossary', lastmod: glossaryUpdated, _i18nTransform: true }]
      : []),
  ]
})
