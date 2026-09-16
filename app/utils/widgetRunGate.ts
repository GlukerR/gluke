/*
 * Единый сторож кадров для WebGL-движков сайта.
 *
 * Раньше каждый движок хранил один булев флаг видимости и писал в него из двух
 * независимых источников: IntersectionObserver («блок в кадре») и
 * visibilitychange («вкладка активна»). Источники перекрывали друг друга: при
 * возврате на вкладку обработчик выставлял «видим», и блок, стоящий за экраном,
 * снова начинал считать кадры — до следующего пересечения, которого могло не
 * быть вовсе. Отдельно ломались выгрузки: detach() снимал канвас, но оставлял
 * флаг видимости и слушатель вкладки, поэтому кэшированный движок оживал без
 * канваса.
 *
 * Здесь три признака живут раздельно, а решение «можно считать кадры» —
 * производное от них. Модуль не знает ни про DOM, ни про WebGL: слушатели
 * подключает attachRunSources, а движок подписывается на изменения и запускает
 * либо гасит свой цикл.
 */

export interface RunGate {
  /** Блок прицеплен к документу: false — движок снят с контейнера. */
  setAttached(value: boolean): void
  /** Блок пересекается с вьюпортом (IntersectionObserver). */
  setIntersecting(value: boolean): void
  /** Вкладка документа активна (visibilitychange). */
  setDocumentVisible(value: boolean): void
  /** Можно ли прямо сейчас держать цикл кадров. */
  shouldRun(): boolean
  /** Подписка на изменение решения; возвращает функцию отписки. */
  subscribe(listener: (run: boolean) => void): () => void
}

export interface RunGateOptions {
  /* Гасить ли цикл, когда блок вне экрана. false — блок держит кадры всегда,
     пока жива вкладка. */
  pauseOffscreen?: boolean
}

export function createRunGate(options: RunGateOptions = {}): RunGate {
  const pauseOffscreen = options.pauseOffscreen !== false
  let attached = true
  let intersecting = true
  let documentVisible = true
  const listeners = new Set<(run: boolean) => void>()

  const shouldRun = () => attached && documentVisible && (intersecting || !pauseOffscreen)
  /* Новый сторож считается работающим с самого начала, поэтому подписчик
     получает уведомление только на настоящее изменение решения, а не на
     первый же вызов setter'а с тем же значением. */
  let last = shouldRun()

  const publish = () => {
    const run = shouldRun()
    if (run === last) return
    last = run
    /* Копия набора: слушатель вправе отписаться прямо в обработчике. */
    for (const listener of [...listeners]) listener(run)
  }

  const set = (apply: () => void) => {
    apply()
    publish()
  }

  return {
    setAttached(value) {
      set(() => {
        attached = !!value
      })
    },
    setIntersecting(value) {
      set(() => {
        intersecting = !!value
      })
    },
    setDocumentVisible(value) {
      set(() => {
        documentVisible = !!value
      })
    },
    shouldRun,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export interface RunSourceOptions extends RunGateOptions {
  /* Отступ от вьюпорта, внутри которого блок уже считается видимым. */
  rootMargin?: string
  threshold?: number
  /* Подмена источников для тестов: в node-окружении ни document, ни
     IntersectionObserver не существуют. */
  document?: Document
  IntersectionObserver?: typeof IntersectionObserver
}

export interface RunSources {
  /** Отписать источники и пометить движок отсоединённым. */
  disconnect(): void
}

/*
 * Подключает к сторожу оба источника: активность вкладки и пересечение с
 * вьюпортом. Возвращает ручку для detach(): снятый движок обязан её звать,
 * иначе слушатель вкладки переживёт свой канвас.
 */
export function attachRunSources(el: Element, gate: RunGate, options: RunSourceOptions = {}): RunSources {
  const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined)
  const Observer = options.IntersectionObserver
    ?? (typeof IntersectionObserver !== 'undefined' ? IntersectionObserver : undefined)

  gate.setAttached(true)

  const onVisibility = () => gate.setDocumentVisible(!doc?.hidden)
  let observer: IntersectionObserver | undefined

  if (doc) {
    /* Пришли сюда уже активной вкладкой: сообщаем текущее состояние, чтобы
       перецепеленный движок не остался с чужим значением от прошлой жизни. */
    gate.setDocumentVisible(!doc.hidden)
    doc.addEventListener('visibilitychange', onVisibility)
  }

  if (Observer && options.pauseOffscreen !== false) {
    observer = new Observer((entries) => {
      /* Берём последнюю запись: у наблюдателя с одним элементом она и есть
         состояние блока, а «не видим» предпочтительнее «видим» при склейке. */
      const entry = entries[entries.length - 1]
      gate.setIntersecting(entry ? entry.isIntersecting : true)
    }, { threshold: options.threshold ?? 0, rootMargin: options.rootMargin })
    observer.observe(el)
  }

  return {
    disconnect() {
      if (doc) doc.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      gate.setAttached(false)
    },
  }
}
