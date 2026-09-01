import { queryCollection } from '@nuxt/content/server'
import { DEFAULT_LOCALE, LOCALE_CODES } from '#shared/i18n'

/**
 * Источник динамических URL для sitemap: опубликованные кейсы из Nuxt Content 3.
 *
 * `lastmod` берётся из поля `updated`, которое проставляет `pnpm lastmod` из
 * git-истории (см. scripts/update-lastmod.mjs). Считать дату прямо здесь нельзя:
 * production собирает Vercel с поверхностным клоном, где `git log` по файлу
 * возвращает одну и ту же дату для всего контента.
 *
 * У кейса два файла — RU и EN, — а URL после `_i18nTransform` один на пару,
 * поэтому берётся более поздняя из двух дат: правка любой локали означает, что
 * страницу стоит переобойти.
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

  return [
    { loc: '/', lastmod: siteUpdated, _i18nTransform: true },
    { loc: '/projects', lastmod: projectsUpdated, _i18nTransform: true },
    ...caseUrls,
  ]
})
