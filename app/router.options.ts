import type { RouterConfig } from 'nuxt/schema'
import { DEFAULT_LOCALE, SITE_LOCALES } from '#shared/i18n'

/**
 * Поведение прокрутки при навигации.
 *
 * Стратегия локалей `prefix_except_default`: русская версия живёт под `/ru`,
 * английская — без префикса. Переключение языка — это переход на ту же страницу
 * с другим префиксом локали, и по умолчанию роутер прокручивает её наверх.
 * Здесь такой переход исключается: страница остаётся на том же месте.
 */
const nonDefaultLocalePrefixes = SITE_LOCALES
  .filter(locale => locale.code !== DEFAULT_LOCALE)
  .map(locale => `/${locale.code}`)

function withoutLocalePrefix(path: string): string {
  for (const prefix of nonDefaultLocalePrefixes) {
    if (path === prefix) return '/'
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length)
  }
  return path
}

export default <RouterConfig>{
  async scrollBehavior(to, from, savedPosition) {
    /* Смена языка: тот же путь без префикса, те же query и hash.
       Возврат `false` отключает прокрутку — позиция сохраняется. */
    const samePage = withoutLocalePrefix(to.path) === withoutLocalePrefix(from.path)
      && JSON.stringify(to.query) === JSON.stringify(from.query)

    if (samePage && to.hash === from.hash) {
      return false
    }

    /* Возврат на сохранённую позицию при навигации «назад»/«вперёд». */
    if (savedPosition) {
      return savedPosition
    }

    /* Hash-навигацию выполняет hash-scroll.client после route transition,
       когда DOM целевой страницы уже смонтирован. */
    if (to.hash) {
      return false
    }

    /* Обычный переход на другую страницу — наверх. */
    return { top: 0 }
  },
}
