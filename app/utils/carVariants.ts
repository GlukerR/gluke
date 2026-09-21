import type * as THREE from 'three'

/**
 * Манифест машины (`<slug>.json` рядом с GLB, копия из экспортёра).
 *
 * Экспортёр описывает каждую ноду своей ролью и вариантом: `bumper_front_a` —
 * роль `bumper_front`, вариант `a`. Конфигуратор строит панель по этому файлу,
 * поэтому вторая машина подключается одной копией GLB + манифеста, без правок
 * кода: набор вариантов берётся из данных, а не хардкодится.
 */
export interface CarManifestNode {
  role: string
  variant: string
  tris: number
  pivot: number[]
  dims: number[]
}

export interface CarManifestLod {
  file: string
  bytes: number
  tris: number
  nodes: Record<string, CarManifestNode>
}

export interface CarManifest {
  slug: string
  source?: string
  lods: Record<string, CarManifestLod>
  removed?: string[]
  warnings?: string[]
  /* Объявленные упрощения уровней: id уровня → причина, по которой он
     отличается от подробного (только кузов, без колёс, без UV1 и т. п.).
     Паритет уровней считает `app/utils/lodParity.ts`: расхождение без записи
     здесь — ошибка, с записью — известное и описанное различие. */
  parity?: Record<string, string>
  /* Посадка машины (`scripts/car-seat-bounds.mjs`, по подробному уровню):
     габарит кузова без колёс в координатах файла и постоянная — на сколько
     низ кузова выше низа уровня, то есть высота колеса. Основа посадки —
     кузов: по ним все уровни машины встают одной посадкой ещё до первого GLB,
     и колёса — есть они в уровне или нет — её не двигают
     (`app/utils/carSeating.ts`). */
  seatBody?: { min: number[], max: number[] }
  seatClearance?: number
}

/** Уровень детализации из манифеста: ключ `lods` плюс файл рядом с моделью. */
export interface CarLodEntry {
  /** Ключ в манифесте: «0», «1», «2». Он же идёт в подпись кнопки (LOD0/1/2). */
  id: string
  /** Имя GLB-файла в папке кейса — путь к нему собирает винтовка вьювера. */
  file: string
  /** Трисов в этом уровне: в панели видно цену детализации. */
  tris: number
}

/**
 * Уровни детализации по возрастанию номера. Экспортёр кладёт их в один файл
 * с машиной, поэтому в коде номер уровня нигде не хардкодится: сколько уровней
 * и как они называются — знает манифест.
 */
export function buildLods(manifest: CarManifest | null | undefined): CarLodEntry[] {
  const lods = manifest?.lods
  if (!lods) return []
  return Object.keys(lods)
    .sort((a, b) => Number(a) - Number(b))
    .map(id => ({ id, file: lods[id]?.file ?? '', tris: lods[id]?.tris ?? 0 }))
    .filter(entry => entry.file.length > 0)
}

/**
 * Порядок сборки уровней при смене машины: от самого лёгкого к выбранному,
 * включая сам выбранный.
 *
 * Уровни грузятся ступенями, а не разом: сначала в кадр встаёт самый дешёвый
 * GLB, и машина появляется почти сразу, а подробности доезжают следом и
 * подменяются на месте. Тяжелее цели не грузим ничего: это уже не нужно.
 *
 * Сортировка — по трисам манифеста, а не по номеру уровня: номер присваивает
 * экспортёр, а цену уровня знает только манифест. Уровня нет в списке — отдаём
 * всю цепочку от лёгкого к тяжёлому, чтобы машина всё равно показалась.
 */
export function buildLodLoadOrder(
  levels: readonly CarLodEntry[],
  targetId: string,
): CarLodEntry[] {
  /* Неизвестные значения — в начало и в конец: порядок важнее точности,
     а NaN в компараторе сломал бы сортировку целиком. */
  const weight = (entry: CarLodEntry) => (Number.isFinite(entry.tris) ? entry.tris : 0)
  const number = (entry: CarLodEntry) => (Number.isFinite(Number(entry.id)) ? Number(entry.id) : 0)

  const byWeight = levels.slice().sort((a, b) => weight(a) - weight(b) || number(b) - number(a))
  const target = byWeight.findIndex(entry => entry.id === targetId)
  return target < 0 ? byWeight : byWeight.slice(0, target + 1)
}

/** Одна группа переключаемых вариантов: роль в GLB + доступные варианты. */
export interface CarVariantGroup {
  /** Роль нод в манифесте — она же ключ текста в i18n. */
  id: string
  /** Варианты в порядке манифеста; `none` — «детали нет» (съёмный обвес). */
  options: string[]
}

/** Вариант «деталь снята»: под него не подходит ни одна нода. */
export const NO_VARIANT = 'none'

/* Роли, которые конфигуратор переключает. Всё остальное (кузов, двери, стёкла)
   остаётся таким, каким его собрал экспортёр: это не варианты, а части машины. */
const CONFIGURABLE_ROLES = ['bumper_front', 'bumper_rear', 'skirt', 'spoiler']

/* Съёмные детали: их можно не только переключить, но и убрать совсем. */
const DETACHABLE_ROLES = new Set(['spoiler'])

/**
 * Собирает группы вариантов из манифеста. Роль попадает в панель, только если
 * вариантов реально несколько (переключать один вариант нечего); у съёмных
 * ролей добавляется пункт «нет».
 */
