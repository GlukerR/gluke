import { describe, expect, it } from 'vitest'
import {
  easeInOutCubic,
  focusAzimuth,
  GARAGE_FOCUS,
  nearestAngle,
  polarFromElevation,
  shortestAngleDelta,
  viewShiftForPanel,
} from './garageCamera'

const deg = (value: number) => (value * Math.PI) / 180

describe('shortestAngleDelta', () => {
  it('поворачивает через ноль, а не через всю окружность', () => {
    expect(shortestAngleDelta(deg(350), deg(10))).toBeCloseTo(deg(20))
    expect(shortestAngleDelta(deg(10), deg(350))).toBeCloseTo(deg(-20))
  })

  it('ровно половина окружности — положительный поворот', () => {
    expect(shortestAngleDelta(0, Math.PI)).toBeCloseTo(Math.PI)
  })
})

describe('nearestAngle', () => {
  it('из симметричных ракурсов берёт ближайший', () => {
    expect(nearestAngle(deg(80), [deg(90), deg(-90)])).toBeCloseTo(deg(90))
    expect(nearestAngle(deg(-120), [deg(90), deg(-90)])).toBeCloseTo(deg(-90))
  })
})

describe('easeInOutCubic', () => {
  it('держит концы и середину', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easeInOutCubic(2)).toBe(1)
  })
})

describe('polarFromElevation', () => {
  it('0° — на высоте цели, 90° — сверху', () => {
    expect(polarFromElevation(0)).toBeCloseTo(Math.PI / 2)
    expect(polarFromElevation(90)).toBeCloseTo(0)
  })
})

describe('focusAzimuth', () => {
  it('бампер: три четверти к торцу, со стороны текущей камеры', () => {
    /* Передний бампер в +Z от центра машины. */
    const theta = focusAzimuth({ spec: GARAGE_FOCUS.bumper_front!, theta: deg(60), part: { x: 0, z: 2 } })
    expect(theta).toBeCloseTo(deg(36))
    const other = focusAzimuth({ spec: GARAGE_FOCUS.bumper_front!, theta: deg(-60), part: { x: 0, z: 2 } })
    expect(other).toBeCloseTo(deg(-36))
  })

  it('юбка: сбоку, перпендикулярно длинной оси', () => {
    const theta = focusAzimuth({ spec: GARAGE_FOCUS.skirt!, theta: deg(200), size: { x: 2, z: 5 } })
    expect(Math.cos(theta!)).toBeCloseTo(0)
    expect(Math.sin(theta!)).toBeCloseTo(-1)
  })

  it('без данных камера остаётся на месте', () => {
    expect(focusAzimuth({ spec: GARAGE_FOCUS.bumper_rear!, theta: 0 })).toBeNull()
    expect(focusAzimuth({ spec: GARAGE_FOCUS.skirt!, theta: 0 })).toBeNull()
  })
})

describe('viewShiftForPanel', () => {
  it('без панели кадр не сдвигается', () => {
    expect(viewShiftForPanel({ width: 1920, height: 1000, narrow: false, panel: null })).toEqual({ x: 0, y: 0 })
  })

  it('широкий экран: машина уходит вправо на половину полосы панели', () => {
    expect(viewShiftForPanel({ width: 1920, height: 1000, narrow: false, panel: { right: 420, height: 700 } }))
      .toEqual({ x: 210, y: 0 })
  })

  it('узкий экран: машина поднимается над шторкой, но не выше предела', () => {
    const shift = viewShiftForPanel({ width: 390, height: 600, narrow: true, panel: { right: 390, height: 500 } })
    expect(shift.x).toBe(0)
    expect(shift.y).toBeCloseTo(600 * 0.55 * 0.42)
  })
})
