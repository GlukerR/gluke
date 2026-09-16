import { describe, expect, it } from 'vitest'
import { hasSeenGarageIntro, markGarageIntroSeen } from './garageIntro'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('подсказка гаража', () => {
  it('новый посетитель её видит, после действия — больше нет', () => {
    const storage = memoryStorage()
    expect(hasSeenGarageIntro(storage)).toBe(false)
    markGarageIntroSeen(storage)
    expect(hasSeenGarageIntro(storage)).toBe(true)
  })

  it('без хранилища подсказка показывается, запись молча пропускается', () => {
    expect(hasSeenGarageIntro(null)).toBe(false)
    expect(() => markGarageIntroSeen(null)).not.toThrow()
  })

  it('запрет записи и чтения не ломает гараж', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(hasSeenGarageIntro(broken)).toBe(false)
    expect(() => markGarageIntroSeen(broken)).not.toThrow()
  })
})
