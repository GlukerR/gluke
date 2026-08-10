/**
 * Единственный источник констант локализации.
 * Импортируется из nuxt.config.ts, server middleware, sitemap endpoint и приложения,
 * чтобы коды локалей и имя cookie не размножались строками по проекту.
 */

export const LOCALE_CODES = ['en', 'ru'] as const

export type LocaleCode = typeof LOCALE_CODES[number]

export const DEFAULT_LOCALE: LocaleCode = 'en'

export const RUSSIAN_LOCALE: LocaleCode = 'ru'

/** Значение cookie меняется из UI, поэтому cookie не HttpOnly. */
export const LOCALE_COOKIE_NAME = 'gluke_locale'

/** 400 дней — верхняя граница, которую браузеры сохраняют для cookie, и это больше требуемого года. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400

/** Грубое определение страны на Vercel: единственный разрешённый источник гео-сигнала. */
export const COUNTRY_HEADER = 'x-vercel-ip-country'

/** Запасной сигнал: языковые предпочтения браузера. */
export const ACCEPT_LANGUAGE_HEADER = 'accept-language'

export const RUSSIAN_COUNTRY_CODE = 'RU'

export interface SiteLocaleOption {
  readonly code: LocaleCode
  readonly language: string
  readonly name: string
  readonly short: string
  readonly file: string
}

/** Параметры локалей для Nuxt i18n и для переключателя языка. */
export const SITE_LOCALES: readonly SiteLocaleOption[] = [
  {
    code: 'en',
    language: 'en-US',
    name: 'English',
    short: 'EN',
    file: 'en.ts',
  },
  {
    code: 'ru',
    language: 'ru-RU',
    name: 'Русский',
    short: 'RU',
    file: 'ru.ts',
  },
] as const

/** Open Graph использует форму `en_US`, тогда как BCP 47 и hreflang — `en-US`. */
export function toOpenGraphLocale(language: string): string {
  return language.replace('-', '_')
}

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && (LOCALE_CODES as readonly string[]).includes(value)
}

/** Россия — русский. Для любого другого или отсутствующего значения сигнала нет. */
export function localeForCountry(country: string | undefined | null): LocaleCode | undefined {
  return country?.toUpperCase() === RUSSIAN_COUNTRY_CODE ? RUSSIAN_LOCALE : undefined
}

/**
 * Разбор Accept-Language: теги сортируются по q и берётся первый поддерживаемый язык.
 * Регион тега игнорируется: `ru-KZ` и `ru` ведут на одну и ту же локаль.
 */
export function localeForAcceptLanguage(header: string | undefined | null): LocaleCode | undefined {
  if (!header) {
    return undefined
  }

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(';')
      const quality = parameters
        .map(parameter => parameter.trim())
        .find(parameter => parameter.startsWith('q='))
      const parsedQuality = quality ? Number.parseFloat(quality.slice(2)) : 1

      return {
        language: tag?.trim().toLowerCase().split('-')[0] ?? '',
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
      }
    })
    /* Теги с q=0 явно отвергнуты клиентом, а `*` не несёт предпочтения. */
    .filter(entry => entry.quality > 0)
    .sort((first, second) => second.quality - first.quality)

  for (const entry of ranked) {
    if (isLocaleCode(entry.language)) {
      return entry.language
    }
  }

  return undefined
}

/**
 * Бизнес-правило первичного выбора языка: сначала страна, затем язык браузера,
 * иначе локаль по умолчанию. Нужен второй сигнал, потому что гео-заголовка может не быть
 * или IP определяется неверно. Ни страна, ни список языков нигде не сохраняются.
 */
export function localeForRequest(
  country: string | undefined | null,
  acceptLanguage: string | undefined | null,
): LocaleCode {
  return localeForCountry(country)
    ?? localeForAcceptLanguage(acceptLanguage)
    ?? DEFAULT_LOCALE
}
