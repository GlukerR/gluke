/*
 * Музыка зала: один трек на кейс.
 *
 * Трек не грузится вместе со страницей. Адрес отдаётся элементу только когда
 * сцена собрана — модель, уровни и текстуры уже на месте, — поэтому музыка
 * не спорит с ними за канал: сначала картинка, потом звук. Появляется она
 * с нулевой громкости и набирает её плавно (резкий старт в фоне слышен как
 * «врубилось»), тихо, и выключается кнопкой в углу сцены.
 *
 * Браузер запрещает звук до первого действия пользователя: `play()` без жеста
 * отклоняется обещанием. Тогда трек встаёт «на взвод» — первый же клик, тап
 * или нажатие клавиши на странице его запускает, и кнопка это показывает.
 */

/*
 * Состояние трека: `playing` — играет, `muted` — приглушён кнопкой (или ещё не
 * запущен), `waiting` — браузер ждёт действия пользователя и запустит трек
 * с первого жеста.
 */
export type GarageAudioState = 'playing' | 'muted' | 'waiting'

export interface GarageAudioTrack {
  id: string
  title: string
  src: string
}

export interface GarageAudioOptions {
  src?: string
  tracks?: readonly GarageAudioTrack[]
  /** Громкость, до которой доходит появление. */
  volume?: number
  /** Сколько секунд трек набирает громкость. */
  fadeIn?: number
}

export interface GarageAudio {
  readonly state: GarageAudioState
  readonly currentTime: number
  readonly duration: number
  readonly trackId: string | null
  /** Отдать адрес треку и начать играть. Зовётся, когда сцена собрана. */
  start(): void
  /** Переключить воспроизведение. */
  toggle(): void
  /** Выбрать трек из очереди и начать его. */
  selectTrack(trackId: string): void
  /** Перейти к позиции в текущем треке. */
  seek(ratio: number): void
  /** Уход со страницы: остановиться и снять слушателей. */
  stop(): void
}

interface GarageAudioDeps {
  /* Элемент создаётся снаружи: в тесте это простая заглушка, в браузере —
     `Audio` без предзагрузки. */
  createElement?: () => HTMLAudioElement
  onChange?: (state: GarageAudioState) => void
  /* Отписки для взвода на жест: в тестах браузерного окна нет. */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>
}

const DEFAULT_VOLUME = 0.35
const DEFAULT_FADE_IN_S = 4
/* Появление идёт шагами по 40 мс — 25 обновлений в секунду: плавно на слух
   и почти ничего не стоит. */
const FADE_STEP_MS = 40
/* Выключение короткое: кнопку нажали, тишины ждут сразу. */
const MUTE_FADE_S = 0.4
const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, value))
}

