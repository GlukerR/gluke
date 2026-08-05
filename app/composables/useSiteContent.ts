import type { SiteCollectionItem } from '@nuxt/content'
import type { InjectionKey } from 'vue'

/**
 * Глобальный singleton `site` загружается ровно один раз в `layouts/default.vue`
 * и раздаётся вложенным компонентам через provide/inject, без повторных запросов.
 */
const siteContentKey: InjectionKey<SiteCollectionItem> = Symbol('gluke:site-content')

export function provideSiteContent(site: SiteCollectionItem): void {
  provide(siteContentKey, site)
}

export function useSiteContent(): SiteCollectionItem {
  const site = inject(siteContentKey, null)

  if (!site) {
    throw new Error(
      'useSiteContent() вызван вне провайдера. Компонент должен рендериться внутри layouts/default.vue, который вызывает provideSiteContent(site).',
    )
  }

  return site
}
