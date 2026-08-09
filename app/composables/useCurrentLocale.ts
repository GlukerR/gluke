import { DEFAULT_LOCALE, isLocaleCode } from '#shared/i18n'
import type { LocaleCode } from '#shared/i18n'
import type { ComputedRef } from 'vue'

/**
 * Сужает локаль i18n до кода, которым размечен контент.
 *
 * Проверка через `isLocaleCode` исключает рассинхронизацию между списком
 * локалей роутинга и локалями контента без приведения типов.
 */
export function useCurrentLocale(): ComputedRef<LocaleCode> {
  const { locale } = useI18n()

  return computed(() => (isLocaleCode(locale.value) ? locale.value : DEFAULT_LOCALE))
}
