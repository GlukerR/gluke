/* Яндекс.Метрика.
   Подключается только на клиенте и только если задан ID счётчика
   (runtimeConfig.public.yandexMetrikaId из NUXT_PUBLIC_YM_ID).
   Без переменной окружения плагин ничего не делает — сайт не грузит
   скрипт Метрики и не шлёт никаких запросов. */

export default defineNuxtPlugin(() => {
  const { yandexMetrikaId } = useRuntimeConfig().public
  const id = String(yandexMetrikaId ?? '').trim()

  if (!id) {
    return
  }

  const doc = document

  /* Основной скрипт Метрики (асинхронный, по стандартному сниппету Яндекса). */
  const script = doc.createElement('script')
  script.type = 'text/javascript'
  script.async = true
  script.src = 'https://mc.yandex.ru/metrika/tag.js'
  doc.head.appendChild(script)

  /* Сам вызов ym(id, 'init', ...) — стандартные опции Метрики. */
  const init = () => {
    const w = window as Window & { ym?: (...args: unknown[]) => void }
    if (typeof w.ym !== 'function') {
      return
    }
    w.ym(id, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
    })
  }

  script.onload = () => init()

  /* noscript-пиксель для посетителей без JS. */
  const noscript = doc.createElement('noscript')
  const img = doc.createElement('img')
  img.src = `https://mc.yandex.ru/watch/${id}`
  img.style.position = 'absolute'
  img.style.left = '-9999px'
  img.alt = ''
  noscript.appendChild(img)
  doc.body.appendChild(noscript)
})
