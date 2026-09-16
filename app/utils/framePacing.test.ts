import { describe, expect, it } from 'vitest'
import { CAMERA_POSE_LENGTH, cameraPoseChanged, createFrameLimiter, physicalPixelRatio, writeCameraPose } from './framePacing'

/* Камера по умолчанию — единичный поворот в начале координат. */
function camera(overrides: Partial<{ x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number }> = {}) {
  return {
    position: { x: overrides.x ?? 0, y: overrides.y ?? 0, z: overrides.z ?? 0 },
    quaternion: { x: overrides.qx ?? 0, y: overrides.qy ?? 0, z: overrides.qz ?? 0, w: overrides.qw ?? 1 },
  }
}

/* Прогон лимитера по сетке кадров rAF: сколько кадров отрисовано за период. */
function renderCount(fps: number, stepMs: number, seconds: number): number {
  const limiter = createFrameLimiter(fps)
  let rendered = 0
  const frames = Math.round((seconds * 1000) / stepMs)
  for (let i = 0; i <= frames; i++) {
    if (limiter.shouldRender(i * stepMs)) rendered += 1
  }
  return rendered
}

/* Идеальное число кадров за период (первый кадр плюс по одному на интервал). */
function idealFrames(fps: number, seconds: number): number {
  return fps * seconds + 1
}

describe('createFrameLimiter', () => {
  it('даёт 30 fps на 60-герцовой сетке, а не 20', () => {
    /* Тот самый дефект: 2 × 16,6 = 33,2 < 33,33, поэтому кадр пропускался
       дважды и выходило 20 fps вместо 30. */
    for (const step of [16.6, 16.66, 16.7]) {
      expect(Math.abs(renderCount(30, step, 1) - idealFrames(30, 1))).toBeLessThanOrEqual(1)
      expect(renderCount(30, step, 1)).toBeGreaterThan(20)
    }
  })

  it('не рисует чаще заданного на быстрой сетке', () => {
    expect(Math.abs(renderCount(30, 8.33, 1) - idealFrames(30, 1))).toBeLessThanOrEqual(1)
    expect(Math.abs(renderCount(60, 8.33, 1) - idealFrames(60, 1))).toBeLessThanOrEqual(1)
  })

  it('первый кадр всегда рисуется и кадры идут не чаще интервала', () => {
    const limiter = createFrameLimiter(30)

    expect(limiter.shouldRender(0)).toBe(true)
    expect(limiter.shouldRender(1)).toBe(false)
    expect(limiter.shouldRender(16)).toBe(false)
    expect(limiter.shouldRender(34)).toBe(true)
  })

  it('после длинной паузы рисует один кадр, а не догоняет пропущенные', () => {
    const limiter = createFrameLimiter(30)
    limiter.shouldRender(0)

    expect(limiter.shouldRender(1000)).toBe(true)
    expect(limiter.shouldRender(1001)).toBe(false)
    expect(limiter.shouldRender(1016)).toBe(false)
    expect(limiter.shouldRender(1034)).toBe(true)
  })

  it('reset начинает отсчёт заново: первый кадр после него рисуется сразу', () => {
    const limiter = createFrameLimiter(30)
    limiter.shouldRender(0)
    limiter.shouldRender(34)

    limiter.reset(100)
    expect(limiter.shouldRender(100)).toBe(true)
    expect(limiter.shouldRender(110)).toBe(false)
  })

  it('считает среднюю частоту, а не только соседние кадры', () => {
    /* 60-герцовая сетка за 10 секунд: 30 fps — это около 301 кадра. */
    expect(Math.abs(renderCount(30, 16.66, 10) - idealFrames(30, 10))).toBeLessThanOrEqual(1)
  })
})

