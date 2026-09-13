import type * as THREE from 'three'

/**
 * Посадка машины на пол окружения.
 *
 * Нижняя точка габарита гаража — не пол. У зала NFS 2015 по периметру идёт
 * плинтус на 13 см ниже плиты пола, и посадка по габариту утапливала машину
 * в плиту по ступицы: колёса стояли внутри пола, а не на нём. Пол ищем там,
 * где машина действительно стоит — под её габаритом.
 *
 * Пробы идут сеткой сверху вниз, каждая берёт самое высокое попадание в своей
 * точке. Дальше из попаданий выбирается доминирующая плоскость: они
 * группируются по высоте с допуском, побеждает самая населённая группа, от неё
 * берётся медиана. Так на результат не влияют ни свисающая над машиной лампа,
 * ни реквизит на полу: пол занимает почти весь габарит и потому побеждает.
 * Габарит гаража при этом остаётся нужен — по нему камера считает, где стены.
 */

/** Допуск, в котором попадания считаются одной плоскостью (метры). */
const PLANE_TOLERANCE = 0.03

export interface GarageFloorProbe {
  /* Габарит машины в мировых координатах: под ним ищем пол. */
  footprint: Pick<THREE.Box3, 'min' | 'max'>
  /* Высота, с которой бросаем лучи: заведомо выше машины. */
  from: number
  /* Проб на сторону габарита. Больше — устойчивее группа, пяти хватает. */
  samples?: number
}

/**
 * Уровень пола под машиной в мировых координатах — или `null`, если под
 * габаритом ничего не нашлось (тогда вызывающий решает, на что опереться).
 * Окружение может быть повёрнуто и отмасштабировано контентом: лучи идут по
 * мировым матрицам, поэтому считается именно то, что видно.
 */
export function garageFloorLevel(
  three: typeof import('three'),
  garage: THREE.Object3D,
  probe: GarageFloorProbe,
): number | null {
  const samples = Math.max(2, Math.round(probe.samples ?? 5))
  const ray = new three.Raycaster()
  const down = new three.Vector3(0, -1, 0)
  const hits: number[] = []
  const { min, max } = probe.footprint

  garage.updateMatrixWorld(true)
  for (let i = 0; i < samples; i += 1) {
    for (let j = 0; j < samples; j += 1) {
      const x = min.x + (max.x - min.x) * (i / (samples - 1))
      const z = min.z + (max.z - min.z) * (j / (samples - 1))
      ray.set(new three.Vector3(x, probe.from, z), down)
      /* Первое попадание сверху — самая высокая поверхность под точкой. */
      const hit = ray.intersectObject(garage, true)[0]
      if (hit) hits.push(hit.point.y)
    }
  }
  if (!hits.length) return null

  hits.sort((a, b) => a - b)

  /* Доминирующая плоскость: самая населённая группа попаданий по высоте,
     при равном размере — нижняя (пол ниже свисающего над машиной реквизита). */
  let bestStart = 0
  let bestCount = 0
  for (let start = 0; start < hits.length; start += 1) {
    const low = hits[start]
    if (low === undefined) continue
    let count = 1
    while (start + count < hits.length && (hits[start + count] ?? 0) - low <= PLANE_TOLERANCE) count += 1
    if (count > bestCount) {
      bestCount = count
      bestStart = start
    }
  }

  const plane = hits.slice(bestStart, bestStart + bestCount)
  return plane[Math.floor(plane.length / 2)] ?? null
}
