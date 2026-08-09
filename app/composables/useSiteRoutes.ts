import type { RouteLocationRaw } from 'vue-router'
import type { SiteNavigationItem } from '~/config/site-navigation'

export interface SiteRoutes {
  home: () => string
  projects: () => string
  project: (slug: string) => string
  navigation: (item: SiteNavigationItem) => RouteLocationRaw
}

/**
 * Единственное место, где собираются публичные внутренние ссылки.
 *
 * Все пути проходят через `useLocalePath()`, поэтому префикс `/ru` не пишется
 * руками ни в одном компоненте, а внутренний content-path нигде не используется.
 */
export function useSiteRoutes(): SiteRoutes {
  const localePath = useLocalePath()

  return {
    home: () => localePath('index'),
    projects: () => localePath('projects'),
    project: (slug: string) => localePath({ name: 'projects-slug', params: { slug } }),
    /* Якорь передаётся объектом маршрута: так router сам собирает хэш
       и локализованный путь не склеивается строками. */
    navigation: (item: SiteNavigationItem) => ({
      path: localePath(item.route),
      hash: item.hash,
    }),
  }
}
