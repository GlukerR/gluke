import type * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface CachedViewer {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  emissiveMaterials: THREE.MeshStandardMaterial[]
  center: THREE.Vector3
  size: THREE.Vector3
  fitDistance: number
}

/* Максимум одновременно загруженных вьюверов. Каждый держит отдельный
   WebGL-контекст и GPU-ресурсы (геометрия, текстуры), поэтому при просмотре
   многих кейсов старые вытесняются по LRU и освобождаются. */
const MAX_VIEWERS = 2

/* Material.dispose() не освобождает текстуры — чистим их отдельно. */
function disposeMaterial(material: THREE.Material) {
  const standard = material as THREE.MeshStandardMaterial
  for (const map of [
    standard.map,
    standard.emissiveMap,
    standard.normalMap,
    standard.roughnessMap,
    standard.metalnessMap,
    standard.aoMap,
    standard.bumpMap,
    standard.lightMap,
  ]) {
    map?.dispose()
  }
  material.dispose()
}

/* Полностью освобождает вьювер: слушатели контролов, геометрия, материалы,
   текстуры, окружение и сам WebGL-контекст. Вызывается только для «спящих»
   вьюверов — компонент уже снял канвас с DOM и остановил рендер-цикл. */
function disposeViewer(viewer: CachedViewer) {
  viewer.controls.dispose()
  disposeObjectResources(viewer.scene)
  viewer.scene.environment?.dispose()
  viewer.renderer.dispose()
  viewer.renderer.forceContextLoss()
  viewer.renderer.domElement.remove()
}

/**
 * Освобождает ресурсы узла сцены: геометрию и материалы с их картами.
 * Вынесено отдельно от disposeViewer, потому что вьювер может держать
 * собранные, но не стоящие в сцене объекты (у конфигуратора — догруженные
 * уровни детализации), и их надо отпускать той же дорогой.
 */
export function disposeObjectResources(root: THREE.Object3D): void {
  const seen = new Set<THREE.Material>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (seen.has(material)) continue
      seen.add(material)
      disposeMaterial(material)
    }
  })
}

/**
 * Кэш вьюверов с LRU-вытеснением. Переживает смену локали/маршрута, но
 * ограничен по памяти: при добавлении сверх лимита освобождается самый
 * давно не использованный (и не висящий сейчас в DOM) вьювер.
 */
export class ViewerCache<T extends CachedViewer = CachedViewer> {
  private readonly items = new Map<string, T>()

  constructor(
    private readonly max: number = MAX_VIEWERS,
    /* Что освободить сверх сцены: у конфигуратора мимо неё остаются карты
       тайлов и уже собранные, но не показанные сейчас уровни детализации. */
    private readonly disposeExtra?: (viewer: T) => void,
  ) {}

  get(src: string): T | undefined {
    const viewer = this.items.get(src)
    if (viewer) {
      /* Обновляем позицию в LRU: переносим запись в конец. */
      this.items.delete(src)
      this.items.set(src, viewer)
    }
    return viewer
  }

  set(src: string, viewer: T) {
    this.items.delete(src)
    this.items.set(src, viewer)

    while (this.items.size > this.max) {
      const oldest = this.items.keys().next().value
      if (oldest === undefined) break
      const evicted = this.items.get(oldest)
      this.items.delete(oldest)
      if (evicted) {
        disposeViewer(evicted)
        this.disposeExtra?.(evicted)
      }
    }
  }
}

export const viewerCache = new ViewerCache()
