import type * as THREE from 'three'

/*
 * Посадка машины в зале: где она стоит по горизонтали и на какой высоте.
 *
 * Правило одно на все уровни: **правитель посадки — подробный уровень**. Он один
 * приходит с колёсами, поэтому только по нему видно, где на самом деле низ
 * машины; упрощённый уровень (один кузов) по собственному габариту встал бы
 * ниже ровно на высоту колеса.
 *
 * Отсюда два шага. Первый уровень при смене машины (самый лёгкий) получает
 * временную посадку по своему габариту — иначе его некуда поставить, пока
 * подробный в пути. Когда подробный доехал, его посадка становится правителем,
 * и на неё переезжает всё, что уже собрано (`reseatLevels`) — иначе возврат
 * на упрощённый уровень показывал бы кузов, ушедший в пол.
 */

/** Посадка уровня: сдвиг по горизонтали и высота, на которую поднят кузов. */
export interface CarSeat {
  shift: { x: number, z: number }
  offsetY: number
}

/**
 * Куда ставить уровень: точка зала по горизонтали и низ габарита.
 *
 * Низ — обычно пол зала, но не всегда: пока подробный уровень машины в пути,
 * её кузов ставится на низ кузова прежней машины, потому что под ним стоят
 * её колёса (`borrowWheels` в конфигураторе).
 */
export interface CarSeatSpot {
  anchor: { x: number, z: number }
  bottomY: number
}

/** Ставит уровень на заданную посадку. */
export function applySeat(root: THREE.Object3D, seat: CarSeat): void {
  root.position.set(seat.shift.x, seat.offsetY, seat.shift.z)
}

/* Начало координат: замер габарита всегда идёт от него. */
const AT_ORIGIN: CarSeat = { shift: { x: 0, z: 0 }, offsetY: 0 }

/**
 * Посадка уровня по его собственному габариту: центр по горизонтали — в точку
 * зала `anchor`, низ — на `bottomY`. Ставит уровень и возвращает посадку:
 * у подробного уровня она и есть правитель для остальных.
 */
export function seatLevelByBounds(
  three: typeof import('three'),
  root: THREE.Object3D,
  spot: CarSeatSpot,
): CarSeat {
  /* Замер идёт от начала координат: функция работает и для только что
     собранного уровня, и для того, который уже где-то стоял (кузов лёгкого
     уровня переезжает на низ кузова прежней машины, когда подробный в пути).
     Без сброса в габарит попала бы прошлая посадка и уровень уехал бы дважды. */
  applySeat(root, AT_ORIGIN)
  root.updateMatrixWorld(true)
  const placed = new three.Box3().setFromObject(root)
  const center = placed.getCenter(new three.Vector3())
  const seat: CarSeat = {
    shift: { x: spot.anchor.x - center.x, z: spot.anchor.z - center.z },
    offsetY: spot.bottomY - placed.min.y,
  }
  applySeat(root, seat)
  root.updateMatrixWorld(true)
  return seat
}

/** Габарит уровня в координатах файла: `min`/`max` — [x, y, z]. */
export interface CarSeatBounds {
  min: number[]
  max: number[]
}

/**
 * Посадка машины по габариту подробного уровня из манифеста — до того, как
 * загружен хоть один GLB. Все уровни машины лежат в одних координатах, поэтому
 * эта посадка одна на всех: лёгкий уровень встаёт ровно туда, где потом
 * встанет подробный, и подмена уровней ничего не двигает.
 *
 * Считает то же, что `seatLevelByBounds` для подробного уровня: габарит
 * разворачивается на `rotationY` (как корень уровня в зале), центр по
 * горизонтали — в `anchor`, низ — на `bottomY`.
 */
export function seatFromBounds(
  three: typeof import('three'),
  bounds: CarSeatBounds,
  rotationY: number,
  spot: CarSeatSpot,
): CarSeat {
  const box = new three.Box3(
    new three.Vector3().fromArray(bounds.min),
    new three.Vector3().fromArray(bounds.max),
  ).applyMatrix4(new three.Matrix4().makeRotationY(rotationY))
  const center = box.getCenter(new three.Vector3())
  return {
    shift: { x: spot.anchor.x - center.x, z: spot.anchor.z - center.z },
    offsetY: spot.bottomY - box.min.y,
  }
}

/**
 * Переносит посадку правителя на все собранные уровни машины. Сам правитель
 * остаётся на месте: его посадка — она же и правитель.
 *
 * Возвращает число переехавших уровней: в проверке это делает правило видимым
 * (переехали все, кроме правителя), а не «должно быть так же».
 */
export function reseatLevels<T extends { root: THREE.Object3D }>(
  levels: Map<string, T>,
  ruler: CarSeat,
  rulerId: string,
): number {
  let moved = 0
  for (const [id, level] of levels) {
    if (id === rulerId) continue
    applySeat(level.root, ruler)
    level.root.updateMatrixWorld(true)
    moved++
  }
  return moved
}
