import type * as THREE from 'three'

export interface CachedGlukeViewer {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  pivot: THREE.Group
  tiltPivot: THREE.Group
  mixer?: THREE.AnimationMixer
  action?: THREE.AnimationAction
  fitOpen: Array<[number, number]> | null
  canvas: HTMLCanvasElement
}

/* Кэш вьювера главной страницы между перемонтированиями компонента.
   Смена языка перемонтирует HomeGlukeLogo3D, а состояние, объявленное
   внутри <script setup>, создаётся заново для каждого инстанса — поэтому
   кэш живёт в отдельном модуле (как viewerCache для кейсовых вьюверов).
   Без него модель исчезала на 1–2 с при смене языка: three.js и GLB
   грузились заново и появлялось чёрное моргание. */
let cached: CachedGlukeViewer | null = null

export function getGlukeViewer(): CachedGlukeViewer | null {
  return cached
}

export function setGlukeViewer(viewer: CachedGlukeViewer): void {
  cached = viewer
}
