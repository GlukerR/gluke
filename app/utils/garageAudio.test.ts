import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGarageAudio, type GarageAudioState } from './garageAudio'

/*
 * Музыка зала проверяется заглушкой элемента: важно не то, как звучит трек,
 * а когда он получает адрес, как набирает громкость и что происходит, когда
 * браузер запретил звук до действия пользователя.
 */

interface FakeElement {
  src: string
  preload: string
  loop: boolean
  volume: number
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

function fakeElement(blocked = false): FakeElement {
  return {
    src: '',
    preload: '',
    loop: false,
    volume: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    play: blocked
      ? vi.fn(() => Promise.reject(new Error('NotAllowedError')))
      : vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
  }
}

/* Окно браузера: нужны только слушатели жеста. */
function fakeTarget() {
  const listeners = new Map<string, () => void>()
  return {
    listeners,
    addEventListener: (type: string, handler: () => void) => { listeners.set(type, handler) },
    removeEventListener: (type: string) => { listeners.delete(type) },
    emit: (type: string) => listeners.get(type)?.(),
  }
}

const asElement = (el: FakeElement) => el as unknown as HTMLAudioElement

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createGarageAudio', () => {
  it('получает адрес только на старте — до него трек не грузится', async () => {
    const el = fakeElement()
    const handle = createGarageAudio(
      { src: '/media/rp-grand/audio/track.mp3', volume: 0.4, fadeIn: 2 },
      { createElement: () => asElement(el) },
    )

    expect(el.src).toBe('')
    expect(el.play).not.toHaveBeenCalled()

    handle.start()
    expect(el.src).toBe('/media/rp-grand/audio/track.mp3')
    expect(el.preload).toBe('none')
    expect(el.loop).toBe(true)
    /* Появление начинается с нуля: резкий старт в фоне слышен как «врубилось». */
    expect(el.volume).toBe(0)

    await vi.advanceTimersByTimeAsync(0)
    expect(handle.state).toBe('playing')

    await vi.advanceTimersByTimeAsync(1000)
    expect(el.volume).toBeGreaterThan(0)
    expect(el.volume).toBeLessThan(0.4)

    await vi.advanceTimersByTimeAsync(1200)
    expect(el.volume).toBeCloseTo(0.4, 3)
  })

  it('старт повторно ничего не создаёт и не запускает', async () => {
    const el = fakeElement()
    const handle = createGarageAudio({ src: '/track.mp3' }, { createElement: () => asElement(el) })
    handle.start()
    handle.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(el.play).toHaveBeenCalledTimes(1)
  })

  it('без действия пользователя встаёт на взвод и стартует с первого жеста', async () => {
    const el = fakeElement(true)
    const target = fakeTarget()
    const states: GarageAudioState[] = []
    const handle = createGarageAudio(
      { src: '/track.mp3' },
      {
        createElement: () => asElement(el),
        onChange: state => states.push(state),
        target: target as unknown as Window,
      },
    )

    handle.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(handle.state).toBe('waiting')
    expect(target.listeners.size).toBe(3)

    /* Жест пользователя снимает запрет: браузер отдаёт звук, взвод снимается. */
    el.play.mockImplementation(() => Promise.resolve())
    target.emit('pointerdown')
    await vi.advanceTimersByTimeAsync(0)

    expect(handle.state).toBe('playing')
    expect(el.play).toHaveBeenCalledTimes(2)
    expect(target.listeners.size).toBe(0)
    expect(states).toEqual(['waiting', 'playing'])
  })

  it('кнопка глушит с плавным уходом и возвращает звук', async () => {
    const el = fakeElement()
    const handle = createGarageAudio(
      { src: '/track.mp3', volume: 0.4, fadeIn: 1 },
      { createElement: () => asElement(el) },
    )
    handle.start()
    await vi.advanceTimersByTimeAsync(1100)
    expect(el.volume).toBeCloseTo(0.4, 3)

    handle.toggle()
    expect(handle.state).toBe('muted')
    /* Пауза ставится после того, как громкость ушла в ноль: иначе слышен обрыв. */
    expect(el.pause).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(el.volume).toBe(0)
    expect(el.pause).toHaveBeenCalledTimes(1)

    handle.toggle()
    /* Состояние меняет уже сам запуск: сначала обещание `play()`, потом звук. */
    await vi.advanceTimersByTimeAsync(0)
    expect(handle.state).toBe('playing')
    await vi.advanceTimersByTimeAsync(1100)
    expect(el.volume).toBeCloseTo(0.4, 3)
    expect(el.play).toHaveBeenCalledTimes(2)
  })

