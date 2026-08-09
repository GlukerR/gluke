import { queryCollection } from '@nuxt/content/server'
import { DEFAULT_LOCALE } from '#shared/i18n'

/**
 * Источник динамических URL для sitemap: опубликованные кейсы из Nuxt Content 3.
 * lastmod намеренно не указывается — достоверных дат изменения в контенте нет.
 */
export default defineSitemapEventHandler(async (event) => {
  /* Публичные URL строятся из slug локали по умолчанию: внутренний content-path
     (`/projects/en/getic`) никогда не попадает в sitemap.
     `_i18nTransform` разворачивает каждый маршрут в пару EN/RU с alternates. */
  const projects = await queryCollection(event, 'projects')
    .where('locale', '=', DEFAULT_LOCALE)
    .where('status', '=', 'published')
    .order('position', 'ASC')
    .select('slug')
    .all()

  return projects.map(project => ({
    loc: `/projects/${project.slug}`,
    _i18nTransform: true,
  }))
})
