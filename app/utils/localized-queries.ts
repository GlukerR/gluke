import type { LocaleCode } from '#shared/i18n'

/**
 * Все обращения к контенту проходят через эти хелперы, чтобы фильтр по локали
 * нельзя было забыть: коллекции хранят обе версии в одном индексе.
 */
export function queryLocalizedSite(locale: LocaleCode) {
  return queryCollection('site').where('locale', '=', locale)
}

/* Порядок архива (`position`) страницы задают сортировкой в JS, а не
   `.order('position', 'ASC')`: в базе контента поле сравнивается как строка,
   и запрос дал бы 1, 10, 11, 2… (проверено на выдаче, §88). */
export function queryLocalizedProjects(locale: LocaleCode) {
  return queryCollection('projects')
    .where('locale', '=', locale)
    .where('status', '=', 'published')
}

export function queryLocalizedProject(locale: LocaleCode, slug: string) {
  return queryLocalizedProjects(locale).where('slug', '=', slug)
}
