import type * as THREE from 'three'

/*
 * Посадка машины в зале: где она стоит по горизонтали и на какой высоте.
 *
 * Правило одно: **основа — кузов**, а не колёса и не габарит уровня. Посадка
 * машины считается по кузову её подробного уровня: низ кузова — на пол плюс
 * постоянную машины (высоту колеса), центр кузова — в точку зала. Колёса в
 * расчёт не входят, поэтому ни их появление, ни их отсутствие посадку не
 * двигает.
 *
 * Посадка одна на все уровни машины. Уровни выгружены из одного .blend и лежат
 * в одних координатах, а колёса LOD0 стоят в сцене отдельно и служат всем
 * уровням. Если сажать каждый уровень по его собственному кузову, упрощённый
 * кузов уезжает относительно этих колёс: у sedan-awd низ кузова LOD2 выше, чем
 * у LOD0, на 3,9 см (у упрощённой сетки срезан нижний край), а центр сдвинут на
 * 3,8 см вбок — и LOD2 садился бы на колёса на эти сантиметры. Одна посадка
 * держит кузов каждого уровня там же, где его поставил моделлер, — над теми же
 * колёсами.
 *
 * Кузов подробного уровня и постоянная лежат в манифесте (`seatBody`,
 * `seatClearance`, пишет `scripts/car-seat-bounds.mjs`), поэтому посадка
 * известна до первого GLB: самый лёгкий уровень встаёт сразу туда, где потом
 * будет стоять подробный. Без них (манифест старой выкладки) — замер кузова
 * первого пришедшего уровня, а когда доедет подробный, его замер становится
 * посадкой всех уровней.
 */

/** Посадка уровня: сдвиг по горизонтали и высота, на которую поднят кузов. */
export interface CarSeat {
  shift: { x: number, z: number }
  offsetY: number
}

/** Куда ставить кузов: его центр по горизонтали и низ по высоте. */
export interface CarSeatSpot {
  anchor: { x: number, z: number }
  /* Высота низа кузова: пол зала плюс постоянная машины. */
  bottomY: number
}

/** Замер уровня в координатах зала при посадке в начале координат. */
export interface CarLevelMeasure {
  /** Габарит кузова без колёс. */
  body: THREE.Box3
  /**
   * Постоянная машины: на сколько низ кузова выше низа уровня. Уровень с
   * колёсами даёт высоту колеса, уровень без колёс — ноль; настоящая постоянная
   * — только у подробного уровня, поэтому она и хранится в манифесте.
   */
  clearance: number
}

/** Кузов подробного уровня в координатах файла: `min`/`max` — [x, y, z]. */
export interface CarSeatBody {
  min: number[]
  max: number[]
}

/** Меши уровня, которые не считаются кузовом: колёса по ролям из манифеста. */
export type CarWheelNames = Iterable<string>

/** Начало координат: замер всегда идёт от него. */
const AT_ORIGIN: CarSeat = { shift: { x: 0, z: 0 }, offsetY: 0 }

/** Ставит уровень на заданную посадку. */
export function applySeat(root: THREE.Object3D, seat: CarSeat): void {
  root.position.set(seat.shift.x, seat.offsetY, seat.shift.z)
  root.updateMatrixWorld(true)
}

function boxOf(three: typeof import('three'), root: THREE.Object3D, wheels: CarWheelNames): {
  body: THREE.Box3
  all: THREE.Box3
} {
  const skip = new Set(wheels)
  const body = new three.Box3()
  const all = new three.Box3()
  /* Габарит уровня — весь, кузов — без колёс: ветку колеса вместе с её
     поддеревом в кузов не берём. */
  const walk = (object: THREE.Object3D, intoBody: boolean) => {
    const isWheel = skip.has(object.name)
    if ((object as THREE.Mesh).isMesh) {
      all.expandByObject(object)
      if (intoBody && !isWheel) body.expandByObject(object)
    }
    for (const child of object.children) walk(child, intoBody && !isWheel)
  }
  root.updateMatrixWorld(true)
  walk(root, true)
  return { body, all }
}

/**
 * Замер уровня: габарит кузова и постоянная машины.
 *
 * Сначала уровень ставится в начало координат: замер вбирал бы иначе прошлую
 * посадку (Box3 считает мировые координаты), и второй замер того же уровня
 * уехал бы на прежнее смещение.
 */
export function measureLevel(
  three: typeof import('three'),
  root: THREE.Object3D,
  wheels: CarWheelNames = [],
): CarLevelMeasure {
  applySeat(root, AT_ORIGIN)
  const { body, all } = boxOf(three, root, wheels)
  return { body, clearance: body.isEmpty() || all.isEmpty() ? 0 : body.min.y - all.min.y }
}

/**
 * Замер подробного уровня из манифеста — до того, как загружен хоть один GLB.
 * Кузов разворачивается на `rotationY`, как корень уровня в зале, поэтому
 * замер совпадает с `measureLevel` подробного уровня. Нет данных — `null`.
 */
export function measureFromManifest(
  three: typeof import('three'),
  manifest: { seatBody?: CarSeatBody, seatClearance?: number },
  rotationY: number,
): CarLevelMeasure | null {
  const { seatBody, seatClearance } = manifest
  if (!seatBody || typeof seatClearance !== 'number') return null
  const body = new three.Box3(
    new three.Vector3().fromArray(seatBody.min),
    new three.Vector3().fromArray(seatBody.max),
  ).applyMatrix4(new three.Matrix4().makeRotationY(rotationY))
  return { body, clearance: seatClearance }
}

/** Посадка по замеру: центр кузова — в точку зала, низ кузова — на `bottomY`. */
export function seatFromMeasure(
  three: typeof import('three'),
  measure: CarLevelMeasure,
  spot: CarSeatSpot,
): CarSeat {
  const center = measure.body.getCenter(new three.Vector3())
  return {
    shift: { x: spot.anchor.x - center.x, z: spot.anchor.z - center.z },
    offsetY: spot.bottomY - measure.body.min.y,
  }
}

/** Поставленный уровень: посадка, которой он встал, и его замер. */
export interface PlacedLevel extends CarLevelMeasure {
  seat: CarSeat
}

/**
 * Ставит уровень по его собственному кузову и возвращает посадку и замер.
 * Нужна, пока посадка машины ещё не известна: у подробного уровня она и
 * становится посадкой всех остальных.
 */
export function placeLevel(
  three: typeof import('three'),
  root: THREE.Object3D,
  spot: CarSeatSpot,
  wheels: CarWheelNames = [],
): PlacedLevel {
  const measure = measureLevel(three, root, wheels)
  const seat = seatFromMeasure(three, measure, spot)
  applySeat(root, seat)
  return { ...measure, seat }
}

/**
 * Ставит на посадку машины все её собранные уровни — и в кадре, и в кэше.
 *
 * Нужна, когда посадку дал доехавший подробный уровень (манифест без
 * `seatBody`): до него уровни стояли по замеру своего кузова. Возвращает
 * число переставленных уровней: в проверке это делает правило видимым.
 */
export function seatLevels(
  levels: Map<string, { root: THREE.Object3D }>,
  seat: CarSeat,
): number {
  let moved = 0
  for (const level of levels.values()) {
    applySeat(level.root, seat)
    moved += 1
  }
  return moved
}

/** Низ кузова над полом: точка, в которой кузов должен стоять в зале. */
export function bodyBottomY(floorY: number, clearance: number): number {
  return floorY + clearance
}
