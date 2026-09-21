import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { applySeat, bodyBottomY, measureFromManifest, measureLevel, placeLevel, seatFromMeasure, seatLevels } from './carSeating'

/*
 * Посадка уровней — место, где ошибка уже случалась, и не раз. Сначала лёгкие
 * уровни садились по своему габариту и вставали кузовом на пол (ниже подробного
 * на высоту колеса). Потом посадка стала общей, но считалась по габариту уровня
 * целиком: у уровня без колёс низ габарита — это низ кузова, поэтому стоило
 * манифесту приехать без постоянной — и лёгкий уровень проваливался на пол
 * ровно на высоту колеса (0,23 м у coupe-sport).
 *
 * Потом каждый уровень стал садиться по собственному кузову — и съезжал
 * относительно колёс LOD0, которые стоят в сцене на всех уровнях: у
 * упрощённой сетки срезан нижний край кузова (у sedan-awd низ LOD2 выше на
 * 3,9 см), и LOD2 опускался на колёса на эти сантиметры.
 *
 * Правило теперь такое: **основа — кузов подробного уровня**, и его посадка
 * одна на все уровни. Колёса в расчёт не входят, а уровни стоят в тех же
 * координатах, в которых их выгрузил моделлер, — над теми же колёсами.
 */

/* Колесо: 0,32 м. Кузов стоит на колёсах, поэтому низ габарита подробного
   уровня — шина (0), а низ его кузова — 0,32. */
const WHEEL_RADIUS = 0.32
/* Пол зала, точка зала и постоянная машины в работе. */
const FLOOR = 0.084
const ANCHOR = { x: 0.42, z: -1.18 }
const CLEARANCE = WHEEL_RADIUS

const WHEEL_SPOTS: [number, number][] = [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]

/** Колёса уровня — те, что не считаются кузовом. */
const wheelNames = (withWheels: boolean) => (withWheels ? WHEEL_SPOTS.map((_, index) => `Wheel.${String(index).padStart(3, '0')}`) : [])

/** Уровень машины: кузов и, если он у него есть, колёса. */
function carRoot(withWheels: boolean, options: { bodyLift?: number, wheelRadius?: number } = {}): THREE.Object3D {
  const { bodyLift = 0, wheelRadius = WHEEL_RADIUS } = options
  const car = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.6))
  body.position.y = WHEEL_RADIUS + 0.35 + bodyLift
  car.add(body)
  if (withWheels) {
    WHEEL_SPOTS.forEach(([x, z], index) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.22, 12))
      wheel.name = wheelNames(true)[index]!
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, wheelRadius, z)
      car.add(wheel)
    })
  }
  car.updateMatrixWorld(true)
  return car
}

const spot = { anchor: ANCHOR, bottomY: bodyBottomY(FLOOR, CLEARANCE) }

/**
 * Низ кузова уровня в зале: по нему и видно расхождение посадки.
 *
 * Замер идёт модулем, но тот сбрасывает уровень в начало координат, поэтому
 * высота посадки берётся до замера: поворот вокруг вертикали её не меняет,
 * а смещение по горизонтали на высоту не влияет.
 */
function bodyBottom(root: THREE.Object3D, wheels: string[] = []): number {
  const placed = root.position.clone()
  const value = measureLevel(THREE, root, wheels).body.min.y + placed.y
  /* Замер сбрасывает уровень в начало координат — возвращаем посадку,
     иначе следующий замер увидит уже снятую высоту. */
  root.position.copy(placed)
  root.updateMatrixWorld(true)
  return value
}

describe('measureLevel', () => {
  it('высота колеса у подробного уровня и ноль у уровня без колёс', () => {
    expect(measureLevel(THREE, carRoot(true), wheelNames(true)).clearance).toBeCloseTo(WHEEL_RADIUS, 6)
    expect(measureLevel(THREE, carRoot(false), wheelNames(false)).clearance).toBeCloseTo(0, 6)
  })

  it('замер не вбирает прошлую посадку: второй замер тот же', () => {
    const root = carRoot(true)
    placeLevel(THREE, root, spot, wheelNames(true))

    const second = measureLevel(THREE, root, wheelNames(true))

    expect(second.clearance).toBeCloseTo(WHEEL_RADIUS, 6)
    expect(second.body.min.y).toBeCloseTo(WHEEL_RADIUS, 6)
  })
})

