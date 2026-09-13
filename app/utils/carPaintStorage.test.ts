import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* Модуль читает window.localStorage; среда тестов — node, поэтому оба глобала
   ставим стабами: `window` и его `localStorage` — один и тот же объект. */

const store = new Map<string, string>()

function localStorageStub() {
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

function installStorage(): void {
  const storage = localStorageStub()
  vi.stubGlobal('window', { localStorage: storage })
  vi.stubGlobal('localStorage', storage)
}

describe('carPaintStorage', async () => {
  const { loadCarSelection, saveCarSelection } = await import('./carPaintStorage')

  beforeEach(() => {
    store.clear()
    installStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when nothing was saved', () => {
    expect(loadCarSelection()).toBeNull()
  })

  it('round-trips a selection', () => {
    const selection = { color: 'bordeaux', pattern: 'giraffe', scale: 1.25, coverage: 'matte' }
    saveCarSelection(selection)
    expect(loadCarSelection()).toEqual(selection)
  })

  it('returns null for corrupted JSON', () => {
    window.localStorage.setItem('rp-grand:car-paint', '{not json')
    expect(loadCarSelection()).toBeNull()
  })

  it('returns null for wrong-shape records', () => {
    window.localStorage.setItem('rp-grand:car-paint', JSON.stringify({ color: 42 }))
    expect(loadCarSelection()).toBeNull()
  })

  it('never throws when storage rejects writes (Safari private mode)', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('quota', 'QuotaExceededError')
        },
        removeItem: () => {},
      },
    })
    expect(() => saveCarSelection({ color: 'none', pattern: 'none', scale: 1, coverage: 'gloss' })).not.toThrow()
    expect(loadCarSelection()).toBeNull()
  })
})
