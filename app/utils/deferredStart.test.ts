import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferStart } from './deferredStart'

/* Наблюдатель-заглушка: тест сам решает, когда блок «подошёл» к окну. */
class FakeObserver {
  static last: FakeObserver | undefined
  observed: unknown[] = []
  disconnected = false
  constructor(public callback: (entries: { isIntersecting: boolean }[]) => void, public options: { rootMargin?: string }) {
    FakeObserver.last = this
  }

  observe(el: unknown) {
    this.observed.push(el)
  }

  disconnect() {
    this.disconnected = true
  }

  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting }])
  }
}

const el = {} as Element

beforeEach(() => {
  vi.useFakeTimers()
  FakeObserver.last = undefined
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('deferStart', () => {
  it('без ступеней стартует сразу', () => {
    const start = vi.fn()
    deferStart(el, start, {})
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('ждёт приближения к окну с заданным отступом', () => {
    const start = vi.fn()
    deferStart(el, start, { nearMargin: '300px 0px' })

    expect(start).not.toHaveBeenCalled()
    expect(FakeObserver.last!.options.rootMargin).toBe('300px 0px')
    expect(FakeObserver.last!.observed).toEqual([el])

    FakeObserver.last!.fire(false)
    expect(start).not.toHaveBeenCalled()

    FakeObserver.last!.fire(true)
    expect(start).toHaveBeenCalledTimes(1)
    expect(FakeObserver.last!.disconnected).toBe(true)
  })

  it('после приближения ждёт простоя — без requestIdleCallback по таймауту', () => {
    const start = vi.fn()
    deferStart(el, start, { nearMargin: '0px', idleTimeout: 2500 })

    FakeObserver.last!.fire(true)
    vi.advanceTimersByTime(2499)
    expect(start).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('простой берёт requestIdleCallback с тем же таймаутом, если он есть', () => {
    const start = vi.fn()
    const ric = vi.fn((callback: () => void) => {
      callback()
      return 7
    })
    vi.stubGlobal('requestIdleCallback', ric)

    deferStart(el, start, { idleTimeout: 2500 })

    expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 2500 })
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('отмена до старта снимает наблюдатель и ожидание простоя', () => {
    const start = vi.fn()
    const cancelNear = deferStart(el, start, { nearMargin: '0px', idleTimeout: 100 })
    cancelNear()
    expect(FakeObserver.last!.disconnected).toBe(true)
    FakeObserver.last!.fire(true)
    vi.advanceTimersByTime(1000)
    expect(start).not.toHaveBeenCalled()

    const cancelIdle = deferStart(el, start, { idleTimeout: 100 })
    cancelIdle()
    vi.advanceTimersByTime(1000)
    expect(start).not.toHaveBeenCalled()
  })

  it('без IntersectionObserver или без элемента ступень приближения пропускается', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const start = vi.fn()
    deferStart(el, start, { nearMargin: '0px' })
    expect(start).toHaveBeenCalledTimes(1)

    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const other = vi.fn()
    deferStart(null, other, { nearMargin: '0px' })
    expect(other).toHaveBeenCalledTimes(1)
  })
})