export function createGarageAudio(
  options: GarageAudioOptions,
  deps: GarageAudioDeps = {},
): GarageAudio {
  const tracks = options.tracks?.length
    ? [...options.tracks]
    : (options.src ? [{ id: 'main', title: 'Track', src: options.src }] : [])
  const firstTrack = tracks[0]
  const volume = clampVolume(options.volume ?? DEFAULT_VOLUME)
  const fadeMs = Math.max(0, (options.fadeIn ?? DEFAULT_FADE_IN_S) * 1000)
  const target = deps.target ?? (typeof window === 'undefined' ? undefined : window)
  const createElement = deps.createElement ?? (() => new Audio())

  let element: HTMLAudioElement | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let state: GarageAudioState = 'muted'
  let started = false
  let disposed = false
  let listener: (() => void) | null = null
  let currentTrackId: string | null = null
  let currentTime = 0
  let duration = 0
  let onTimeUpdate: (() => void) | null = null

  function setState(next: GarageAudioState) {
    if (state === next) return
    state = next
    deps.onChange?.(next)
  }

  function stopFade() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  /* Громкость ходит шагами, а не одним присваиванием: так слышно появление,
     а не включение. Цель и исходная точка — обычные числа, поэтому шаг не
     зависит от того, чем закончился предыдущий переход. */
  function fadeTo(next: number, ms: number) {
    if (!element) return
    stopFade()
    const from = element.volume
    const to = clampVolume(next)
    if (ms <= 0 || Math.abs(to - from) < 0.001) {
      element.volume = to
      return
    }
    const startedAt = Date.now()
    timer = setInterval(() => {
      if (!element) return
      const done = Math.min(1, (Date.now() - startedAt) / ms)
      element.volume = from + (to - from) * done
      if (done >= 1) stopFade()
    }, FADE_STEP_MS)
  }

  function bindTimeEvents() {
    if (!element) return
    onTimeUpdate = () => {
      currentTime = element?.currentTime ?? 0
      duration = Number.isFinite(element?.duration ?? NaN) ? element?.duration ?? 0 : 0
      deps.onChange?.(state)
    }
    element.addEventListener('timeupdate', onTimeUpdate)
    element.addEventListener('loadedmetadata', onTimeUpdate)
    element.addEventListener('ended', onTimeUpdate)
  }

  function setTrack(track: GarageAudioTrack) {
    if (!element || currentTrackId === track.id) return
    stopFade()
    element.pause()
    element.currentTime = 0
    currentTime = 0
    duration = 0
    currentTrackId = track.id
    element.src = track.src
    element.load()
  }

  function currentTrack(): GarageAudioTrack | undefined {
    return tracks.find(track => track.id === currentTrackId) ?? firstTrack  }

  function releaseGesture() {
    if (!listener || !target) return
    for (const type of GESTURE_EVENTS) target.removeEventListener(type, listener)
    listener = null
  }


  /* Взвод на жест: браузеры без взаимодействия со страницей не дают звука,
     и без этого трек молчал бы до перезагрузки. */
  function awaitGesture() {
    if (listener || !target) return
    listener = () => {
      releaseGesture()
      void play()
    }
    for (const type of GESTURE_EVENTS) target.addEventListener(type, listener, { once: true, passive: true })
  }

  async function play() {
    if (!element || disposed || !currentTrack()) return
    try {
      element.volume = 0
      await element.play()
      if (disposed) return
      setState('playing')
      fadeTo(volume, fadeMs)
    }
    catch {
      /* Отказ = нет действия пользователя; ждём первого. */
      awaitGesture()
      setState('waiting')
    }
  }

  function start() {
    if (started || disposed) return
    started = true
    element = createElement()
    element.preload = 'none'
    element.loop = true
    element.volume = 0
    bindTimeEvents()
    if (firstTrack) {
      currentTrackId = firstTrack.id
      element.src = firstTrack.src
    }
    void play()
  }

  function selectTrack(trackId: string) {
    const track = tracks.find(item => item.id === trackId)
    if (!track || !element) return
    const shouldPlay = state === 'playing'
    setTrack(track)
    if (shouldPlay) void play()
    else setState('muted')
  }

  function seek(ratio: number) {
    if (!element || !Number.isFinite(ratio) || duration <= 0) return
    element.currentTime = Math.min(1, Math.max(0, ratio)) * duration
    currentTime = element.currentTime
  }

  function toggle() {
    if (!started) {
      start()
      return
    }
    if (state === 'playing') {
      setState('muted')
      fadeTo(0, MUTE_FADE_S * 1000)
      /* Пауза после ухода громкости в ноль, а не сразу: иначе слышен обрыв.
         Если за это время трек включили обратно, паузу не трогаем — иначе она
         оборвала бы начавшееся появление. */
      setTimeout(() => {
        if (state === 'muted') element?.pause()
      }, MUTE_FADE_S * 1000 + FADE_STEP_MS)
      return
    }
    void play()
  }

  function stop() {
    disposed = true
    stopFade()
    releaseGesture()
    element?.pause()
    if (element && onTimeUpdate) {
      element.removeEventListener('timeupdate', onTimeUpdate)
      element.removeEventListener('loadedmetadata', onTimeUpdate)
      element.removeEventListener('ended', onTimeUpdate)
    }
    element = null
    onTimeUpdate = null
  }

  return {
    get state() {
      return state
    },
    get currentTime() {
      return currentTime
    },
    get duration() {
      return duration
    },
    get trackId() {
      return currentTrackId
    },
    start,
    toggle,
    selectTrack,
    seek,
    stop,
  }
}
