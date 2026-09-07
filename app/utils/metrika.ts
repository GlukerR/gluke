/* Отправка событий в Яндекс.Метрику из не-компонентного кода: error.vue и
   глобальный обработчик JS-ошибок (app/plugins/error-tracker.client.ts).
   Сам скрипт Метрики грузит app/plugins/yandex-metrika.client.ts; он передаёт
   сюда ID счётчика (configureMetrika) и сигналит о готовности после
   ym(id, 'init') (metrikaReady).

   Пока Метрика не инициализировалась (скрипт ещё качается), события копятся
   в очереди и уходят после init — ошибка на старте сессии не теряется.
   Без ID счётчика (нет NUXT_PUBLIC_YM_ID) всё превращается в no-op. */

let counterId = ''
let ready = false

const queue: Array<{ target: string, params?: Record<string, unknown> }> = []

/* Очередь ограничена: если Метрика так и не загрузилась (счётчик удалён,
   скрипт заблокирован), старые события не должны копиться бесконечно. */
const QUEUE_LIMIT = 50

type YmWindow = Window & { ym?: (...args: unknown[]) => void }

function ymAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as YmWindow).ym === 'function'
}

function send(target: string, params?: Record<string, unknown>) {
  const w = window as YmWindow
  w.ym?.(counterId, 'reachGoal', target, params)
}

export function configureMetrika(id: string) {
  counterId = id.trim()
}

export function metrikaReady() {
  ready = true
  flush()
}

function flush() {
  if (!ready || !ymAvailable()) {
    return
  }
  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) {
      break
    }
    send(item.target, item.params)
  }
}

export function trackMetrika(target: string, params?: Record<string, unknown>) {
  if (import.meta.server || !counterId) {
    return
  }
  if (ready && ymAvailable()) {
    send(target, params)
    return
  }
  if (queue.length < QUEUE_LIMIT) {
    queue.push({ target, params })
  }
}
