import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { applySeat, reseatLevels, seatLevelByBounds, type CarSeat } from './carSeating'

/*
 * Посадка уровней — место, где ошибка уже случалась. Подробный уровень
 * приезжает последним и задаёт высоту кузова; упрощённые (один кузов, без
 * колёс) стоят на полу ниже ровно на высоту колеса. Если их не перенести на
 * посадку подробного, возврат на LOD1/LOD2 из HUD показывает кузов, ушедший
 * в пол, — и держится это не момент, а всё время, пока уровень лежит в кэше.
 *
 * Проверка держит инвариант: после сборки цепочки все уровни машины стоят
 * на одной высоте, на посадке подробного.
 */

/* Колесо: 0,32 м. Кузов стоит на колёсах, поэтому у подробного уровня низ
   габарита — шина (0), а у упрощённого — порог кузова (0,32). */
const WHEEL_RADIUS = 0.32
/* Пол зала и точка, в которую ставится машина (центр по горизонтали). */
const SPOT = { anchor: { x: 0.42, z: -1.18 }, bottomY: 0.084 }

const WHEEL_SPOTS: [number, number][] = [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]

function carRoot(withWheels: boolean): THREE.Object3D {
  const car = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.6))
  body.position.y = WHEEL_RADIUS + 0.35
  car.add(body)
  if (withWheels) {
    for (const [x, z] of WHEEL_SPOTS) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.22, 12))
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, WHEEL_RADIUS, z)
      car.add(wheel)
    }
  }
  car.updateMatrixWorld(true)
  return car
}

/** Уровни машины, как они лежат в сцене: id уровня → собранный корень. */
function carLevels(): Map<string, { root: THREE.Object3D }> {
  return new Map([
    ['2', { root: carRoot(false) }],
    ['1', { root: carRoot(false) }],
    ['0', { root: carRoot(true) }],
  ])
}

/** Высоты уровней в порядке сборки — по ним и видно расхождение посадки. */
function heights(levels: Map<string, { root: THREE.Object3D }>): number[] {
  return [...levels.values()].map(level => Number(level.root.position.y.toFixed(6)))
}

/** Собирает уровни как конфигуратор: каждый встаёт по своему габариту. */
function seatAll(levels: Map<string, { root: THREE.Object3D }>): Map<string, CarSeat> {
  const seats = new Map<string, CarSeat>()
  for (const [id, level] of levels) seats.set(id, seatLevelByBounds(THREE, level.root, SPOT))
  return seats
}

describe('seatLevelByBounds', () => {
  it('ставит низ габарита на пол, а центр — в точку зала', () => {
    const root = carRoot(true)
    const seat = seatLevelByBounds(THREE, root, SPOT)
    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    expect(box.min.y).toBeCloseTo(SPOT.bottomY, 6)
    expect(center.x).toBeCloseTo(SPOT.anchor.x, 6)
    expect(center.z).toBeCloseTo(SPOT.anchor.z, 6)
    expect(seat.offsetY).toBeCloseTo(SPOT.bottomY, 6)
  })

  it('на время загрузки ставит кузов на низ кузова прежней машины — на её колёса', () => {
    /* Прежняя машина стоит на своих колёсах, её кузов — на низу кузова. */
    const previous = carRoot(true)
    const previousSeat = seatLevelByBounds(THREE, previous, SPOT)
    const previousBodyBottom = new THREE.Box3().setFromObject(carRoot(false)).min.y + previousSeat.offsetY

    /* Новый кузов ставится на эту же высоту: чужие колёса стоят под ним. */
    const light = carRoot(false)
    seatLevelByBounds(THREE, light, { anchor: SPOT.anchor, bottomY: previousBodyBottom })
    const lightBox = new THREE.Box3().setFromObject(light)
    const borrowedBox = new THREE.Box3().setFromObject(previous)

    expect(lightBox.min.y).toBeCloseTo(previousBodyBottom, 6)
    /* Чужие колёса стоят на полу, а их верх заходит в арку — не висят под кузовом. */
    expect(borrowedBox.min.y).toBeCloseTo(SPOT.bottomY, 6)
    expect(lightBox.min.y).toBeLessThan(borrowedBox.max.y)
  })

  it('ставит уровень по габариту, даже если он уже стоял на другой посадке', () => {
    const root = carRoot(false)
    const localBottom = new THREE.Box3().setFromObject(carRoot(false)).min.y
    seatLevelByBounds(THREE, root, SPOT)

    /* Второй вызов — как переезд кузова на низ кузова прежней машины: замер
       не должен вбирать в себя первую посадку. */
    const second = seatLevelByBounds(THREE, root, { anchor: SPOT.anchor, bottomY: 0.8 })

    expect(new THREE.Box3().setFromObject(root).min.y).toBeCloseTo(0.8, 6)
    expect(second.offsetY).toBeCloseTo(0.8 - localBottom, 6)
  })

  it('упрощённый уровень по своему габариту встаёт ниже подробного на высоту колеса', () => {
    const detailed = seatLevelByBounds(THREE, carRoot(true), SPOT)
    const light = seatLevelByBounds(THREE, carRoot(false), SPOT)
    expect(detailed.offsetY - light.offsetY).toBeCloseTo(WHEEL_RADIUS, 6)
  })

  it('держит посадку при повороте выгрузки (coupe-jdm идёт с rotation: 90)', () => {
    const root = carRoot(true)
    root.rotation.y = Math.PI / 2
    seatLevelByBounds(THREE, root, SPOT)
    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    expect(box.min.y).toBeCloseTo(SPOT.bottomY, 6)
    expect(center.x).toBeCloseTo(SPOT.anchor.x, 6)
    expect(center.z).toBeCloseTo(SPOT.anchor.z, 6)
  })
})

