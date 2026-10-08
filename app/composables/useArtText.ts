import type { LocaleCode } from '#shared/i18n'
import type { ComputedRef } from 'vue'

/**
 * Подписи внутри схем базы знаний.
 *
 * Схема — самостоятельный SVG-компонент, и её подписи живут рядом с
 * рисунком, а не в общих `i18n/locales/*.ts`: их координаты подобраны под
 * длину текста, и править одно без другого нельзя. Набор подписей у обеих
 * локалей один и тот же — это проверяет тип.
 */
export function useArtText<T extends Record<string, string>>(
  text: Record<LocaleCode, T>,
): ComputedRef<T> {
  const locale = useCurrentLocale()

  return computed(() => text[locale.value])
}