  it('быстрое «выключил и включил» не ставит трек на паузу', async () => {
    const el = fakeElement()
    const handle = createGarageAudio(
      { src: '/track.mp3', fadeIn: 1 },
      { createElement: () => asElement(el) },
    )
    handle.start()
    await vi.advanceTimersByTimeAsync(0)

    handle.toggle()
    handle.toggle()
    await vi.advanceTimersByTimeAsync(600)
    expect(el.pause).not.toHaveBeenCalled()
    expect(handle.state).toBe('playing')
  })

  it('кнопка до старта запускает трек', async () => {
    const el = fakeElement()
    const handle = createGarageAudio({ src: '/track.mp3' }, { createElement: () => asElement(el) })
    handle.toggle()
    await vi.advanceTimersByTimeAsync(0)
    expect(handle.state).toBe('playing')
    expect(el.play).toHaveBeenCalledTimes(1)
  })

  it('уход со страницы глушит трек и снимает слушателей жеста', async () => {
    const el = fakeElement(true)
    const target = fakeTarget()
    const handle = createGarageAudio(
      { src: '/track.mp3' },
      { createElement: () => asElement(el), target: target as unknown as Window },
    )
    handle.start()
    await vi.advanceTimersByTimeAsync(0)
    handle.stop()
    expect(el.pause).toHaveBeenCalledTimes(1)
    expect(target.listeners.size).toBe(0)
  })
})

/*
 * Плейлист: у элемента нужен ещё `load` и позиция — HUD переключает треки
 * кнопками и ждёт, что очередь пойдёт дальше сама.
 */
describe('createGarageAudio — плейлист', () => {
  const tracks = [
    { id: 'a', title: 'A', artist: 'X', src: '/a.mp3' },
    { id: 'b', title: 'B', artist: 'Y', src: '/b.mp3' },
    { id: 'c', title: 'C', src: '/c.mp3' },
  ]

  function playlistElement() {
    return Object.assign(fakeElement(), { load: vi.fn(), currentTime: 0, duration: 120 })
  }

  function listener(el: FakeElement, type: string): () => void {
    const call = el.addEventListener.mock.calls.find(([name]) => name === type)
    return call?.[1] as () => void
  }

  it('очередь не крутится петлёй и начинается с первого трека', async () => {
    const el = playlistElement()
    const handle = createGarageAudio({ tracks }, { createElement: () => asElement(el) })
    handle.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(el.loop).toBe(false)
    expect(el.src).toBe('/a.mp3')
    expect(handle.trackId).toBe('a')
  })

  it('«вперёд» и «назад» ходят по кругу и не глушат играющий трек', async () => {
    const el = playlistElement()
    const handle = createGarageAudio({ tracks }, { createElement: () => asElement(el) })
    handle.start()
    await vi.advanceTimersByTimeAsync(0)

    handle.next()
    await vi.advanceTimersByTimeAsync(0)
    expect(el.src).toBe('/b.mp3')
    expect(handle.state).toBe('playing')

    handle.previous()
    handle.previous()
    await vi.advanceTimersByTimeAsync(0)
    expect(el.src).toBe('/c.mp3')
  })

  it('«назад» на середине трека возвращает в его начало', async () => {
    const el = playlistElement()
    const handle = createGarageAudio({ tracks }, { createElement: () => asElement(el) })
    handle.start()
    await vi.advanceTimersByTimeAsync(0)
    el.currentTime = 40
    listener(el, 'timeupdate')()

    handle.previous()
    expect(el.src).toBe('/a.mp3')
    expect(el.currentTime).toBe(0)
  })

  it('кончившийся трек сменяется следующим', async () => {
    const el = playlistElement()
    const handle = createGarageAudio({ tracks }, { createElement: () => asElement(el) })
    handle.start()
    await vi.advanceTimersByTimeAsync(0)
    listener(el, 'ended')()
    expect(handle.trackId).toBe('b')
    expect(el.src).toBe('/b.mp3')
  })

  it('трек, выбранный до старта, играет первым', async () => {
    const el = playlistElement()
    const handle = createGarageAudio({ tracks }, { createElement: () => asElement(el) })
    handle.next()
    expect(el.src).toBe('')
    expect(handle.trackId).toBe('b')
    handle.start()
    expect(el.src).toBe('/b.mp3')
  })
})
