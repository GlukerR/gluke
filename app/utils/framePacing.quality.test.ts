import { describe, expect, it } from 'vitest'
import { createQualityGovernor, physicalPixelRatio } from './framePacing'

/* Прогон регулятора по последовательности интервалов rAF. Возвращает
   множители после каждой смены. */
function run(intervals: number[], options?: Parameters<typeof createQualityGovernor>[0]) {
  const governor = createQualityGovernor(options)
  const changes: number[] = []
  let now = 1000
  governor.sample(now)
  for (const dt of intervals) {
    now += dt
    if (governor.sample(now)) changes.push(governor.scale())
  }
  return { governor, changes }
}

const repeat = (pattern: number[], times: number) => Array.from({ length: times }, () => pattern).flat()

describe('createQualityGovernor', () => {
  it('исправное устройство на 60 Гц не теряет качество', () => {
    const { changes, governor } = run(repeat([16.7, 16.6, 16.8], 400))
    expect(changes).toEqual([])
    expect(governor.scale()).toBe(1)
  })

  it('экран 30 Гц — не перегрузка: ровные 33 мс качество не снижают', () => {
    const { changes } = run(repeat([33.3, 33.4], 600))
    expect(changes).toEqual([])
  })

  it('GPU не успевает на 60 Гц — плотность опускается по ступеням', () => {
    /* Каждый второй вызов опаздывает на кадр: типичная картина перегрузки
       при vsync. */
    const { changes, governor } = run(repeat([16.7, 33.4], 600))
    expect(changes).toEqual([0.85, 0.7])
    expect(governor.scale()).toBe(0.7)
  })

  it('одиночные рывки (сборка мусора, прокрутка) — не повод', () => {
    /* Одно тяжёлое окно, дальше ровно: терпение — два окна подряд. */
    const { changes } = run([...repeat([16.7, 40], 30), ...repeat([16.7], 600)])
    expect(changes).toEqual([])
  })

  it('пауза цикла не считается опозданием', () => {
    const governor = createQualityGovernor()
    let now = 0
    for (let round = 0; round < 20; round++) {
      for (let i = 0; i < 50; i++) {
        now += 16.7
        governor.sample(now)
      }
      /* Цикл остановлен на полсекунды, потом снова пошёл. */
      governor.pause()
      now += 500
    }
    expect(governor.scale()).toBe(1)
  })

  it('разрыв длиннее 250 мс без явной паузы тоже не опоздание', () => {
    const { changes } = run(repeat([...Array.from({ length: 20 }, () => 16.7), 900], 60))
    expect(changes).toEqual([])
  })
})

describe('physicalPixelRatio со множителем качества', () => {
  const base = { cssWidth: 800, cssHeight: 600, cap: 2, budget: 3.2e6, floor: 1 }

  it('опускает плотность вместе с множителем', () => {
    expect(physicalPixelRatio({ ...base, dpr: 2 })).toBe(2)
    expect(physicalPixelRatio({ ...base, dpr: 2, scale: 0.7 })).toBe(1.4)
  })

  it('нижняя граница снижается, но не ниже 0,75', () => {
    expect(physicalPixelRatio({ ...base, dpr: 1, scale: 0.85 })).toBe(0.85)
    expect(physicalPixelRatio({ ...base, dpr: 1, scale: 0.5 })).toBe(0.75)
  })

  it('без множителя поведение прежнее', () => {
    expect(physicalPixelRatio({ ...base, dpr: 1 })).toBe(1)
    expect(physicalPixelRatio({ ...base, dpr: 1, scale: 1 })).toBe(1)
  })
})
