import { describe, expect, it } from 'vitest'
import { diffuseLiftMix } from './diffuseLift'

/* Прежний попиксельный проход по canvas — эталон. */
function canvasLift(v: number, lift: number): number {
  return Math.round(v + lift * (1 - v / 255))
}

/* То, что делает шейдер: mix над нормированным каналом. */
function shaderLift(v: number, lift: number): number {
  const f = diffuseLiftMix(lift)
  const n = v / 255
  return Math.round((n + (1 - n) * f) * 255)
}

describe('diffuseLiftMix', () => {
  it.each([0, 12, 30, 60, 255])('шейдер повторяет canvas-проход при подъёме %i', (lift) => {
    for (let v = 0; v <= 255; v++) {
      expect(Math.abs(shaderLift(v, lift) - canvasLift(v, lift))).toBeLessThanOrEqual(1)
    }
  })

  it('коэффициент смешивания — доля, а не единицы канала', () => {
    /* Регрессия: сырое 30 в mix выбивало текстуру в белый. */
    expect(diffuseLiftMix(30)).toBeCloseTo(30 / 255)
    expect(diffuseLiftMix(30)).toBeLessThan(1)
  })

  it('нулевой, отрицательный и запредельный подъём не выходят из [0, 1]', () => {
    expect(diffuseLiftMix(0)).toBe(0)
    expect(diffuseLiftMix(-5)).toBe(0)
    expect(diffuseLiftMix(1000)).toBe(1)
  })
})