export function buildVariantGroups(manifest: CarManifest | null | undefined, lod = '0'): CarVariantGroup[] {
  const nodes = manifest?.lods?.[lod]?.nodes
  if (!nodes) return []

  const byRole = new Map<string, string[]>()
  for (const node of Object.values(nodes)) {
    if (!CONFIGURABLE_ROLES.includes(node.role)) continue
    if (!node.variant) continue
    const variants = byRole.get(node.role) ?? []
    if (!variants.includes(node.variant)) variants.push(node.variant)
    byRole.set(node.role, variants)
  }

  const groups: CarVariantGroup[] = []
  for (const role of CONFIGURABLE_ROLES) {
    const variants = (byRole.get(role) ?? []).slice().sort()
    if (variants.length === 0) continue
    const detachable = DETACHABLE_ROLES.has(role)
    if (variants.length < 2 && !detachable) continue
    groups.push({
      id: role,
      options: detachable ? [NO_VARIANT, ...variants] : variants,
    })
  }
  return groups
}

/**
 * Имя ноды в том виде, в каком его отдаёт загрузчик three: пробелы становятся
 * подчёркиваниями, а `[ ] . : /` вырезаются (`Wheel.001` → `Wheel001`,
 * `Side Skirt:1` → `Side_Skirt1`). Манифест пишется по именам в Blender, где
 * точка — обычный суффикс дубликата (`.001`), поэтому без нормализации такие
 * ноды молча не находились бы в модели.
 */
export function nodeKey(name: string): string {
  return name.replace(/\s/g, '_').replace(/[[\].:/]/g, '')
}

/** Ноды про каждую роль: имя ноды в GLB → роль и вариант из манифеста. */
export function buildNodeMeta(manifest: CarManifest | null | undefined, lod = '0'): Map<string, CarManifestNode> {
  const meta = new Map<string, CarManifestNode>()
  const nodes = manifest?.lods?.[lod]?.nodes
  if (!nodes) return meta
  for (const [name, node] of Object.entries(nodes)) meta.set(nodeKey(name), node)
  return meta
}

/**
 * Имена нод уровня по роли. Колёса вьювер держит вне уровня детализации
 * (упрящённые приходят без них), поэтому список нужен и когда колёса подробного
 * уровня переносятся в сцену, и когда у самого уровня есть свои.
 */
export function nodeNamesByRole(meta: Map<string, CarManifestNode>, role: string): string[] {
  const names: string[] = []
  for (const [name, node] of meta) {
    if (node.role === role) names.push(name)
  }
  return names
}

/** Вариант по умолчанию: у съёмных роль выключена, у остальных — «сток» (`a`). */
export function defaultSelection(groups: CarVariantGroup[]): Record<string, string> {
  const selection: Record<string, string> = {}
  for (const group of groups) {
    if (group.options.includes(NO_VARIANT)) selection[group.id] = NO_VARIANT
    else selection[group.id] = group.options.includes('a') ? 'a' : (group.options[0] ?? '')
  }
  return selection
}

/** Нода видима, только если видимы все её родители: спрятанная группа гасит детей. */
function isVisible(object: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = object
  while (node) {
    if (!node.visible) return false
    node = node.parent
  }
  return true
}

export interface CarRenderStats {
  triangles: number
  drawCalls: number
}

/**
 * Живые показатели сцены: сумма трисов и draw calls по видимым мешам.
 * Считается по текущему состоянию нод, поэтому счётчик в панели всегда
 * совпадает с тем, что на экране — и меняется вместе с конфигурацией.
 */
export function countRenderStats(root: THREE.Object3D): CarRenderStats {
  let triangles = 0
  let drawCalls = 0

  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !isVisible(mesh)) return

    drawCalls += Array.isArray(mesh.material) ? mesh.material.length : 1

    const geometry = mesh.geometry as THREE.BufferGeometry | undefined
    if (!geometry) return
    const count = geometry.index
      ? geometry.index.count
      : (geometry.attributes?.position?.count ?? 0)
    triangles += Math.floor(count / 3)
  })

  return { triangles, drawCalls }
}

/**
 * Применяет выбранные варианты к нодам модели: для каждой группы видимой
 * остаётся только нода выбранного варианта (или ни одной, если выбрано «нет»).
 * Варианты в GLB лежат друг на друге, поэтому гасить невыбранные обязательно.
 */
export function applyVariantSelection(
  nodeByName: Map<string, THREE.Object3D>,
  nodeMeta: Map<string, CarManifestNode>,
  groups: CarVariantGroup[],
  selection: Record<string, string>,
): void {
  for (const group of groups) {
    const selected = selection[group.id] ?? ''
    for (const [name, node] of nodeByName) {
      const meta = nodeMeta.get(name)
      if (!meta || meta.role !== group.id) continue
      node.visible = selected !== NO_VARIANT && meta.variant === selected
    }
  }
}

/** Роль колёс в манифесте: колёса живут в сцене, а не внутри уровня детализации. */
export const WHEEL_ROLE = 'wheel'

/**
 * Трисы уровня без колёс — единый счёт HUD и монитора (§56): машина сдана без
 * колёс, те, что в кадре, подставил вьювер. Иначе рядом стояли бы 32 370 у
 * LOD0 в файле и ~8 тыс. в кадре. Это вся геометрия уровня (все варианты
 * обвеса разом), поэтому число больше живого счётчика.
 */
export function levelTrisWithoutWheels(level: CarManifestLod): number {
  let tris = level.tris
  for (const node of Object.values(level.nodes)) {
    if (node.role === WHEEL_ROLE) tris -= node.tris
  }
  return tris
}
