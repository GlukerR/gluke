import type { SiteCollectionItem } from '@nuxt/content'
import type { InjectionKey, Ref } from 'vue'

/**
 * Глобальный singleton `site` загружается ровно один раз в `layouts/default.vue`
 * и раздаётся вложенным компонентам через provide/inject, без повторных запросов.
 *
 * Значение реактивно относительно текущей локали: при смене языка запрос
 * повторяется в layout, а все потребители получают обновлённый контент
 * без полной перезагрузки страницы.
 */
export type SiteContentRef = Readonly<Ref<SiteCollectionItem>>

const siteContentKey: InjectionKey<SiteContentRef> = Symbol('gluke:site-content')

export function provideSiteContent(site: SiteContentRef): void {
  provide(siteContentKey, site)
}

export function useSiteContent(): SiteContentRef {
  const site = inject(siteContentKey, null)

  if (!site) {
    throw new Error(
      'useSiteContent() вызван вне провайдера. Компонент должен рендериться внутри layouts/default.vue, который вызывает provideSiteContent(site).',
    )
  }

  return site
}
