import {
  COUNTRY_HEADER,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  RUSSIAN_LOCALE,
  isLocaleCode,
  localeForCountry,
} from '#shared/i18n'
import type { LocaleCode } from '#shared/i18n'

const ROOT_PATH = '/'
const RUSSIAN_ROOT_PATH = '/ru'

/**
 * Первичный выбор языка по стране выполняется ровно один раз — только для GET/HEAD корня.
 *
 * Прямые ссылки (`/projects/getic`, `/ru/projects/getic`) никогда не перенаправляются:
 * пользователь мог получить ссылку на нужном языке, и её нельзя ломать.
 *
 * Ручной выбор в cookie всегда приоритетнее страны. Страна пользователя нигде не сохраняется:
 * заголовок читается только для этого решения.
 */
export default defineEventHandler((event) => {
  const method = event.method

  if (method !== 'GET' && method !== 'HEAD') {
    return
  }

  /* getRequestPath включает query, поэтому сравнивается только путь. */
  const path = getRequestURL(event).pathname

  if (path !== ROOT_PATH) {
    return
  }

  const cookieValue = getCookie(event, LOCALE_COOKIE_NAME)
  /* Неизвестное значение cookie считается отсутствующим и перезаписывается. */
  const storedLocale = isLocaleCode(cookieValue) ? cookieValue : undefined

  const locale: LocaleCode = storedLocale
    ?? localeForCountry(getRequestHeader(event, COUNTRY_HEADER))

  /* Ответ на корне персонализирован, поэтому общий CDN-кэш для него запрещён.
     Остальные маршруты сюда не попадают и своё кэширование сохраняют. */
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Vary', 'Cookie, X-Vercel-IP-Country')

  if (storedLocale !== locale) {
    setCookie(event, LOCALE_COOKIE_NAME, locale, {
      path: ROOT_PATH,
      sameSite: 'lax',
      httpOnly: false,
      secure: getRequestURL(event).protocol === 'https:',
      maxAge: LOCALE_COOKIE_MAX_AGE,
    })
  }

  /* Английский — локаль по умолчанию и живёт на самом корне,
     поэтому редирект возможен только в сторону /ru: цикл исключён. */
  if (locale === RUSSIAN_LOCALE) {
    return sendRedirect(event, RUSSIAN_ROOT_PATH, 302)
  }
})
