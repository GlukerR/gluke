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

/**
 * Бизнес-правило первичного выбора языка: Россия — русский, остальные страны — английский.
 * Страна пользователя нигде не сохраняется, используется только для этого решения.
 */
export function localeForCountry(country: string | undefined | null): LocaleCode {
  return country?.toUpperCase() === RUSSIAN_COUNTRY_CODE ? RUSSIAN_LOCALE : DEFAULT_LOCALE
}