describe('placeLevel', () => {
  it('ставит низ кузова на пол плюс постоянную, а центр кузова — в точку зала', () => {
    const root = carRoot(true)
    placeLevel(THREE, root, spot, wheelNames(true))

    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    expect(bodyBottom(root, wheelNames(true))).toBeCloseTo(FLOOR + WHEEL_RADIUS, 6)
    expect(center.x).toBeCloseTo(ANCHOR.x, 6)
    expect(center.z).toBeCloseTo(ANCHOR.z, 6)
    /* Колёса стоят на полу: низ габарита — пол. */
    expect(box.min.y).toBeCloseTo(FLOOR, 6)
  })

  it('уровень без колёс встаёт кузовом туда же, где подробный: провала в пол нет', () => {
    const detailed = carRoot(true)
    const light = carRoot(false)
    placeLevel(THREE, detailed, spot, wheelNames(true))
    placeLevel(THREE, light, spot, [])

    expect(bodyBottom(light)).toBeCloseTo(bodyBottom(detailed, wheelNames(true)), 6)
    /* По старому правилу (низ габарита на пол) кузов лёгкого уровня встал бы
       ниже ровно на высоту колеса — это и был видимый провал. */
    expect(bodyBottom(light) - WHEEL_RADIUS).toBeCloseTo(FLOOR, 6)
  })

  it('держит посадку при повороте выгрузки (coupe-jdm идёт с rotation: 90)', () => {
    const root = carRoot(true)
    root.rotation.y = Math.PI / 2
    placeLevel(THREE, root, spot, wheelNames(true))

    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    expect(bodyBottom(root, wheelNames(true))).toBeCloseTo(FLOOR + WHEEL_RADIUS, 6)
    expect(center.x).toBeCloseTo(ANCHOR.x, 6)
    expect(center.z).toBeCloseTo(ANCHOR.z, 6)
  })
})

describe('measureFromManifest', () => {
  it('совпадает с замером подробного уровня при любом развороте', () => {
    for (const rotation of [0, Math.PI / 2, 0.7]) {
      const root = carRoot(true)
      root.rotation.y = rotation
      const measured = measureLevel(THREE, root, wheelNames(true))
      /* Кузов в координатах файла — то, что пишет `car-seat-bounds`. */
      const file = measureLevel(THREE, carRoot(true), wheelNames(true))
      const known = measureFromManifest(THREE, {
        seatBody: { min: file.body.min.toArray(), max: file.body.max.toArray() },
        seatClearance: file.clearance,
      }, rotation)!

      const a = seatFromMeasure(THREE, measured, spot)
      const b = seatFromMeasure(THREE, known, spot)
      expect(b.offsetY).toBeCloseTo(a.offsetY, 6)
      expect(b.shift.x).toBeCloseTo(a.shift.x, 6)
      expect(b.shift.z).toBeCloseTo(a.shift.z, 6)
    }
  })

  it('без кузова или постоянной в манифесте — null', () => {
    expect(measureFromManifest(THREE, {}, 0)).toBeNull()
    expect(measureFromManifest(THREE, { seatClearance: 0.3 }, 0)).toBeNull()
    expect(measureFromManifest(THREE, { seatBody: { min: [0, 0, 0], max: [1, 1, 1] } }, 0)).toBeNull()
  })
})

describe('одна посадка на все уровни', () => {
  /** Уровни машины, как они лежат в сцене: LOD2 с кузовом чуть выше и в стороне. */
  function levels() {
    const lod2 = carRoot(false, { bodyLift: 0.039 })
    lod2.children[0]!.position.x += 0.038
    lod2.updateMatrixWorld(true)
    return new Map([
      ['2', { root: lod2 }],
      ['1', { root: carRoot(false) }],
      ['0', { root: carRoot(true) }],
    ])
  }

  it('кузов упрощённого уровня не съезжает относительно колёс подробного', () => {
    const car = levels()
    const { seat } = placeLevel(THREE, car.get('0')!.root, spot, wheelNames(true))

    const moved = seatLevels(car, seat)

    expect(moved).toBe(3)
    /* Все уровни — одним сдвигом, как их выгрузил моделлер: колёса LOD0 стоят
       под каждым из них там же, где под подробным. */
    for (const level of car.values()) {
      expect(level.root.position.toArray()).toEqual(car.get('0')!.root.position.toArray())
    }
    /* Уровень без колёс не садится на пол кузовом: низ его кузова — над полом
       на высоту колеса (плюс срезанный край у LOD2), а не на полу. */
    expect(bodyBottom(car.get('1')!.root)).toBeCloseTo(FLOOR + WHEEL_RADIUS, 6)
    expect(bodyBottom(car.get('2')!.root)).toBeCloseTo(FLOOR + WHEEL_RADIUS + 0.039, 6)
  })

  it('посадка из манифеста ставит лёгкий уровень туда же, где встанет подробный', () => {
    const file = measureLevel(THREE, carRoot(true), wheelNames(true))
    const known = measureFromManifest(THREE, {
      seatBody: { min: file.body.min.toArray(), max: file.body.max.toArray() },
      seatClearance: file.clearance,
    }, 0)!
    const seat = seatFromMeasure(THREE, known, spot)

    const light = carRoot(false)
    applySeat(light, seat)
    const detailed = carRoot(true)
    placeLevel(THREE, detailed, spot, wheelNames(true))

    expect(light.position.toArray()).toEqual(detailed.position.toArray())
    expect(bodyBottom(light)).toBeCloseTo(FLOOR + WHEEL_RADIUS, 6)
  })

  it('колёса посадку не двигают: другой их размер её не меняет', () => {
    const own = placeLevel(THREE, carRoot(true), spot, wheelNames(true)).seat
    const foreign = placeLevel(THREE, carRoot(true, { wheelRadius: 0.4 }), spot, wheelNames(true)).seat

    expect(foreign).toEqual(own)
  })
})

describe('bodyBottomY', () => {
  it('низ кузова — пол плюс постоянная машины', () => {
    expect(bodyBottomY(0.084, 0.2346)).toBeCloseTo(0.3186, 6)
  })
})
