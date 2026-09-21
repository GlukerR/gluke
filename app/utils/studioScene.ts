import type * as THREE from 'three'
import type { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/*
 * Студийная сцена трёх вьюверов сайта: логотипа главной, модели в кейсе и
 * гаража. Рендер у всех один — прозрачный фон, sRGB, ACES, — и окружение одно:
 * RoomEnvironment через PMREM. Раньше каждый компонент собирал это сам.
 *
 * Плотность кадра и размер здесь не ставятся: у каждого вьювера свой бюджет
 * пикселей (utils/framePacing), он и решает.
 */

export interface StudioSceneOptions {
  /** Экспозиция тонмаппинга ACES (у логотипа чуть выше единицы). */
  exposure?: number
  /** Сила окружения: 1 давало засветы на светлых гранях, поэтому по умолчанию 0,5. */
  environmentIntensity?: number
}

/** Рендер и сцена со студийным окружением. */
export function createStudioScene(
  three: typeof import('three'),
  roomEnvironment: typeof RoomEnvironment,
  options: StudioSceneOptions = {},
): { renderer: THREE.WebGLRenderer, scene: THREE.Scene } {
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = three.SRGBColorSpace
  renderer.toneMapping = three.ACESFilmicToneMapping
  renderer.toneMappingExposure = options.exposure ?? 1

  const scene = new three.Scene()
  const pmrem = new three.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new roomEnvironment(), 0.04).texture
  pmrem.dispose()
  scene.environmentIntensity = options.environmentIntensity ?? 0.5

  return { renderer, scene }
}

export interface StudioLightsOptions {
  hemisphere?: number
  key?: number
  fill?: number
}

/**
 * Свет для формы: полусфера, ключевой и мягкая подсветка. Все источники
 * слегка наклонены от вертикали: при виде строго сверху блик не попадает в
 * центр. Общий у модели в кейсе и гаража (гараж потом перекрашивает их под
 * мастерскую — utils/garageAtmosphere).
 */
export function addStudioLights(
  three: typeof import('three'),
  scene: THREE.Scene,
  options: StudioLightsOptions = {},
): { hemisphere: THREE.HemisphereLight, key: THREE.DirectionalLight, fill: THREE.DirectionalLight } {
  const hemisphere = new three.HemisphereLight(0xffffff, 0x333333, options.hemisphere ?? 0.5)
  hemisphere.rotation.x = 0.08
  hemisphere.rotation.z = -0.1
  scene.add(hemisphere)

  const key = new three.DirectionalLight(0xffffff, options.key ?? 0.8)
  key.position.set(5, 5.5, 3.5)
  scene.add(key)

  const fill = new three.DirectionalLight(0xffffff, options.fill ?? 0.4)
  fill.position.set(-4.5, 2.8, -3.5)
  scene.add(fill)

  return { hemisphere, key, fill }
}
