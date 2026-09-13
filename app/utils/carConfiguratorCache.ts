import type * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { disposeCarMaterials, type CarLampSplit, type CarMaterialHandle, type CarSelection } from '~/utils/carMaterials'
import type { CarManifest, CarManifestNode, CarVariantGroup } from '~/utils/carVariants'
import { disposeObjectResources, ViewerCache, type CachedViewer } from '~/utils/modelViewerCache'

/** Собранная модель одного уровня детализации: корень, её материалы и ноды. */
export interface CarLodModel {
  root: THREE.Object3D
  materials: CarMaterialHandle
  nodeByName: Map<string, THREE.Object3D>
}

/**
 * Загруженный конфигуратор: сцена вьювера плюс всё, что нужно панели вариантов —
 * модель, её ноды по имени, роли из манифеста, текущий выбор и группы кнопок.
 */
export interface CachedCarConfigurator extends CachedViewer {
  model: THREE.Object3D
  nodeByName: Map<string, THREE.Object3D>
  nodeMeta: Map<string, CarManifestNode>
  manifest: CarManifest | null
  groups: CarVariantGroup[]
  /* Выбранный вариант по каждой группе — переживает смену языка вместе с моделью. */
  selection: Record<string, string>
  /* Материалы кузова и выбранная окраска: держим их вместе со сценой, чтобы
     переключение языка не пересобирало шейдеры и не грузило тайлы заново. */
  materials: CarMaterialHandle
  paint: CarSelection
  /* Разделитель оптики по бамперам подробного уровня: в LOD1/LOD2 бамперов
     в модели уже нет, а фары от стопов отличить всё ещё надо. */
  lampSplit: CarLampSplit | null
  /* Активный уровень детализации: смена языка возвращает сцену с тем же LOD,
     который выбрал пользователь, а не сбрасывает на LOD0. */
  lod: string
  /* Окружение машины, если оно задано кейсом: гараж стоит в сцене до самой
     машины, а его габарит задаёт пол (посадка модели) и границу отъезда
     камеры. null — конфигуратор на прозрачном фоне, как раньше. */
  garage: THREE.Object3D | null
  garageBox: THREE.Box3 | null
  /* Колёса подробного уровня, вынесенные в саму сцену: упрощённые уровни
     приходят без колёс, и без этого машина при переключении оставалась на
     пустом месте. Группа живёт ровно столько же, сколько сцена, — её ресурсы
     отпускает общий `disposeViewer` вместе с остальной сценой. */
  wheels: THREE.Group
  /* Посадка машины на пол гаража (высота, на которую поднят кузов). Считается
     один раз по подробному уровню — он один имеет колёса и касается пола —
     и применяется ко всем остальным: у LOD1/LOD2 колёс нет, и посадка по их
     собственному габариту утапливала бы кузов в пол. */
  seatOffsetY: number
  /* Движок и загрузчик держим вместе со сценой: другая детализация
     догружается уже после первого рендера, а не при монтировании. */
  three: typeof import('three')
  loader: GLTFLoader
  /* Собранные уровни: возврат на просмотренный LOD — мгновенный, без
     повторной загрузки GLB и пересборки материалов. */
  lodModels: Map<string, CarLodModel>
  /* Машина гаража, стоящая в сцене (слаг манифеста), её разворот и сдвиг
     по горизонтали: упрощённые уровни ставятся тем же разворотом и сдвигом. */
  vehicleId: string
  carRotation: number
  carShift: { x: number, z: number }
  /* Точка зала, в которую ставится любая машина (центр по горизонтали),
     и пол под ней. */
  anchor: { x: number, z: number }
  floorY: number
}

/**
 * Хендлы материалов, которым нужна текущая окраска: все собранные уровни,
 * а не только видимый.
 *
 * Колёса подробного уровня живут в сцене отдельной группой (`wheels`) — они
 * приезжают из того уровня, из которого их вынули, и их материалы остаются
 * принадлежать ему же. Когда видимым становится другой уровень, окраска,
 * наложенная только на него, до колёс не доходит: машина меняет цвет, а колёса
 * остаются в прежнем — и возврат на просмотренный уровень показывал ту краску,
 * в какой его собрали. Поэтому красим разом все уровни: запись значений
 * в юниформы стоит копейки, тайловые карты у уровней общие.
 */
export function carPaintHandles(
  viewer: Pick<CachedCarConfigurator, 'materials' | 'lodModels'>,
): CarMaterialHandle[] {
  const handles = new Set<CarMaterialHandle>([viewer.materials])
  for (const model of viewer.lodModels.values()) handles.add(model.materials)
  return [...handles]
}

/**
 * Освобождение конфигуратора сверх общей сцены: общий disposeViewer снимает
 * показанный уровень вместе с его геометрией и материалами, а собранные ранее
 * уровни детализации и их материалы остаются в стороне — их отпускаем здесь,
 * иначе каждый просмотренный LOD висит в видеопамяти до конца сессии.
 * Тайловые карты у уровней общие: первый вызов уже чистит кэш, остальные
 * проходят по пустому словарю.
 */
function disposeCarViewerExtra(viewer: CachedCarConfigurator): void {
  /* Сетка режима TECH — линии, а не меши: общий disposeObjectResources их
     пропускает, поэтому их геометрию отпускаем здесь, по всем уровням. */
  const roots = [viewer.scene, ...[...viewer.lodModels.values()].map(model => model.root)]
  for (const root of roots) {
    root.traverse((object) => {
      if (object.userData.garageWire) (object as THREE.LineSegments).geometry.dispose()
    })
  }
  for (const model of viewer.lodModels.values()) {
    if (model.root === viewer.model) continue
    disposeObjectResources(model.root)
    disposeCarMaterials(model.materials)
  }
  disposeCarMaterials(viewer.materials)
}

/**
 * Кэш конфигураторов. На странице кейса он всегда один, поэтому в памяти держим
 * единственный инстанс: смена языка или возврат в кейс подхватывают уже
 * загруженную модель вместо повторной загрузки GLB с миганием постера.
 */
export const carConfiguratorCache = new ViewerCache<CachedCarConfigurator>(1, disposeCarViewerExtra)
