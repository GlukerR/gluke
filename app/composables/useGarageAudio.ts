import { computed, ref } from 'vue'
import { createGarageAudio, type GarageAudio, type GarageAudioState, type GarageAudioTrack } from '~/utils/garageAudio'

/* Музыка зала (`configurator.audio` в контенте кейса): один трек или очередь. */
export interface GarageAudioConfig {
  src?: string
  tracks?: { src: string, title: string, artist?: string }[]
  volume?: number
  fadeIn?: number
}

/** Время трека для плеера: `m:ss`. */
export function formatTrackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * Плеер гаража для HUD: очередь из контента, состояние для разметки и
 * «взвод» звука.
 *
 * Музыка включается, когда человек пришёл в гараж: курсор вошёл в экран (или
 * уже стоял над ним к моменту сборки), фокус с клавиатуры, касание. Грузится
 * трек только после сборки сцены (`isReady`): сначала картинка.
 *
 * Ограничение браузера: наведение не считается действием пользователя. Если
 * на странице ещё не было ни клика, ни тапа, ни клавиши (зашли на кейс прямой
 * ссылкой), `play()` отклоняется, трек встаёт «на взвод» и стартует с первого
 * жеста — это делает garageAudio. Пришли кликом со страницы проектов — звук
 * пойдёт сразу при наведении.
 */
export function useGarageAudio(config: () => GarageAudioConfig | undefined, isReady: () => boolean) {
  /* Очередь из контента; одиночный `src` — очередь из одного трека. Подпись
     трека без названия — имя файла: плеер не показывает пустую строку. */
  const tracks = computed<GarageAudioTrack[]>(() => {
    const audio = config()
    if (audio?.tracks?.length) {
      return audio.tracks.map((track, index) => ({ id: `track-${index}`, ...track }))
    }
    if (!audio?.src) return []
    const file = audio.src.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
    return [{ id: 'track-0', src: audio.src, title: file.replace(/[-_]+/g, ' ') }]
  })
  const hasSound = computed(() => tracks.value.length > 0)
  const soundState = ref<GarageAudioState>('muted')
  const trackId = ref<string | null>(null)
  const trackTime = ref(0)
  const trackDuration = ref(0)
  let player: GarageAudio | undefined
  let armed = false

  const currentTrack = computed(() => tracks.value.find(track => track.id === trackId.value) ?? tracks.value[0])
  const trackProgress = computed(() => (trackDuration.value > 0 ? Math.min(1, trackTime.value / trackDuration.value) : 0))

  function sync() {
    if (!player) return
    soundState.value = player.state
    trackId.value = player.trackId
    trackTime.value = player.currentTime
    trackDuration.value = player.duration
  }

  function ensurePlayer(): GarageAudio | undefined {
    if (!player && hasSound.value) {
      const audio = config()
      player = createGarageAudio(
        { tracks: tracks.value, volume: audio?.volume, fadeIn: audio?.fadeIn },
        { onChange: sync },
      )
      sync()
    }
    return player
  }

  function toggle() {
    ensurePlayer()?.toggle()
    sync()
  }

  function next() {
    ensurePlayer()?.next()
    sync()
  }

  function previous() {
    ensurePlayer()?.previous()
    sync()
  }

  function seek(event: PointerEvent) {
    const bar = event.currentTarget as HTMLElement
    const rect = bar.getBoundingClientRect()
    if (rect.width <= 0) return
    player?.seek((event.clientX - rect.left) / rect.width)
    sync()
  }

  /** Звук на взводе и сцена собрана — трек стартует. */
  function startIfArmed() {
    if (!armed || !isReady()) return
    ensurePlayer()?.start()
    sync()
  }

  /** Человек пришёл в гараж: взвести звук (и запустить, если сцена готова). */
  function arm() {
    if (armed) return
    armed = true
    startIfArmed()
  }

  /* Касание даёт браузеру «действие пользователя» только к отпусканию пальца:
     если трек отклонили на касании, пробуем ещё раз, не дожидаясь второго тапа. */
  function retryAfterTouch() {
    if (soundState.value !== 'waiting' || !player) return
    player.toggle()
    sync()
  }

  function stop() {
    player?.stop()
    player = undefined
  }

  return {
    hasSound,
    soundState,
    currentTrack,
    trackTime,
    trackDuration,
    trackProgress,
    toggle,
    next,
    previous,
    seek,
    arm,
    startIfArmed,
    retryAfterTouch,
    stop,
  }
}
