/* Глобальный перехват JS-ошибок для Яндекс.Метрики.
   window 'error' + 'unhandledrejection' ловят всё, что не обработано
   приложением, и шлют в Метрику одной целью `js_error` (params — детали).
   Работает только при заданном NUXT_PUBLIC_YM_ID: без счётчика слушатели
   не вешаются вовсе, нулевой оверхед. Одинаковые ошибки дедуплицируются,
   чтобы падающий в цикле код не засорял отчёт тысячами одинаковых целей. */

export default defineNuxtPlugin((nuxtApp) => {
  const { yandexMetrikaId } = useRuntimeConfig().public

  if (!String(yandexMetrikaId ?? '').trim()) {
    return
  }

  const seen = new Set<string>()

  /* Держим только недавние ключи: иначе долгая сессия с разными ошибками
     раздула бы память навсегда. 100 — с запасом на любой реальный сценарий. */
  function markSeen(key: string): boolean {
    if (seen.has(key)) {
      return true
    }
    seen.add(key)
    if (seen.size > 100) {
      seen.clear()
    }
    return false
  }

  /* Параметры уходят в Метрику целиком, поэтому обрезаем до разумных
     размеров: сообщение и стек нужны для разбора, не для чтения целиком. */
  function clip(value: string | undefined, limit: number): string | undefined {
    const text = value?.trim()
    return text ? (text.length > limit ? `${text.slice(0, limit)}…` : text) : undefined
  }

  function stackOf(error: unknown): string | undefined {
    return clip(error instanceof Error ? (error.stack ?? '') : undefined, 800)
  }

  function report(key: string, params: Record<string, unknown>) {
    if (markSeen(key)) {
      return
    }
    trackMetrika('js_error', {
      url: location.href,
      ...params,
    })
  }

  window.addEventListener('error', (event) => {
    const errorEvent = event as ErrorEvent
    const error = errorEvent.error

    /* Ресурсные ошибки (img/script не загрузился) приходят сюда без message:
       это не баг приложения, а сетевая проблема — в JS-ошибки не пишем. */
    const message = clip(errorEvent.message, 300) ?? clip(error instanceof Error ? error.message : '', 300)
    if (!message) {
      return
    }

    report(`${message}|${errorEvent.filename ?? ''}|${errorEvent.lineno ?? 0}`, {
      kind: 'exception',
      message,
      filename: errorEvent.filename ?? undefined,
      line: errorEvent.lineno ?? undefined,
      column: errorEvent.colno ?? undefined,
      stack: stackOf(error),
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = clip(reason instanceof Error ? reason.message : String(reason), 300)
    if (!message) {
      return
    }

    report(`rejection|${message}`, {
      kind: 'unhandledrejection',
      message,
      stack: stackOf(reason instanceof Error ? reason : undefined),
    })
  })

  /* Vue перехватывает ошибки рендера/компонентов сам — до window 'error' они
     не доходят. Прокидываем их в тот же `js_error` через errorHandler. */
  const vueApp = nuxtApp.vueApp
  const previousErrorHandler = vueApp.config.errorHandler

  vueApp.config.errorHandler = (error, instance, info) => {
    const message = clip(error instanceof Error ? error.message : String(error), 300)
    if (message) {
      report(`vue|${message}`, {
        kind: 'vue',
        message,
        info: clip(String(info ?? ''), 300),
        component: clip(instance?.$options?.name, 100),
        stack: stackOf(error instanceof Error ? error : undefined),
      })
    }

    if (typeof previousErrorHandler === 'function') {
      previousErrorHandler(error, instance, info)
    }
  }
})