describe('reseatLevels', () => {
  it('ставит все собранные уровни на посадку подробного', () => {
    const levels = carLevels()
    const seats = seatAll(levels)
    /* До переноса расхождение есть: лёгкие уровни стоят кузовом на полу. */
    expect(new Set(heights(levels)).size).toBe(2)

    const moved = reseatLevels(levels, seats.get('0')!, '0')

    expect(moved).toBe(2)
    expect(new Set(heights(levels)).size).toBe(1)
    expect(heights(levels)[2]).toBeCloseTo(seats.get('0')!.offsetY, 6)
    /* По горизонтали все уровни тоже на одном сдвиге — посадка общая. */
    const shifts = [...levels.values()].map(level => `${level.root.position.x}|${level.root.position.z}`)
    expect(new Set(shifts).size).toBe(1)
  })

  it('переносит и тот уровень, что сейчас в кадре', () => {
    const levels = carLevels()
    const seats = seatAll(levels)
    /* В кадре лёгкий уровень: он и есть тот, кто встал раньше подробного. */
    const displayed = levels.get('2')!
    reseatLevels(levels, seats.get('0')!, '0')
    expect(displayed.root.position.y).toBeCloseTo(seats.get('0')!.offsetY, 6)
  })

  it('не двигает сам уровень-правитель: его посадка и есть правитель', () => {
    const levels = carLevels()
    const light = seatLevelByBounds(THREE, levels.get('2')!.root, SPOT)
    seatLevelByBounds(THREE, levels.get('0')!.root, SPOT)
    const detailedY = levels.get('0')!.root.position.y

    const moved = reseatLevels(levels, light, '0')

    /* Переехали оба лёгких уровня, правитель — нет. */
    expect(moved).toBe(2)
    expect(levels.get('0')!.root.position.y).toBe(detailedY)
  })

  it('упрощённый уровень, поставленный посадкой правителя, держит кузов на его высоте', () => {
    const detailed = carRoot(true)
    const ruler = seatLevelByBounds(THREE, detailed, SPOT)
    const light = carRoot(false)
    applySeat(light, ruler)

    /* Кузов лёгкого уровня — на высоте кузова подробного; колёса подставляет
       вьювер (`lod-wheels`), поэтому низ габарита у него на колесо выше. */
    const detailedBox = new THREE.Box3().setFromObject(detailed)
    const lightBox = new THREE.Box3().setFromObject(light)
    expect(lightBox.min.y).toBeCloseTo(detailedBox.min.y + WHEEL_RADIUS, 6)
  })
})
