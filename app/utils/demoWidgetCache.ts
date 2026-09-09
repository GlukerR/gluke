/* Полноэкранный hero-режим (сплэш на весь верх страницы, канвас заливает
   и строку «Вернуться», и фон под хедером) поддерживают не все виджеты:
   сейчас это звёздное поле — оно специально делалось «на весь экран».
   Пирамида живёт обычной колонкой справа от текста (без рамки и фона),
   поэтому в списке её нет. Новый bleed-виджет добавляется в этот список
   одной строкой — шаблон уже общий. */
export const BLEED_DEMO_WIDGETS = ['constellation'] as const

export function isBleedDemoWidget(widget: string | null | undefined): boolean {
  return !!widget && (BLEED_DEMO_WIDGETS as readonly string[]).includes(widget)
}

/* Кэш живых WebGL-виджетов кейсов (пирамида, звёздное поле, лава,
   облако точек, портрет из частиц) между
   перемонтированиями компонентов. Смена языка перемонтирует страницу кейса
   целиком: без кэша каждый показ создавал виджет заново — компилировал
   шейдеры, заводил новый WebGL-контекст и заново качал логотипы призмы.
   Вместо destroy() компоненты зовут detach() (снять канвас и слушатели,
   оставив ресурсы в инстансе), а при следующем показе reattach() цепляет
   сохранённый инстанс к новому DOM-узлу. Работает и при возврате на кейс
   с других страниц, не только при смене языка. Тот же приём, что
   viewerCache (three.js-вьюверы) и glukeLogo3dCache (модель на главной). */

export interface DemoWidgetInstance {
  /** Снять виджет с контейнера, сохранив WebGL-ресурсы для перецепления. */
  detach: () => void
  /** Перецепить сохранённый виджет на новый контейнер и запустить рендер. */
  reattach: (el: HTMLElement) => void
  /** Полностью освободить ресурсы (вытеснение из кэша). */
  destroy: () => void
}

/* Ключ — тип виджета + вариант размещения: на одной странице живут два
   инстанса одного виджета (hero/bleed в шапке + tunable в секции), и они
   не должны делить канвас. Вариант уникален в рамках сайта, поэтому ключ
   стабилен и не зависит от локали — при смене языка инстанс находится
   и перецепляется, а не создаётся заново. */
export function demoWidgetKey(widget: string, variant: string): string {
  return `${widget}:${variant}`
}

/* Потолок одновременно кэшируемых инстансов: каждый держит свой
   WebGL-контекст, а браузеры ограничивают их число. Сейчас на сайте всего
   пять кейсов с виджетами, но на одной странице их одновременно максимум
   два — hero и лаборатория. Лимит страхует переходы между кейсами: без
   него контексты копились бы до браузерного потолка. */
const MAX_INSTANCES = 4

const items = new Map<string, DemoWidgetInstance>()

export function getDemoWidget<T extends DemoWidgetInstance>(key: string): T | undefined {
  const instance = items.get(key)
  if (instance) {
    /* Обновляем позицию в LRU: переносим запись в конец. */
    items.delete(key)
    items.set(key, instance)
  }
  return instance as T | undefined
}

export function setDemoWidget(key: string, instance: DemoWidgetInstance) {
  items.delete(key)
  items.set(key, instance)

  while (items.size > MAX_INSTANCES) {
    const oldest = items.keys().next().value
    if (oldest === undefined) break
    const evicted = items.get(oldest)
    items.delete(oldest)
    if (evicted) evicted.destroy()
  }
}
