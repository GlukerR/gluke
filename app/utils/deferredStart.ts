/*
 * Отложенный старт тяжёлой сцены (three.js, WebGL-виджет): сначала ждём, пока
 * блок подойдёт к окну, потом — простоя браузера. Постер держит кадр вместо
 * сцены, поэтому ожидание не читается как пустое место, а движок с декодером
 * не отнимают главный поток у текста и первой отрисовки.
 *
 * Ступени включаются по отдельности: логотипу главной (он всегда на первом
 * экране) нужен только простой, демо-виджету — только приближение, вьюверу
 * модели и гаражу — обе. Раньше каждая копия жила в своём компоненте.
 */

export interface DeferredStartOptions {
  /** Ждать приближения блока к окну: отступ как у `rootMargin`. */
  nearMargin?: string
  /** Ждать простоя браузера, но не дольше этого, мс. */
  idleTimeout?: number
}

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

/**
 * Запускает `start` после выбранных ступеней. Возвращает отмену: вызванная до
 * старта, она снимает наблюдатель и ожидание простоя, и `start` не случится.
 */
export function deferStart(
  el: Element | null | undefined,
  start: () => void,
  options: DeferredStartOptions,
): () => void {
  const idleApi = globalThis as unknown as IdleWindow
  let cancelled = false
  let observer: IntersectionObserver | undefined
  let idleId: number | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const run = () => {
    if (!cancelled) start()
  }

  const afterNear = () => {
    if (cancelled) return
    const timeout = options.idleTimeout
    if (timeout === undefined) run()
    else if (typeof idleApi.requestIdleCallback === 'function') idleId = idleApi.requestIdleCallback(run, { timeout })
    else timeoutId = setTimeout(run, timeout)
  }

  if (options.nearMargin !== undefined && el && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry && !entry.isIntersecting) return
      observer?.disconnect()
      observer = undefined
      afterNear()
    }, { rootMargin: options.nearMargin })
    observer.observe(el)
  }
  else {
    afterNear()
  }

  return () => {
    cancelled = true
    observer?.disconnect()
    observer = undefined
    if (idleId !== undefined) idleApi.cancelIdleCallback?.(idleId)
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    idleId = undefined
    timeoutId = undefined
  }
}
