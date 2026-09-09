/* Предзагрузка данных кейса перед переходом: пейджер и карточки кейсов.
 *
 * Переходы между кейсами идут клиентски, и данные страницы кейса Nuxt Content
 * достаёт из браузерной базы — sqlite-dump коллекции скачивается и парсится
 * только при первом запросе. На наведении/фокусе на ссылку заранее качаем чанк
 * маршрута и «прогреваем» базу запросом целевого кейса — к моменту клика
 * остаётся только локальный рендер.
 *
 * Осторожность на слабых устройствах:
 * - dedupe по locale+slug на всю сессию (общий для карточек и пейджера —
 *   один и тот же кейс не запрашивается дважды);
 * - hover-intent: предзагрузка стартует не сразу, а через ~150 мс удержания
 *   курсора/фокуса. Быстрый проезд по сетке карточек ничего не качает, уход
 *   (pointerleave/focusout) отменяет намерение;
 * - старт откладывается до простоя браузера (requestIdleCallback): фоновая
 *   загрузка не конкурирует с догрузкой текущей страницы;
 * - на 2g/saveData и на сенсорных (coarse pointer) предзагрузка не запускается;
 * - медиа не предзагружаем: картинки/видео и так ленивые по вьюпорту, а их
 *   предзагрузка создавала бы конкуренцию за канал с текущей страницей.
 */

import { isCoarsePointer } from '~/utils/touchScroll'

const HOVER_INTENT_MS = 150

/* Верхняя граница ожидания простоя: даже при вечно занятой странице
   предзагрузка в итоге выполнится, а не потеряется навсегда. */
const IDLE_TIMEOUT_MS = 3000

const prefetchedKeys = new Set<string>()

function isSlowConnection(): boolean {
  if (import.meta.server) return false

  const connection = (navigator as Navigator & {
    connection?: {
      saveData?: boolean
      effectiveType?: string
    }
  }).connection

  return Boolean(connection && ((connection.saveData ?? false) || /2g/.test(connection.effectiveType ?? '')))
}

export function useCasePrefetch() {
  const locale = useCurrentLocale()
  const { project: projectPath } = useSiteRoutes()

  /* Намерение на элемент: пока «задумались» над карточкой, уход курсора/фокуса
     отменяет таймер — быстрый проезд по сетке ничего не запускает. */
  const pending = new Map<Element, ReturnType<typeof setTimeout>>()

  /* Реальная предзагрузка — в простое браузера (после догрузки текущей
     страницы), а не в момент события. Без rIC — просто в следующем тике. */
  function runWhenIdle(action: () => void) {
    const w = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    }

    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(() => action(), { timeout: IDLE_TIMEOUT_MS })
    }
    else {
      setTimeout(action, 0)
    }
  }

  function doPrefetch(slug: string) {
    if (isSlowConnection() || isCoarsePointer()) return

    const key = `${locale.value}:${slug}`
    if (prefetchedKeys.has(key)) return
    prefetchedKeys.add(key)

    void preloadRouteComponents(projectPath(slug)).catch(() => {})
    void queryLocalizedProject(locale.value, slug).first().catch(() => {})
  }

  function prefetchOnEnter(event: Event, slug: string | null | undefined) {
    const element = event.currentTarget as Element | null
    if (!slug || !element || import.meta.server) return
    if (isSlowConnection() || isCoarsePointer()) return

    prefetchOnLeave(event)

    const timer = setTimeout(() => {
      pending.delete(element)
      runWhenIdle(() => doPrefetch(slug))
    }, HOVER_INTENT_MS)

    pending.set(element, timer)
  }

  function prefetchOnLeave(event: Event) {
    const element = event.currentTarget as Element | null
    if (!element) return

    const timer = pending.get(element)
    if (timer === undefined) return

    clearTimeout(timer)
    pending.delete(element)
  }

  return { prefetchOnEnter, prefetchOnLeave }
}