describe('physicalPixelRatio', () => {
  it('берёт devicePixelRatio, пока кадр укладывается в бюджет', () => {
    expect(physicalPixelRatio({ cssWidth: 626, cssHeight: 352, dpr: 2, cap: 2, budget: 2.2e6 })).toBe(2)
  })

  it('опускает долю DPR на больших блоках', () => {
    /* 1280×720 на экране 2×: 3,7 млн физических пикселей против бюджета 2,2 млн. */
    const ratio = physicalPixelRatio({ cssWidth: 1280, cssHeight: 720, dpr: 2, cap: 2, budget: 2.2e6 })

    expect(ratio).toBeCloseTo(1.54, 2)
    expect(1280 * 720 * ratio * ratio).toBeLessThanOrEqual(2.2e6 + 1)
  })

  it('потолок устройства сильнее бюджета', () => {
    expect(physicalPixelRatio({ cssWidth: 400, cssHeight: 300, dpr: 3, cap: 1.5, budget: 2.2e6 })).toBe(1.5)
  })

  it('не опускается ниже половины, даже если бюджета не хватает', () => {
    expect(physicalPixelRatio({ cssWidth: 4000, cssHeight: 2000, dpr: 2, cap: 2, budget: 1e6 })).toBe(0.5)
  })

  it('свой пол держит плотность не ниже единицы (вьюверы)', () => {
    const args = { cssWidth: 4000, cssHeight: 2000, dpr: 2, cap: 2, budget: 1e6 }

    expect(physicalPixelRatio({ ...args, floor: 1 })).toBe(1)
    /* Обычный блок плотность не теряет: бюджет 3,2 млн выше кадра 714k×4. */
    expect(physicalPixelRatio({ cssWidth: 1127, cssHeight: 634, dpr: 2, cap: 2, budget: 3.2e6, floor: 1 })).toBe(2)
  })

  it('нулевой размер блока не ломает расчёт', () => {
    expect(physicalPixelRatio({ cssWidth: 0, cssHeight: 0, dpr: 2, cap: 2, budget: 2.2e6 })).toBe(1)
  })
})

describe('cameraPoseChanged', () => {
  it('без снимка движение считается (первый кадр цикла)', () => {
    expect(cameraPoseChanged(camera(), null)).toBe(true)
  })

  it('неподвижная камера движения не даёт — сцена должна засыпать', () => {
    const snapshot = new Float64Array(CAMERA_POSE_LENGTH)
    const cam = camera({ x: 2.9581, y: 2.533, z: 5.7922 })

    writeCameraPose(cam, snapshot)

    expect(cameraPoseChanged(cam, snapshot)).toBe(false)
    /* Повторный вызов на неизменной камере тоже молчит: именно этой проверкой
       цикл гаража перестал рисовать 60 кадров в секунду в покое. */
    expect(cameraPoseChanged(cam, snapshot)).toBe(false)
  })

  it('сдвиг и поворот ловятся по отдельности', () => {
    const snapshot = new Float64Array(CAMERA_POSE_LENGTH)
    const cam = camera()
    writeCameraPose(cam, snapshot)

    expect(cameraPoseChanged(camera({ x: 0.001 }), snapshot)).toBe(true)
    expect(cameraPoseChanged(camera({ qz: 0.001, qw: 1 }), snapshot)).toBe(true)
  })

  it('дрожь ниже допуска движением не считается', () => {
    const snapshot = new Float64Array(CAMERA_POSE_LENGTH)
    writeCameraPose(camera(), snapshot)

    /* 1e-5 меньше допуска 1e-4: такая разница не видна и кадров не стоит. */
    expect(cameraPoseChanged(camera({ x: 1e-5 }), snapshot)).toBe(false)
    expect(cameraPoseChanged(camera({ x: 1e-5 }), snapshot, 1e-6)).toBe(true)
  })

  it('снимок пишется целиком — все семь чисел', () => {
    const snapshot = new Float64Array(CAMERA_POSE_LENGTH)
    writeCameraPose(camera({ x: 1, y: 2, z: 3, qx: 0.1, qy: 0.2, qz: 0.3, qw: 0.9 }), snapshot)

    expect([...snapshot]).toEqual([1, 2, 3, 0.1, 0.2, 0.3, 0.9])
  })
})
