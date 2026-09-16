/**
 * Политика кэша ответов: один класс ответов — один набор директив.
 *
 * Здесь же лежит и применение наборов к маршрутам (`CACHE_ROUTE_RULES`) — в
 * `nuxt.config.ts` `routeRules` получает его целиком. Модуль общий, потому что
 * значение директив нужно в трёх местах сразу: конфигу Nuxt, проверке
 * заголовков на собранном сервере (`scripts/check-cache-headers.mjs`) и
 * валидатору конфигурации деплоя (`scripts/validate-content.mjs`). Пока эти
 * значения были записаны в каждом месте отдельно, они разъезжались: правило
 * `/media/(.*)` в `vercel.json` обещало час, а в ответе стояли страничные
 * шестьдесят секунд (`docs/changes-log.md` §76).
 *
 * Каждый набор уходит **двумя** заголовками: `cache-control` и тот же набор в
 * `cdn-cache-control`. Это не перестраховка. `cache-control` читают браузер и
 * промежуточный кэш, но Vercel вырезает из него `s-maxage`,
 * `stale-while-revalidate` и `stale-if-error`, когда ответ отдаёт серверная
 * функция: кэш по ним работает, а в ответе браузеру вместо них стоит
 * `public, max-age=0`. `cdn-cache-control` платформа, наоборот, и читает первой
 * по старшинству, и возвращает клиенту без изменений, поэтому только в нём
 * задуманный набор видно целиком.
 * Источник: vercel.com/docs/headers/cache-control-headers («Behavior»).
 */

/** Страницы: язык лежит в пути, содержимое одинаково для всех. */
export const PAGE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400, stale-if-error=604800'

/** Варианты картинок ipx: адрес версионируется отпечатком — браузеру можно сутки. */
export const IMAGE_CACHE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, stale-if-error=604800'

/**
 * Файлы `public/**` и варианты `/_vercel/image`: адрес не версионируется,
 * поэтому в браузере час. Варианты Vercel собирает из пути исходника, и
 * модификатор версии в такой адрес не попадает — значит нет и повода держать
 * копию в браузере дольше.
 */
export const MEDIA_CACHE = 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800, stale-if-error=604800'

/**
 * Один класс ответов: `cache-control` плюс тот же набор в `cdn-cache-control`.
 *
 * @param {string} directives
 * @returns {{ 'cache-control': string, 'cdn-cache-control': string }}
 */
export function cacheHeaders(directives) {
  return { 'cache-control': directives, 'cdn-cache-control': directives }
}

/**
 * Маршруты кэша для `routeRules` в `nuxt.config.ts`.
 *
 * `/_vercel/image` обязателен: на Vercel варианты картинок отдаёт платформенный
 * оптимизатор, адрес в разметке другой, чем у `/_ipx/**`, и без своей строки
 * такой запрос попадал бы под `/**` — картинки получали бы страничные 60 секунд
 * на CDN вместо недели.
 *
 * @type {Record<string, { headers: { 'cache-control': string, 'cdn-cache-control': string } }>}
 */
export const CACHE_ROUTE_RULES = {
  '/**': { headers: cacheHeaders(PAGE_CACHE) },
  '/_ipx/**': { headers: cacheHeaders(IMAGE_CACHE) },
  '/_vercel/image': { headers: cacheHeaders(MEDIA_CACHE) },
  '/media/**': { headers: cacheHeaders(MEDIA_CACHE) },
}

/** Заголовок-зеркало, в котором директивы доезжают до клиента целыми. */
export const CACHE_MIRROR_HEADER = 'cdn-cache-control'

/**
 * Разбор набора в карту директив: проверкам нужны конкретные сроки, а не строка
 * целиком — иначе проверка перестаёт замечать подмену одной директивы другой.
 *
 * @param {string} directives
 * @returns {Record<string, string>}
 */
export function parseDirectives(directives) {
  /** @type {Record<string, string>} */
  const parsed = {}

  for (const part of directives.split(',')) {
    const [name, value = ''] = part.trim().split('=')
    parsed[name] = value
  }

  return parsed
}
