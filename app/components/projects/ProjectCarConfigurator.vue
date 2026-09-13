<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type * as THREE from 'three'
import { carConfiguratorCache, carPaintHandles, type CachedCarConfigurator, type CarLodModel } from '~/utils/carConfiguratorCache'
import {
  applyVariantSelection,
  buildLods,
  buildNodeMeta,
  buildVariantGroups,
  countRenderStats,
  defaultSelection,
  nodeNamesByRole,
  NO_VARIANT,
  type CarLodEntry,
  type CarManifest,
  type CarRenderStats,
  type CarVariantGroup,
} from '~/utils/carVariants'
import {
  CAR_COVERAGES,
  CAR_PAINT_COLORS,
  CAR_PATTERNS,
  carModelBase,
  carTextureBase,
  createCarMaterials,
  defaultCarSelection,
  lampSplitFromBumpers,
  PATTERN_SCALE_MAX,
  PATTERN_SCALE_MIN,
  patternScale,
  resolveColor,
  resolveCoverage,
  resolvePattern,
  setCarSelection,
  type CarSelection,
} from '~/utils/carMaterials'
import { loadCarSelection, saveCarSelection } from '~/utils/carPaintStorage'
import { createGarageAudio, type GarageAudio, type GarageAudioState, type GarageAudioTrack } from '~/utils/garageAudio'
import { dressGarage } from '~/utils/garageAtmosphere'
import {
  easeInOutCubic,
  focusAzimuth,
  GARAGE_FOCUS,
  polarFromElevation,
  shortestAngleDelta,
  viewShiftForPanel,
} from '~/utils/garageCamera'
import { garageFloorLevel } from '~/utils/garageFloor'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'

/* Настройки модели приходят из frontmatter кейса (`model:`) — тот же набор,
   что у обычного вьювера, поэтому кейс с конфигуратором настраивается так же:
   разворот, свет, металличность, кадрирование. */
/* `model.autoRotate`/`autoRotateSpeed` здесь намеренно не читаются: камера
   гаража ходит только за мышью и за выбором детали в HUD. Автоповорот сам
   уводил бы кадр в реквизит зала, стоящий в нескольких метрах от машины. */
interface ConfiguratorModel {
  src: string
  alt: string
  width: number
  height: number
  emissivePulse?: number
  emissivePulseHz?: number
  metalness?: number
  diffuseLift?: number
  rotation?: number
  environmentIntensity?: number
  hemisphereLight?: number
  keyLight?: number
  fillLight?: number
  zoomMin?: number
  zoomMax?: number
  fit?: number
  canvasScale?: number
}

/* Окружение вокруг машины (`configurator.garage` в контенте кейса): коробка
   гаража, внутрь которой ставится модель. Пол гаража — его нижняя точка: по
   ней машина садится на землю, а камера остаётся внутри стен. */
interface ConfiguratorGarage {
  src: string
  scale?: number
  rotation?: number
  /* Разрешённая дуга облёта камеры вокруг машины, градусы. Без границ камера
     обходит машину полным кругом; дуга нужна окружениям с проёмом в стене. */
  orbitFrom?: number
  orbitTo?: number
  /* Пределы по высоте, градусы над горизонтом цели (по умолчанию 3 и 50). */
  tiltFrom?: number
  tiltTo?: number
  /* Кадрирование и предел отъезда в гараже, отдельно от `model:`. */
  fit?: number
  zoomMax?: number
}

/* Музыка зала (`configurator.audio`): один трек или очередь. Вместе со
   страницей она не грузится — адрес отдаётся, когда сцена уже собрана. */
interface ConfiguratorAudio {
  src?: string
  tracks?: { src: string, title: string, artist?: string }[]
  volume?: number
  fadeIn?: number
}

const props = withDefaults(defineProps<{
  model: ConfiguratorModel
  /* Манифест вариантов (`<slug>.json` рядом с GLB): какие ноды к какой роли
     и варианту относятся. HUD строится по нему — вторая машина подключается
     копией манифеста, без правок кода. */
  manifest: string
  garage?: ConfiguratorGarage
  audio?: ConfiguratorAudio
  poster?: string
  /* Постер грузить сразу (hero-позиция, LCP), а не лениво. */
  priority?: boolean
}>(), {
  garage: undefined,
  audio: undefined,
  poster: undefined,
  priority: false,
})

const { t, locale } = useI18n()

const container = ref<HTMLElement | null>(null)
/* Группы обвеса для HUD — всегда полный набор, по самой подробной
   детализации: на других уровнях обвесов в модели нет, но раздел должен
   остаться на месте и показать, что выбор там недоступен. */
const groups = ref<CarVariantGroup[]>([])
const kitsActive = ref(true)
const selection = ref<Record<string, string>>({})
const stats = ref<CarRenderStats | null>(null)
const lods = ref<CarLodEntry[]>([])
const lod = ref<string>('0')
/* Манифест нужен и шаблону: трисы каждого варианта обвеса и каждого уровня
   берутся из него, а не из загруженной сцены. */
const manifestData = shallowRef<CarManifest | null>(null)
/* Окраска: цвет кузова, узор и покрытие — три независимые оси. */
const paint = ref<CarSelection>(defaultCarSelection())

const textureBase = computed(() => carTextureBase(props.model.src))

/* Загруженный конфигуратор переиспользуем между инстансами: при смене языка
   страница перемонтируется, но модель не грузим заново. */
const CACHE_KEY = `${props.model.src}|${props.garage?.src ?? ''}|configurator`
const cachedViewer = carConfiguratorCache.get(CACHE_KEY)
const status = ref<'loading' | 'ready' | 'error'>(cachedViewer ? 'ready' : 'loading')
if (cachedViewer) {
  groups.value = cachedViewer.groups
  selection.value = { ...cachedViewer.selection }
  paint.value = { ...cachedViewer.paint }
  lod.value = cachedViewer.lod
  manifestData.value = cachedViewer.manifest
  kitsActive.value = buildVariantGroups(cachedViewer.manifest, cachedViewer.lod).length > 0
}

const GARAGE_TILT_FROM = 3
const GARAGE_TILT_TO = 50

/* Роль колёс в манифесте: колёса живут в сцене, а не внутри уровня детализации. */
const WHEEL_ROLE = 'wheel'

const EMISSIVE_PULSE_MAX = props.model.emissivePulse ?? 5
const EMISSIVE_PULSE_HZ = props.model.emissivePulseHz ?? 0.7

const modelBase = carModelBase(props.model.src)

/** Путь к GLB уровня детализации. */
function lodSrc(entry: CarLodEntry | undefined): string {
  return entry ? `${modelBase}/${entry.file}` : props.model.src
}

const FIT_FILL = props.garage?.fit ?? props.model.fit ?? 1.25
const CANVAS_SCALE = props.model.canvasScale ?? 1

let viewer: CachedCarConfigurator | undefined = cachedViewer
let viewerGroups: CarVariantGroup[] = []
let manifestPromise: Promise<CarManifest | null> | null = null
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let animationFrame = 0
let accumulatedMs = 0
let lastFrameAt = 0
let lastRenderAt = 0
/* Гараж — главный экран кейса: на десктопе он рисуется с частотой экрана.
   На тач-устройствах остаётся прежний потолок в 30 кадров — батарея
   телефона дороже плавности облёта. Пока камера едет к детали или кадр
   сдвигается под панель, кадр рисуется без потолка на любом устройстве. */
const FRAME_INTERVAL = 1000 / 30
let fullFrameRate = false
let userDragging = false
let disposed = false
let idleId: number | null = null
const IDLE_TIMEOUT = 2500

/* ───── HUD: разделы ───── */

type HudCategory = 'vehicles' | 'body' | 'paint' | 'decals' | 'material' | 'tech'
const HUD_CATEGORIES: readonly HudCategory[] = ['vehicles', 'body', 'paint', 'decals', 'material', 'tech']

/* Открытый раздел; `null` — режим осмотра: в кадре только гараж, машина
   и постоянные элементы HUD. Раздел — состояние одного слоя, не страница. */
const activeCategory = ref<HudCategory | null>(null)
/* Деталь, к которой последний раз подъезжала камера, — для строки контекста. */
const focusRole = ref<string | null>(null)

const hudRoot = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const menuButtons = ref<HTMLElement[]>([])
const menuIndicator = ref({ x: 0, width: 0, visible: false })
/* Узкая раскладка: панель — шторка снизу, подписи меню короче. */
const HUD_NARROW = 900
const narrow = ref(false)

function categoryIndex(category: HudCategory): string {
  return String(HUD_CATEGORIES.indexOf(category) + 1).padStart(2, '0')
}

function toggleCategory(category: HudCategory) {
  activeCategory.value = activeCategory.value === category ? null : category
}

function closeCategory() {
  activeCategory.value = null
}

function onHudKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && activeCategory.value) {
    event.stopPropagation()
    closeCategory()
  }
}

function syncMenuIndicator() {
  const index = activeCategory.value ? HUD_CATEGORIES.indexOf(activeCategory.value) : -1
  const button = index >= 0 ? menuButtons.value[index] : undefined
  if (!button) {
    menuIndicator.value = { ...menuIndicator.value, visible: false }
    return
  }
  menuIndicator.value = { x: button.offsetLeft, width: button.offsetWidth, visible: true }
}

/* Машина одна на кейс, имя берётся из слага манифеста (`coupe-gt` → COUPE GT):
   марок в кейсе нет, а следующая машина получит имя тем же путём. */
const vehicleSlug = props.manifest.split('/').pop()?.replace(/\.json$/i, '') ?? 'car'
const vehicleName = vehicleSlug.replace(/[-_]+/g, ' ').toUpperCase()
const vehicles = computed(() => [{ id: vehicleSlug, index: '01', name: vehicleName }])

/* ───── Кадр ───── */

function onDragStart() {
  userDragging = true
  /* Мышь важнее подъезда: потянули сцену — камера остаётся у руки. */
  cameraTween = null
}

function onDragEnd() {
  userDragging = false
}

/* Зум колесом — только с Ctrl/⌘, простое колесо листает страницу. */
function onWheelCapture(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) return
  event.stopPropagation()
}

function frameCamera() {
  if (!viewer || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  if (w === 0 || h === 0) return

  const direction = viewer.camera.position.clone().sub(viewer.controls.target)
  const currentDistance = direction.length() || 1
  direction.normalize()

  const aspect = w / h
  const vHalf = Math.tan((viewer.camera.fov * Math.PI) / 360) || 0.0001
  const hHalf = vHalf * aspect
  const maxDim = Math.max(viewer.size.x, viewer.size.y, viewer.size.z)
  /* На портретном кадре (телефон) камера не отъезжает дальше, чем на
     горизонтальном: иначе она уходит в реквизит зала, а машина в три четверти
     и так уже уже своей длины. Края кузова на сбоку допустимо срезать. */
  const half = Math.max(Math.min(vHalf, hHalf), vHalf * 0.9)
  const fit = ((maxDim / 2) / half) * FIT_FILL

  const ratio = viewer.fitDistance > 0 ? currentDistance / viewer.fitDistance : 1
  const distance = fit * ratio

  viewer.camera.position.copy(viewer.controls.target).addScaledVector(direction, distance)
  viewer.camera.near = distance / 100
  viewer.camera.far = distance * 100
  viewer.camera.updateProjectionMatrix()
  const minDistance = fit * (props.model.zoomMin ?? 0.9)
  const maxDistance = fit * (props.garage?.zoomMax ?? props.model.zoomMax ?? 1.4)
  /* Гараж ограничивает отъезд: расстояние считаем от цели облёта до каждой
     из четырёх стен — машина стоит не в середине зала. */
  const center = viewer.controls.target
  const wallLimit = viewer.garageBox
    ? 0.9 * Math.min(
      center.x - viewer.garageBox.min.x,
      viewer.garageBox.max.x - center.x,
      center.z - viewer.garageBox.min.z,
      viewer.garageBox.max.z - center.z,
    )
    : Infinity
  viewer.controls.minDistance = minDistance
  viewer.controls.maxDistance = Math.max(Math.min(maxDistance, wallLimit), minDistance * 1.05)
  viewer.controls.update()
  viewer.fitDistance = fit
}

function resizeRenderer() {
  if (!viewer || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  if (w === 0 || h === 0) return
  const scale = window.innerWidth >= 1024 ? CANVAS_SCALE : 1
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  viewer.renderer.setSize(cw, ch)
  viewer.camera.aspect = cw / ch
  viewer.camera.updateProjectionMatrix()
  narrow.value = w < HUD_NARROW
  frameCamera()
  updateViewShiftTarget()
  applyViewShift()
  syncMenuIndicator()
}

/* ───── Подъезд камеры к детали ───── */

interface CameraTween {
  fromTheta: number
  deltaTheta: number
  fromPhi: number
  toPhi: number
  startedAt: number
}
const CAMERA_TWEEN_MS = 1100
let cameraTween: CameraTween | null = null

/** Центр видимых нод роли в мире — к нему подъезжает камера. */
function roleCenter(active: CachedCarConfigurator, role: string): THREE.Vector3 | null {
  const box = new active.three.Box3()
  for (const [name, node] of active.nodeByName) {
    if (active.nodeMeta.get(name)?.role !== role || !node.visible) continue
    box.expandByObject(node)
  }
  return box.isEmpty() ? null : box.getCenter(new active.three.Vector3())
}

/*
 * Камера мягко встаёт к выбранной детали: к переднему бамперу — в три четверти
 * спереди, к заднему — сзади, к юбкам — сбоку. Дистанция не меняется, подъём
 * небольшой: это подъезд внутри того же гаража, а не монтажная склейка.
 */
function focusOnRole(role: string) {
  focusRole.value = role
  const active = viewer
  const spec = GARAGE_FOCUS[role]
  if (!active || !spec || status.value !== 'ready' || !kitsActive.value) return

  const { three, camera, controls } = active
  const offset = camera.position.clone().sub(controls.target)
  const spherical = new three.Spherical().setFromVector3(offset)
  const center = spec.view === 'end' ? roleCenter(active, role) : null
  const size = new three.Box3().setFromObject(active.model).getSize(new three.Vector3())

  const theta = focusAzimuth({
    spec,
    theta: spherical.theta,
    part: center ? { x: center.x - controls.target.x, z: center.z - controls.target.z } : undefined,
    size: { x: size.x, z: size.z },
  })
  if (theta === null) return

  let toTheta = theta
  if (Number.isFinite(controls.minAzimuthAngle) && Number.isFinite(controls.maxAzimuthAngle)) {
    toTheta = Math.min(controls.maxAzimuthAngle, Math.max(controls.minAzimuthAngle, theta))
  }
  const toPhi = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, polarFromElevation(spec.elevation)))

  cameraTween = {
    fromTheta: spherical.theta,
    deltaTheta: shortestAngleDelta(spherical.theta, toTheta),
    fromPhi: spherical.phi,
    toPhi,
    startedAt: performance.now(),
  }
}

function stepCameraTween(now: number): boolean {
  const active = viewer
  if (!cameraTween || !active) return false
  const progress = Math.min(1, (now - cameraTween.startedAt) / CAMERA_TWEEN_MS)
  const eased = easeInOutCubic(progress)
  const { camera, controls } = active
  const radius = camera.position.distanceTo(controls.target)
  const offset = new active.three.Vector3().setFromSphericalCoords(
    radius,
    cameraTween.fromPhi + (cameraTween.toPhi - cameraTween.fromPhi) * eased,
    cameraTween.fromTheta + cameraTween.deltaTheta * eased,
  )
  camera.position.copy(controls.target).add(offset)
  if (progress >= 1) cameraTween = null
  return true
}

/* ───── Сдвиг кадра под панель ───── */

/* Панель не накрывает машину: проекция камеры сдвигается (`setViewOffset`),
   и машина плавно уходит в свободную часть кадра. Камера, облёт и гараж при
   этом те же — меняется только композиция. */
const viewShift = { x: 0, y: 0 }
let viewShiftTarget = { x: 0, y: 0 }

function updateViewShiftTarget() {
  if (!container.value) return
  const panel = activeCategory.value ? panelEl.value : null
  viewShiftTarget = viewShiftForPanel({
    width: container.value.clientWidth,
    height: container.value.clientHeight,
    narrow: narrow.value,
    panel: panel ? { right: panel.offsetLeft + panel.offsetWidth, height: panel.offsetHeight } : null,
  })
}

function applyViewShift() {
  if (!viewer) return
  const { renderer, camera } = viewer
  const size = renderer.getSize(new viewer.three.Vector2())
  const scale = container.value?.clientWidth ? size.x / container.value.clientWidth : 1
  if (Math.abs(viewShift.x) < 0.5 && Math.abs(viewShift.y) < 0.5) {
    if (camera.view?.enabled) camera.clearViewOffset()
    return
  }
  camera.setViewOffset(size.x, size.y, -viewShift.x * scale, viewShift.y * scale, size.x, size.y)
}

function stepViewShift(dt: number): boolean {
  const dx = viewShiftTarget.x - viewShift.x
  const dy = viewShiftTarget.y - viewShift.y
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    if (dx === 0 && dy === 0) return false
    viewShift.x = viewShiftTarget.x
    viewShift.y = viewShiftTarget.y
    applyViewShift()
    return false
  }
  const k = 1 - Math.exp(-dt / 150)
  viewShift.x += dx * k
  viewShift.y += dy * k
  applyViewShift()
  return true
}

/* ───── Цикл ───── */

const fps = ref(0)
let fpsFrames = 0
let fpsSince = 0

function startLoop() {
  if (!viewer || animationFrame) return
  lastFrameAt = performance.now()
  lastRenderAt = 0
  fpsSince = lastFrameAt
  fpsFrames = 0
  const animate = () => {
    if (disposed || !viewer) return
    animationFrame = requestAnimationFrame(animate)

    const now = performance.now()
    const moving = !!cameraTween || viewShiftTarget.x !== viewShift.x || viewShiftTarget.y !== viewShift.y
    if (!userDragging && !moving && !fullFrameRate && now - lastRenderAt < FRAME_INTERVAL) return
    const dt = lastRenderAt ? Math.min(100, now - lastRenderAt) : 16
    lastRenderAt = now

    accumulatedMs += now - lastFrameAt
    lastFrameAt = now

    const elapsed = accumulatedMs / 1000
    const phase = (Math.sin(elapsed * EMISSIVE_PULSE_HZ * Math.PI * 2) + 1) / 2
    for (const material of viewer.emissiveMaterials) {
      material.emissiveIntensity = phase * EMISSIVE_PULSE_MAX
    }

    stepCameraTween(now)
    stepViewShift(dt)
    viewer.controls.update()
    viewer.renderer.render(viewer.scene, viewer.camera)

    fpsFrames += 1
    if (now - fpsSince >= 500) {
      fps.value = Math.round((fpsFrames * 1000) / (now - fpsSince))
      fpsFrames = 0
      fpsSince = now
    }
  }
  animate()
}

function stopLoop() {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function observeVisibility() {
  if (!container.value || intersectionObserver) return
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) startLoop()
        else stopLoop()
      }
    },
    { rootMargin: '200px 0px' },
  )
  intersectionObserver.observe(container.value)
}

/* ───── Технический монитор ───── */

/*
 * Живые показатели текущей конфигурации: считаем по видимым мешам после
 * каждого переключения, поэтому счётчик всегда совпадает с тем, что на экране.
 *
 * Колёса в цифры машины не идут (§56): машина сдана без них, то, что стоит
 * в кадре, вьювер подставил сам. Текстуры и видеопамять — наоборот, по всей
 * сцене: это цена кадра целиком, вместе с гаражом, и подписаны они отдельно.
 */
interface TechStats {
  vertices: number
  textures: number
  vramMb: number
}
const tech = ref<TechStats | null>(null)

function isVisibleInScene(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false
  }
  return true
}

function refreshStats() {
  if (!viewer) return
  stats.value = countRenderStats(viewer.model)

  let vertices = 0
  viewer.model.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !isVisibleInScene(mesh)) return
    vertices += mesh.geometry?.attributes?.position?.count ?? 0
  })

  /* Видеопамять — оценка сверху по тому, что реально лежит в сцене: буферы
     видимой геометрии и карты материалов (с мип-уровнями). Точного счётчика
     байтов WebGL не отдаёт. */
  const geometries = new Set<THREE.BufferGeometry>()
  const textures = new Set<THREE.Texture>()
  const addTexture = (value: unknown) => {
    if (value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture)
  }
  viewer.scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !isVisibleInScene(mesh)) return
    geometries.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      for (const value of Object.values(material)) addTexture(value)
      const uniforms = material.userData.carUniforms as Record<string, { value: unknown }> | undefined
      if (uniforms) for (const uniform of Object.values(uniforms)) addTexture(uniform.value)
    }
  })
  for (const tile of viewer.materials.tiles.values()) addTexture(tile)
  addTexture(viewer.scene.environment)

  let bytes = 0
  for (const geometry of geometries) {
    for (const attribute of Object.values(geometry.attributes)) {
      bytes += (attribute as THREE.BufferAttribute).array?.byteLength ?? 0
    }
    bytes += geometry.index?.array.byteLength ?? 0
  }
  for (const texture of textures) {
    const image = texture.image as { width?: number, height?: number } | undefined
    const pixels = (image?.width ?? 0) * (image?.height ?? 0)
    bytes += pixels * 4 * (texture.generateMipmaps ? 4 / 3 : 1)
  }

  tech.value = {
    vertices,
    textures: viewer.renderer.info.memory.textures,
    vramMb: bytes / (1024 * 1024),
  }
}

/* Сетка режима TECH: линии поверх кузова, дочерние к мешам — гаснут вместе
   со своим вариантом обвеса и уезжают вместе с колёсами. Строятся лениво,
   при первом включении, и не попадают в счётчик (это не меши). */
const wireframe = ref(true)
const showWireframe = computed(() => activeCategory.value === 'tech' && wireframe.value)
let wireMaterial: THREE.LineBasicMaterial | null = null

function syncWireframe() {
  const active = viewer
  if (!active) return
  const on = showWireframe.value
  const meshes: THREE.Mesh[] = []
  for (const root of [active.model, active.wheels]) {
    root.traverse((object) => {
      if ((object as THREE.Mesh).isMesh && !object.userData.garageWire) meshes.push(object as THREE.Mesh)
    })
  }
  for (const mesh of meshes) {
    let line = mesh.children.find(child => child.userData.garageWire)
    if (!line && on) {
      wireMaterial ??= new active.three.LineBasicMaterial({
        color: 0x62d3e8,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        fog: false,
      })
      line = new active.three.LineSegments(new active.three.WireframeGeometry(mesh.geometry), wireMaterial)
      line.userData.garageWire = true
      line.raycast = () => {}
      mesh.add(line)
    }
    if (line) line.visible = on
  }
}

/* ───── Уровни, обвес, окраска ───── */

function ensureLod(active: CachedCarConfigurator): void {
  const activeGroups = buildVariantGroups(active.manifest, active.lod)
  active.nodeMeta = buildNodeMeta(active.manifest, active.lod)
  kitsActive.value = activeGroups.length > 0
  viewerGroups = activeGroups
}

/** Узел лежит в поддереве `root` (по цепочке родителей). */
function isDescendant(node: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent === root) return true
  }
  return false
}

function wheelNodes(active: CachedCarConfigurator): THREE.Object3D[] {
  return nodeNamesByRole(active.nodeMeta, WHEEL_ROLE)
    .map(name => active.nodeByName.get(name))
    .filter((node): node is THREE.Object3D => !!node)
}

/*
 * Колёса держим в сцене, а не внутри уровня детализации: упрощённые уровни
 * приходят без колёс вовсе. Ноды подробного уровня переносятся в группу
 * `lod-wheels` через `attach` с сохранением мировых координат.
 */
function hoistWheels(active: CachedCarConfigurator): void {
  if (active.wheels.children.length > 0) return
  if (active.lod !== lods.value[0]?.id) return

  const nodes = wheelNodes(active)
  if (nodes.length === 0) return

  active.wheels.name = 'lod-wheels'
  active.scene.add(active.wheels)
  active.wheels.updateMatrixWorld(true)
  for (const node of nodes) active.wheels.attach(node)
}

function syncWheels(active: CachedCarConfigurator): void {
  const own = wheelNodes(active).filter(node => isDescendant(node, active.model))
  active.wheels.visible = own.length === 0
  for (const node of own) node.visible = true
}

function applySelection() {
  if (!viewer) return
  viewer.selection = { ...selection.value }
  applyVariantSelection(viewer.nodeByName, viewer.nodeMeta, viewerGroups, selection.value)
  refreshStats()
}

/* Окраска одной точкой: красятся все собранные уровни сразу (§55). */
async function paintScene(): Promise<void> {
  if (!viewer) return
  await Promise.all(carPaintHandles(viewer).map(handle => setCarSelection(handle, { ...paint.value })))
}

function selectVariant(groupId: string, variant: string) {
  if (status.value !== 'ready' || !kitsActive.value) return
  focusOnRole(groupId)
  if (selection.value[groupId] === variant) return
  selection.value = { ...selection.value, [groupId]: variant }
  applySelection()
}

/* Смена уровня детализации: модель подменяется в той же сцене, камера,
   окраска и узор остаются как были — меняется только геометрия. */
async function selectLod(nextLod: string) {
  const active = viewer
  if (!active || status.value !== 'ready' || active.lod === nextLod) return

  const entry = lods.value.find(item => item.id === nextLod)
  if (!entry) return

  status.value = 'loading'
  try {
    const next = active.lodModels.get(nextLod) ?? await buildLodModel(active, entry)
    if (disposed || viewer !== active) return

    active.scene.remove(active.model)
    active.lodModels.set(nextLod, next)
    active.model = next.root
    active.materials = next.materials
    active.nodeByName = next.nodeByName
    active.lod = nextLod
    active.scene.add(next.root)

    ensureLod(active)
    syncWheels(active)
    applySelection()
    await paintScene()
    lod.value = nextLod
    syncWireframe()
    status.value = 'ready'
  }
  catch (error) {
    status.value = 'ready'
    console.error('[3d] car configurator lod failed:', nextLod, error)
  }
}

async function buildLodModel(active: CachedCarConfigurator, entry: CarLodEntry): Promise<CarLodModel> {
  /* Свой декодер на загрузку: после первого GLB draco уничтожается. */
  const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
  const draco = new DRACOLoader()
  active.loader.setDRACOLoader(draco)

  let root: THREE.Object3D
  try {
    const gltf = await active.loader.loadAsync(lodSrc(entry))
    root = gltf.scene
  }
  finally {
    draco.dispose()
  }

  root.rotation.y = ((props.model.rotation ?? 0) * Math.PI) / 180
  /* Уровень переносится тем же смещением, что и LOD0 (колёса есть только
     у подробного уровня). */
  root.position.y += active.seatOffsetY

  const materials = createCarMaterials(active.three, root, {
    textureBase: carTextureBase(props.model.src),
    anisotropy: active.renderer.capabilities.getMaxAnisotropy(),
    selection: { ...paint.value },
    lampSplit: active.lampSplit ?? lampSplitFromBumpers(active.three, root),
    tileCache: active.materials.tiles,
    wheelNodes: nodeNamesByRole(buildNodeMeta(active.manifest, entry.id), WHEEL_ROLE),
  })
  await setCarSelection(materials, { ...paint.value })

  const nodeByName = new Map<string, THREE.Object3D>()
  root.traverse((object) => {
    if (object.name) nodeByName.set(object.name, object)
  })

  return { root, materials, nodeByName }
}

/* Сброс возвращает и обвес, и окраску: «сток» плюс окраска по умолчанию. */
function resetSelection() {
  if (status.value !== 'ready') return
  if (groups.value.length > 0) {
    selection.value = defaultSelection(groups.value)
    applySelection()
  }
  void applyPaint(defaultCarSelection())
}

/* Смена окраски не пересобирает геометрию: значения уезжают в юниформы.
   Выбор пишется в localStorage (§59) — машина встречает вернувшегося
   посетителя в той же окраске. */
async function applyPaint(next: CarSelection) {
  paint.value = next
  saveCarSelection(next)
  if (!viewer) return
  viewer.paint = { ...next }
  await paintScene()
}

function selectPaint(kind: 'color' | 'pattern' | 'coverage', id: string) {
  if (status.value !== 'ready') return
  if (paint.value[kind] === id) return
  void applyPaint({ ...paint.value, [kind]: id })
}

function selectScale(scale: number) {
  if (status.value !== 'ready') return
  if (paint.value.scale === scale) return
  void applyPaint({ ...paint.value, scale })
}

/* ───── Подписи ───── */

const numberFormat = computed(() => new Intl.NumberFormat(locale.value === 'ru' ? 'ru-RU' : 'en-US'))
const decimalFormat = computed(() => new Intl.NumberFormat(locale.value === 'ru' ? 'ru-RU' : 'en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}))

function formatNumber(value: number | undefined): string {
  return value === undefined ? '—' : numberFormat.value.format(value)
}

function optionLabel(variant: string): string {
  if (variant === NO_VARIANT) return t('project.configurator.none')
  const names: Record<string, string> = { a: 'stock', b: 'sport', c: 'racing' }
  return t(`project.configurator.variants.${names[variant] ?? variant}`)
}

function roleLabel(role: string): string {
  return t(`project.configurator.roles.${role}`)
}

/* Трисы варианта — из манифеста подробного уровня: цена детали в модели. */
function variantTris(role: string, variant: string): number | undefined {
  const nodes = manifestData.value?.lods?.[lods.value[0]?.id ?? '0']?.nodes
  if (!nodes) return undefined
  for (const node of Object.values(nodes)) {
    if (node.role === role && node.variant === variant) return node.tris
  }
  return undefined
}

/* Полоска «сложности» варианта: доля от самого тяжёлого в группе. */
function variantWeight(role: string, variant: string, options: string[]): number {
  const values = options.map(option => variantTris(role, option) ?? 0)
  const max = Math.max(1, ...values)
  return (variantTris(role, variant) ?? 0) / max
}

const activeColor = computed(() => resolveColor(paint.value.color))
const activePattern = computed(() => resolvePattern(paint.value.pattern))
const activeCoverage = computed(() => resolveCoverage(paint.value.coverage))
const hasPatternTile = computed(() => !!activePattern.value.tile)
const scaleValue = computed(() => patternScale(paint.value.scale))
const scaleProgress = computed(() => (scaleValue.value - PATTERN_SCALE_MIN) / (PATTERN_SCALE_MAX - PATTERN_SCALE_MIN))

function colorName(id: string): string {
  return t(`project.configurator.paint.colors.${id}`)
}

function patternName(id: string): string {
  return id === 'none' ? t('project.configurator.hud.noDecal') : t(`project.configurator.paint.patterns.${id}`)
}

function coverageName(id: string): string {
  return t(`project.configurator.paint.coverages.${id}`)
}

/* Трисы уровня без колёс — в том же счёте, что и монитор (§56): иначе рядом
   стояли бы 32 370 у LOD0 в файле и ~8 тыс. в кадре. Это вся геометрия
   уровня (все варианты обвеса разом), поэтому число больше живого счётчика. */
function lodTris(id: string): number | undefined {
  const level = manifestData.value?.lods?.[id]
  if (!level) return lods.value.find(item => item.id === id)?.tris
  let tris = level.tris
  for (const node of Object.values(level.nodes)) {
    if (node.role === WHEEL_ROLE) tris -= node.tris
  }
  return tris
}

function lodQuality(id: string): string {
  const key = `project.configurator.hud.lod${id}`
  const label = t(key)
  return label === key ? `LOD ${id}` : label
}

/* Строка контекста сверху: где в меню находится игрок — «Гараж / Кузов /
   Передний бампер · Рейсинг». Тот же гараж, меняется только состояние HUD. */
const trail = computed(() => {
  const items = [t('project.configurator.hud.garage')]
  const category = activeCategory.value
  if (!category) return items
  items.push(t(`project.configurator.hud.${category}`))
  if (category === 'vehicles') items.push(vehicleName)
  if (category === 'body' && focusRole.value && selection.value[focusRole.value]) {
    items.push(`${roleLabel(focusRole.value)} · ${optionLabel(selection.value[focusRole.value]!)}`)
  }
  if (category === 'paint') items.push(colorName(activeColor.value.id))
  if (category === 'decals') items.push(patternName(activePattern.value.id))
  if (category === 'material') items.push(coverageName(activeCoverage.value.id))
  if (category === 'tech') items.push(`LOD ${lod.value}`)
  return items
})

/* ───── Монтирование сцены ───── */

function attachViewer() {
  if (!viewer || !container.value) return

  const canvas = viewer.renderer.domElement
  container.value.appendChild(canvas)
  container.value.addEventListener('wheel', onWheelCapture, { capture: true })
  canvas.addEventListener('pointerdown', onDragStart)
  canvas.addEventListener('pointerup', onDragEnd)
  canvas.addEventListener('pointercancel', onDragEnd)

  resizeRenderer()

  resizeObserver = new ResizeObserver(resizeRenderer)
  resizeObserver.observe(container.value)

  canvas.style.opacity = '1'
  const poster = container.value.querySelector<HTMLElement>('.garage__poster')
  if (poster) poster.style.opacity = '0'

  status.value = 'ready'
  applySelection()
  syncWireframe()
  observeVisibility()
}

function detachViewer() {
  stopLoop()
  resizeObserver?.disconnect()
  resizeObserver = undefined
  intersectionObserver?.disconnect()
  intersectionObserver = undefined
  container.value?.removeEventListener('wheel', onWheelCapture, { capture: true })
  if (viewer) {
    const canvas = viewer.renderer.domElement
    canvas.removeEventListener('pointerdown', onDragStart)
    canvas.removeEventListener('pointerup', onDragEnd)
    canvas.removeEventListener('pointercancel', onDragEnd)
    canvas.style.opacity = ''
    /* Сцена остаётся в кэше: сдвиг кадра и сетку снимаем, чтобы следующий
       монтаж начинался с чистой композиции. */
    viewer.camera.clearViewOffset()
    const poster = container.value?.querySelector<HTMLElement>('.garage__poster')
    if (poster) poster.style.opacity = ''
    if (canvas.parentElement === container.value) canvas.remove()
  }
}

async function fetchManifest(): Promise<CarManifest | null> {
  if (!manifestPromise) {
    manifestPromise = $fetch<CarManifest>(props.manifest)
      .catch((error) => {
        console.error('[3d] car configurator manifest failed:', error)
        return null
      })
  }
  return manifestPromise
}

async function mountViewer() {
  if (!container.value || disposed) return

  if (viewer) {
    /* Закэшированная сцена: группы, роли и колёса пересчитываем заново. */
    ensureLod(viewer)
    hoistWheels(viewer)
    syncWheels(viewer)
    await paintScene()
    attachViewer()
    return
  }

  try {
    const THREE = await import('three')
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')

    if (disposed || !container.value) return

    const manifest = await fetchManifest()
    if (disposed || !container.value) return

    const width = container.value.clientWidth || props.model.width
    const height = container.value.clientHeight || props.model.height

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const dprCap = window.innerWidth < 1024 ? 1.5 : 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1

    const scene = new THREE.Scene()

    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    scene.environmentIntensity = props.model.environmentIntensity ?? 0.5

    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x333333, props.model.hemisphereLight ?? 0.5)
    hemisphere.rotation.x = 0.08
    hemisphere.rotation.z = -0.1
    scene.add(hemisphere)

    const key = new THREE.DirectionalLight(0xffffff, props.model.keyLight ?? 0.8)
    key.position.set(5, 5.5, 3.5)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, props.model.fillLight ?? 0.4)
    fill.position.set(-4.5, 2.8, -3.5)
    scene.add(fill)

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100)
    camera.position.set(0, 1, 3)

    const controls = new OrbitControls(camera, renderer.domElement)
    applyTouchScrollPolicy(renderer.domElement)
    if (isCoarsePointer()) controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = false

    const draco = new DRACOLoader()
    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)

    const levels = buildLods(manifest)
    lods.value = levels
    const firstLod = levels[0]
    const startLod = levels.some(item => item.id === lod.value) ? lod.value : (firstLod?.id ?? '0')

    const carSrc = lodSrc(levels.find(item => item.id === startLod) ?? firstLod)
    const [gltf, garageGltf] = await Promise.all([
      loader.loadAsync(carSrc),
      props.garage ? loader.loadAsync(props.garage.src) : Promise.resolve(null),
    ])
    draco.dispose()

    if (disposed || !container.value) {
      controls.dispose()
      renderer.dispose()
      return
    }

    const model = gltf.scene
    model.rotation.y = ((props.model.rotation ?? 0) * Math.PI) / 180

    /* Гараж встаёт в ту же сцену до машины, и машина садится на его пол. */
    let garage: THREE.Object3D | null = null
    let garageBox: THREE.Box3 | null = null
    let seatOffsetY = 0
    if (garageGltf) {
      garage = garageGltf.scene
      garage.scale.setScalar(props.garage?.scale ?? 1)
      garage.rotation.y = ((props.garage?.rotation ?? 0) * Math.PI) / 180
      garage.updateMatrixWorld(true)
      garageBox = new THREE.Box3().setFromObject(garage)
      const carBox = new THREE.Box3().setFromObject(model)
      /* Пол ищем пробами по габариту машины: низ габарита гаража — плинтус. */
      const floorY = garageFloorLevel(THREE, garage, {
        footprint: carBox,
        from: carBox.max.y + 0.5,
      })
      const seatFloor = floorY ?? garageBox.min.y
      seatOffsetY = seatFloor - carBox.min.y
      model.position.y += seatOffsetY
      scene.add(garage)
      /* Тёплый свет мастерской, дымка и контактная тень под кузовом. */
      dressGarage(THREE, {
        scene,
        garage,
        hemisphere,
        key,
        fill,
        carBox: carBox.clone().translate(new THREE.Vector3(0, seatOffsetY, 0)),
        floorY: seatFloor,
      })
    }

    scene.add(model)

    const lampSplit = lampSplitFromBumpers(THREE, model)
    const carMaterials = createCarMaterials(THREE, model, {
      textureBase: carTextureBase(props.model.src),
      anisotropy: renderer.capabilities.getMaxAnisotropy(),
      selection: { ...paint.value },
      lampSplit,
      wheelNodes: nodeNamesByRole(buildNodeMeta(manifest, startLod), WHEEL_ROLE),
    })
    await setCarSelection(carMaterials, { ...paint.value })

    /* У оптики этой машины свет ровный — пульс не нужен, массив пуст. */
    const emissiveMaterials: THREE.MeshStandardMaterial[] = []

    const nodeByName = new Map<string, THREE.Object3D>()
    model.traverse((object) => {
      if (object.name) nodeByName.set(object.name, object)
    })

    const nodeMeta = buildNodeMeta(manifest, startLod)
    const activeGroups = buildVariantGroups(manifest, startLod)
    viewerGroups = activeGroups
    kitsActive.value = activeGroups.length > 0
    const activeSelection = Object.keys(selection.value).length > 0
      ? { ...selection.value }
      : defaultSelection(activeGroups.length > 0 ? activeGroups : groups.value)

    if (import.meta.dev) {
      for (const name of nodeMeta.keys()) {
        if (!nodeByName.has(name)) console.warn('[3d] configurator: нода манифеста не найдена в модели —', name)
      }
    }

    applyVariantSelection(nodeByName, nodeMeta, activeGroups, activeSelection)

    selection.value = activeSelection

    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const direction = new THREE.Vector3(0.6, 0.35, 1).normalize()

    camera.position.copy(center).addScaledVector(direction, 1)
    controls.target.copy(center)
    controls.update()

    if (garageBox) {
      const tiltFrom = props.garage?.tiltFrom ?? GARAGE_TILT_FROM
      const tiltTo = props.garage?.tiltTo ?? GARAGE_TILT_TO
      controls.minPolarAngle = polarFromElevation(Math.max(tiltFrom, tiltTo))
      controls.maxPolarAngle = polarFromElevation(Math.min(tiltFrom, tiltTo))
    }

    const orbitFrom = props.garage?.orbitFrom
    const orbitTo = props.garage?.orbitTo
    if (orbitFrom !== undefined && orbitTo !== undefined) {
      controls.minAzimuthAngle = (Math.min(orbitFrom, orbitTo) * Math.PI) / 180
      controls.maxAzimuthAngle = (Math.max(orbitFrom, orbitTo) * Math.PI) / 180
    }

    /* На тач-устройствах наклон запрещён: вертикаль принадлежит странице. */
    if (isCoarsePointer()) {
      const polar = controls.getPolarAngle()
      controls.minPolarAngle = polar
      controls.maxPolarAngle = polar
    }

    viewer = {
      renderer,
      scene,
      camera,
      controls,
      emissiveMaterials,
      center,
      size,
      fitDistance: 0,
      model,
      nodeByName,
      nodeMeta,
      manifest,
      groups: activeGroups,
      selection: activeSelection,
      materials: carMaterials,
      paint: { ...paint.value },
      lampSplit,
      seatOffsetY,
      lod: startLod,
      three: THREE,
      loader,
      garage,
      garageBox,
      wheels: new THREE.Group(),
      lodModels: new Map([[startLod, { root: model, materials: carMaterials, nodeByName }]]),
    }
    lod.value = startLod
    hoistWheels(viewer)
    syncWheels(viewer)
    carConfiguratorCache.set(CACHE_KEY, viewer)
    if (import.meta.dev) (window as unknown as Record<string, unknown>).__cfgViewer = viewer
    attachViewer()
  }
  catch (error) {
    if (!disposed) status.value = 'error'
    console.error('[3d] car configurator failed:', error)
  }
}

/* ───── Музыка ───── */

/* Очередь из контента; одиночный `src` — очередь из одного трека. Подпись
   трека без названия — имя файла: плеер не показывает пустую строку. */
const audioTracks = computed<GarageAudioTrack[]>(() => {
  if (props.audio?.tracks?.length) {
    return props.audio.tracks.map((track, index) => ({ id: `track-${index}`, ...track }))
  }
  if (!props.audio?.src) return []
  const file = props.audio.src.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  return [{ id: 'track-0', src: props.audio.src, title: file.replace(/[-_]+/g, ' ') }]
})
const hasSound = computed(() => audioTracks.value.length > 0)
const soundState = ref<GarageAudioState>('muted')
const trackId = ref<string | null>(null)
const trackTime = ref(0)
const trackDuration = ref(0)
let garageAudio: GarageAudio | undefined

const currentTrack = computed(() => audioTracks.value.find(track => track.id === trackId.value) ?? audioTracks.value[0])
const trackProgress = computed(() => (trackDuration.value > 0 ? Math.min(1, trackTime.value / trackDuration.value) : 0))

function syncAudioState() {
  if (!garageAudio) return
  soundState.value = garageAudio.state
  trackId.value = garageAudio.trackId
  trackTime.value = garageAudio.currentTime
  trackDuration.value = garageAudio.duration
}

function ensureAudio(): GarageAudio | undefined {
  if (!garageAudio && hasSound.value) {
    garageAudio = createGarageAudio(
      { tracks: audioTracks.value, volume: props.audio?.volume, fadeIn: props.audio?.fadeIn },
      { onChange: syncAudioState },
    )
    syncAudioState()
  }
  return garageAudio
}

function toggleSound() {
  ensureAudio()?.toggle()
  syncAudioState()
}

function nextTrack() {
  ensureAudio()?.next()
  syncAudioState()
}

function previousTrack() {
  ensureAudio()?.previous()
  syncAudioState()
}

function seekTrack(event: PointerEvent) {
  const bar = event.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  if (rect.width <= 0) return
  garageAudio?.seek((event.clientX - rect.left) / rect.width)
  syncAudioState()
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/* Трек подхватывается самой сценой, когда она собрана. `immediate`: с
   закэшированной сценой статус уже `ready`. */
watch(status, (value) => {
  if (value === 'ready') {
    ensureAudio()?.start()
    syncAudioState()
  }
}, { immediate: true })

/* ───── Жизненный цикл ───── */

watch(activeCategory, async (category, previous) => {
  if (category !== 'body') focusRole.value = previous === 'body' ? null : focusRole.value
  await nextTick()
  syncMenuIndicator()
  updateViewShiftTarget()
})

watch(showWireframe, (on) => {
  syncWireframe()
  if (on) refreshStats()
})

onMounted(async () => {
  fullFrameRate = !isCoarsePointer()
  narrow.value = (container.value?.clientWidth ?? window.innerWidth) < HUD_NARROW
  syncMenuIndicator()

  /* Окраска с прошлого визита — до сборки сцены, чтобы машина сразу
     появилась в ней. Чужие или устаревшие id заменяются дефолтом. */
  if (!cachedViewer) {
    const stored = loadCarSelection()
    if (stored) {
      paint.value = {
        color: resolveColor(stored.color).id,
        pattern: resolvePattern(stored.pattern).id,
        scale: patternScale(stored.scale),
        coverage: resolveCoverage(stored.coverage).id,
      }
    }
  }

  /* HUD строится по манифесту (лёгкий JSON) и не ждёт three.js. */
  const manifest = await fetchManifest()
  if (disposed) return

  manifestData.value = manifest
  lods.value = buildLods(manifest)

  if (!cachedViewer) {
    const built = buildVariantGroups(manifest, lods.value[0]?.id)
    groups.value = built
    selection.value = defaultSelection(built)
  }

  if ('requestIdleCallback' in window) {
    idleId = window.requestIdleCallback(mountViewer, { timeout: IDLE_TIMEOUT })
  }
  else {
    idleId = setTimeout(mountViewer, IDLE_TIMEOUT)
  }
})

onBeforeUnmount(() => {
  if (idleId !== null) {
    if ('requestIdleCallback' in window) window.cancelIdleCallback(idleId)
    else clearTimeout(idleId)
    idleId = null
  }
  garageAudio?.stop()
  garageAudio = undefined
  disposed = true
  if (viewer && activeCategory.value === 'tech') {
    activeCategory.value = null
    syncWireframe()
  }
  detachViewer()
  viewer = undefined
})
</script>

<template>
  <div
    ref="hudRoot"
    class="garage"
    :class="{
      'garage--ready': status === 'ready',
      'garage--open': !!activeCategory,
      'garage--narrow': narrow,
    }"
    @keydown="onHudKeydown"
  >
    <div
      ref="container"
      class="garage__stage"
      role="img"
      :aria-label="model.alt"
      :aria-busy="status === 'loading'"
    >
      <img
        v-if="poster && !cachedViewer"
        :src="poster"
        :alt="model.alt"
        class="garage__poster"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : 'auto'"
        decoding="async"
      >
    </div>

    <!-- Воздух зала поверх рендера: виньетка и тёплая дымка у пола. Слой
         прозрачен для указателя — сцена под ним крутится как обычно. -->
    <div
      class="garage__atmosphere"
      aria-hidden="true"
    />

    <div class="garage__hud">
      <!-- Слот гаража: компактно, машина важнее заголовка. -->
      <div class="garage__id">
        <span class="garage__eyebrow">{{ t('project.configurator.hud.garage') }}</span>
        <span class="garage__slot">01</span>
        <span class="garage__car">{{ vehicleName }}</span>
      </div>

      <!-- Строка контекста: где игрок в меню. Для скринридера — живой регион. -->
      <p
        class="garage__trail"
        aria-live="polite"
      >
        <template
          v-for="(item, index) in trail"
          :key="`${index}-${item}`"
        >
          <span
            v-if="index > 0"
            class="garage__trail-sep"
            aria-hidden="true"
          >/</span>
          <span
            class="garage__trail-item"
            :class="{ 'garage__trail-item--current': index === trail.length - 1 && index > 0 }"
          >{{ item }}</span>
        </template>
      </p>

      <div
        v-if="status === 'loading'"
        class="garage__loading"
        role="status"
      >
        <span class="garage__loading-label">{{ t('project.configurator.hud.loading') }}</span>
        <span
          class="garage__loading-bar"
          aria-hidden="true"
        />
      </div>
      <p
        v-else-if="status === 'error'"
        class="garage__loading"
      >
        {{ model.alt }}
      </p>

      <!-- Контекстная панель: одна на все разделы, меняется только содержимое. -->
      <Transition name="garage-panel">
        <section
          v-if="activeCategory"
          id="garage-panel"
          ref="panelEl"
          class="garage__panel"
          :aria-labelledby="`garage-panel-title-${activeCategory}`"
        >
          <header class="garage__panel-head">
            <span class="garage__panel-index">{{ categoryIndex(activeCategory) }}</span>
            <h3
              :id="`garage-panel-title-${activeCategory}`"
              class="garage__panel-title"
            >
              {{ t(`project.configurator.hud.${activeCategory}`) }}
            </h3>
            <button
              v-if="activeCategory !== 'vehicles' && activeCategory !== 'tech'"
              type="button"
              class="garage__text-button"
              :disabled="status !== 'ready'"
              @click="resetSelection"
            >
              {{ t('project.configurator.reset') }}
            </button>
            <button
              type="button"
              class="garage__close"
              :aria-label="t('project.configurator.hud.close')"
              :title="t('project.configurator.hud.close')"
              @click="closeCategory"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M3.5 3.5l9 9M12.5 3.5l-9 9"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="square"
                />
              </svg>
            </button>
          </header>

          <Transition
            name="garage-swap"
            mode="out-in"
          >
            <div
              :key="activeCategory"
              class="garage__panel-body"
            >
              <!-- VEHICLES: машины из данных кейса; сейчас она одна. -->
              <ul
                v-if="activeCategory === 'vehicles'"
                class="garage__vehicles"
              >
                <li
                  v-for="vehicle in vehicles"
                  :key="vehicle.id"
                >
                  <button
                    type="button"
                    class="garage__vehicle garage__vehicle--active"
                    aria-pressed="true"
                  >
                    <span
                      class="garage__vehicle-thumb"
                      :style="poster ? { backgroundImage: `url(${poster})` } : undefined"
                      aria-hidden="true"
                    />
                    <span class="garage__vehicle-info">
                      <span class="garage__vehicle-index">{{ vehicle.index }}</span>
                      <span class="garage__vehicle-name">{{ vehicle.name }}</span>
                      <span class="garage__vehicle-meta">
                        LOD {{ lods.map(item => item.id).join(' · ') || '0' }}
                      </span>
                    </span>
                    <span class="garage__tag">{{ t('project.configurator.hud.inGarage') }}</span>
                  </button>
                </li>
              </ul>

              <!-- BODY: обвес по ролям манифеста. Выбор детали подводит к ней камеру. -->
              <div
                v-else-if="activeCategory === 'body'"
                class="garage__sections"
                :class="{ 'garage__sections--muted': !kitsActive }"
              >
                <p
                  v-if="!kitsActive"
                  class="garage__note"
                >
                  {{ t('project.configurator.hud.kitsLocked') }}
                </p>
                <div
                  v-for="group in groups"
                  :key="group.id"
                  class="garage__section"
                >
                  <button
                    type="button"
                    class="garage__section-title"
                    :disabled="status !== 'ready' || !kitsActive"
                    @click="focusOnRole(group.id)"
                  >
                    {{ roleLabel(group.id) }}
                  </button>
                  <div
                    class="garage__options"
                    role="group"
                    :aria-label="roleLabel(group.id)"
                  >
                    <button
                      v-for="option in group.options"
                      :key="option"
                      type="button"
                      class="garage__option"
                      :class="{ 'garage__option--active': kitsActive && selection[group.id] === option }"
                      :aria-pressed="kitsActive && selection[group.id] === option"
                      :disabled="status !== 'ready' || !kitsActive"
                      @click="selectVariant(group.id, option)"
                    >
                      <span class="garage__option-name">{{ optionLabel(option) }}</span>
                      <span class="garage__option-meta">
                        {{ formatNumber(variantTris(group.id, option)) }}
                        <span class="garage__unit">{{ t('project.configurator.hud.tris') }}</span>
                      </span>
                      <span
                        class="garage__option-weight"
                        aria-hidden="true"
                      >
                        <span :style="{ transform: `scaleX(${variantWeight(group.id, option, group.options)})` }" />
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- PAINT: свотчи палитры. -->
              <div
                v-else-if="activeCategory === 'paint'"
                class="garage__sections"
              >
                <div
                  class="garage__swatches"
                  role="group"
                  :aria-label="t('project.configurator.paint.colorTitle')"
                >
                  <button
                    v-for="color in CAR_PAINT_COLORS"
                    :key="color.id"
                    type="button"
                    class="garage__swatch"
                    :class="{
                      'garage__swatch--active': paint.color === color.id,
                      'garage__swatch--none': color.id === 'none',
                    }"
                    :style="{ '--swatch': color.hex }"
                    :aria-pressed="paint.color === color.id"
                    :aria-label="colorName(color.id)"
                    :title="colorName(color.id)"
                    :disabled="status !== 'ready'"
                    @click="selectPaint('color', color.id)"
                  />
                </div>
                <div class="garage__readout">
                  <span class="garage__readout-name">{{ colorName(activeColor.id) }}</span>
                  <span class="garage__readout-code">{{ activeColor.id === 'none' ? '—' : activeColor.hex.toUpperCase() }}</span>
                </div>
              </div>

              <!-- DECALS: печати и масштаб. -->
              <div
                v-else-if="activeCategory === 'decals'"
                class="garage__sections"
              >
                <div
                  class="garage__decals"
                  role="group"
                  :aria-label="t('project.configurator.paint.patternTitle')"
                >
                  <button
                    v-for="(pattern, index) in CAR_PATTERNS"
                    :key="pattern.id"
                    type="button"
                    class="garage__decal"
                    :class="{ 'garage__decal--active': paint.pattern === pattern.id }"
                    :aria-pressed="paint.pattern === pattern.id"
                    :aria-label="patternName(pattern.id)"
                    :title="patternName(pattern.id)"
                    :disabled="status !== 'ready'"
                    @click="selectPaint('pattern', pattern.id)"
                  >
                    <span
                      class="garage__decal-thumb"
                      :class="{ 'garage__decal-thumb--none': !pattern.tile }"
                      :style="pattern.tile ? { backgroundImage: `url(${textureBase}/${pattern.tile}-thumb.webp)` } : undefined"
                      aria-hidden="true"
                    />
                    <span class="garage__decal-index">{{ pattern.tile ? String(index).padStart(2, '0') : '—' }}</span>
                  </button>
                </div>
                <div class="garage__readout">
                  <span class="garage__readout-name">{{ patternName(activePattern.id) }}</span>
                </div>

                <div
                  class="garage__tuner"
                  :class="{ 'garage__tuner--off': !hasPatternTile }"
                >
                  <div class="garage__tuner-head">
                    <span class="garage__label">{{ t('project.configurator.paint.scaleTitle') }}</span>
                    <span class="garage__tuner-value">{{ decimalFormat.format(scaleValue) }}</span>
                  </div>
                  <div
                    class="garage__range"
                    :style="{ '--progress': scaleProgress }"
                  >
                    <span class="garage__range-end">{{ decimalFormat.format(PATTERN_SCALE_MIN) }}</span>
                    <span class="garage__range-track">
                      <input
                        type="range"
                        :min="PATTERN_SCALE_MIN"
                        :max="PATTERN_SCALE_MAX"
                        step="0.25"
                        :value="scaleValue"
                        :aria-label="t('project.configurator.paint.scaleTitle')"
                        :disabled="status !== 'ready' || !hasPatternTile"
                        @input="selectScale(Number(($event.target as HTMLInputElement).value))"
                      >
                    </span>
                    <span class="garage__range-end">{{ decimalFormat.format(PATTERN_SCALE_MAX) }}</span>
                  </div>
                </div>
              </div>

              <!-- MATERIAL: характер поверхности с реальными параметрами шейдера. -->
              <div
                v-else-if="activeCategory === 'material'"
                class="garage__list"
                role="group"
                :aria-label="t('project.configurator.paint.coverageTitle')"
              >
                <button
                  v-for="coverage in CAR_COVERAGES"
                  :key="coverage.id"
                  type="button"
                  class="garage__row"
                  :class="{ 'garage__row--active': paint.coverage === coverage.id }"
                  :aria-pressed="paint.coverage === coverage.id"
                  :disabled="status !== 'ready'"
                  @click="selectPaint('coverage', coverage.id)"
                >
                  <span
                    class="garage__material"
                    :class="`garage__material--${coverage.id}`"
                    :style="coverage.tile ? { backgroundImage: `url(${textureBase}/${coverage.tile}-color.webp)` } : undefined"
                    aria-hidden="true"
                  />
                  <span class="garage__row-name">{{ coverageName(coverage.id) }}</span>
                  <span class="garage__row-meta">
                    R {{ coverage.roughness.toFixed(2) }} · M {{ coverage.metalness.toFixed(2) }} · CC {{ coverage.clearcoat.toFixed(1) }}
                  </span>
                </button>
              </div>

              <!-- TECH: качество модели и монитор производительности. -->
              <div
                v-else-if="activeCategory === 'tech'"
                class="garage__sections"
              >
                <div class="garage__section">
                  <span class="garage__section-title garage__section-title--static">{{ t('project.configurator.hud.modelQuality') }}</span>
                  <div
                    class="garage__list"
                    role="group"
                    :aria-label="t('project.configurator.hud.modelQuality')"
                  >
                    <button
                      v-for="item in lods"
                      :key="item.id"
                      type="button"
                      class="garage__row garage__row--lod"
                      :class="{ 'garage__row--active': lod === item.id }"
                      :aria-pressed="lod === item.id"
                      :disabled="status !== 'ready'"
                      @click="selectLod(item.id)"
                    >
                      <span class="garage__lod">LOD {{ item.id }}</span>
                      <span class="garage__row-name">{{ lodQuality(item.id) }}</span>
                      <span class="garage__row-meta">{{ formatNumber(lodTris(item.id)) }} {{ t('project.configurator.hud.tris') }}</span>
                    </button>
                  </div>
                  <label class="garage__switch">
                    <input
                      v-model="wireframe"
                      type="checkbox"
                    >
                    <span
                      class="garage__switch-track"
                      aria-hidden="true"
                    />
                    <span class="garage__label">{{ t('project.configurator.hud.wireframe') }}</span>
                  </label>
                </div>

                <div class="garage__section">
                  <span class="garage__section-title garage__section-title--static">{{ t('project.configurator.hud.performance') }}</span>
                  <dl class="garage__metrics">
                    <div class="garage__metric">
                      <dt>{{ t('project.configurator.triangles') }}</dt>
                      <dd>{{ formatNumber(stats?.triangles) }}</dd>
                    </div>
                    <div class="garage__metric">
                      <dt>{{ t('project.configurator.drawCalls') }}</dt>
                      <dd>{{ formatNumber(stats?.drawCalls) }}</dd>
                    </div>
                    <div class="garage__metric">
                      <dt>{{ t('project.configurator.hud.vertices') }}</dt>
                      <dd>{{ formatNumber(tech?.vertices) }}</dd>
                    </div>
                    <div class="garage__metric garage__metric--scene">
                      <dt>{{ t('project.configurator.hud.textures') }}</dt>
                      <dd>{{ formatNumber(tech?.textures) }}</dd>
                    </div>
                    <div class="garage__metric garage__metric--scene">
                      <dt>{{ t('project.configurator.hud.vram') }}</dt>
                      <dd>
                        {{ tech ? `≈ ${formatNumber(Math.round(tech.vramMb))}` : '—' }}
                        <span class="garage__unit">MB</span>
                      </dd>
                    </div>
                    <div class="garage__metric garage__metric--scene">
                      <dt>{{ t('project.configurator.hud.fps') }}</dt>
                      <dd>{{ fps || '—' }}</dd>
                    </div>
                  </dl>
                  <p class="garage__note garage__note--legend">
                    <span class="garage__legend garage__legend--car" />{{ t('project.configurator.hud.scope') }}
                    <span class="garage__legend garage__legend--scene" />{{ t('project.configurator.hud.sceneScope') }}
                  </p>
                </div>
              </div>
            </div>
          </Transition>
        </section>
      </Transition>

      <!-- Музыка: маленькое радио мастерской. -->
      <div
        v-if="hasSound"
        class="garage__radio"
        :class="{ 'garage__radio--playing': soundState === 'playing' }"
      >
        <div class="garage__radio-head">
          <span class="garage__label">{{ t('project.configurator.hud.nowPlaying') }}</span>
          <span
            class="garage__eq"
            aria-hidden="true"
          ><i /><i /><i /><i /></span>
        </div>
        <p class="garage__radio-track">
          <span
            v-if="currentTrack?.artist"
            class="garage__radio-artist"
          >{{ currentTrack.artist }}</span>
          <span class="garage__radio-title">{{ currentTrack?.title }}</span>
        </p>
        <div class="garage__radio-controls">
          <button
            type="button"
            class="garage__icon-button"
            :aria-label="t('project.configurator.hud.prev')"
            :title="t('project.configurator.hud.prev')"
            @click="previousTrack"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            ><path
              d="M4 3v10M13 3.5v9L6 8z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            /></svg>
          </button>
          <button
            type="button"
            class="garage__icon-button garage__icon-button--main"
            :aria-pressed="soundState === 'playing'"
            :aria-label="soundState === 'playing' ? t('project.configurator.hud.pause') : t('project.configurator.hud.play')"
            :title="soundState === 'playing' ? t('project.configurator.hud.pause') : t('project.configurator.hud.play')"
            @click="toggleSound"
          >
            <svg
              v-if="soundState === 'playing'"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            ><path
              d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z"
              fill="currentColor"
            /></svg>
            <svg
              v-else
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            ><path
              d="M5 3v10l8.5-5z"
              fill="currentColor"
            /></svg>
          </button>
          <button
            type="button"
            class="garage__icon-button"
            :aria-label="t('project.configurator.hud.next')"
            :title="t('project.configurator.hud.next')"
            @click="nextTrack"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            ><path
              d="M12 3v10M3 3.5v9L10 8z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            /></svg>
          </button>
          <div
            class="garage__progress"
            role="slider"
            tabindex="-1"
            :aria-label="t('project.configurator.hud.progress')"
            :aria-valuemin="0"
            :aria-valuemax="Math.round(trackDuration)"
            :aria-valuenow="Math.round(trackTime)"
            :aria-valuetext="`${formatTime(trackTime)} / ${formatTime(trackDuration)}`"
            @pointerdown="seekTrack"
          >
            <span :style="{ transform: `scaleX(${trackProgress})` }" />
          </div>
          <span class="garage__time">{{ formatTime(trackTime) }}</span>
        </div>
      </div>

      <!-- Меню кастомизации: разделы — состояния HUD, а не страницы. -->
      <nav
        class="garage__menu"
        :aria-label="t('project.configurator.hud.menu')"
      >
        <span
          class="garage__menu-indicator"
          :class="{ 'garage__menu-indicator--visible': menuIndicator.visible }"
          :style="{ transform: `translateX(${menuIndicator.x}px)`, width: `${menuIndicator.width}px` }"
          aria-hidden="true"
        />
        <button
          v-for="category in HUD_CATEGORIES"
          :key="category"
          ref="menuButtons"
          type="button"
          class="garage__menu-item"
          :class="{ 'garage__menu-item--active': activeCategory === category }"
          :aria-expanded="activeCategory === category"
          :aria-controls="activeCategory === category ? 'garage-panel' : undefined"
          @click="toggleCategory(category)"
        >
          <span class="garage__menu-index">{{ categoryIndex(category) }}</span>
          <span class="garage__menu-label">{{ t(`project.configurator.hud.${category}`) }}</span>
        </button>
      </nav>

      <!-- Технический монитор: всегда в кадре, только живые значения. -->
      <dl class="garage__monitor">
        <div class="garage__monitor-cell">
          <dt>{{ t('project.configurator.hud.tris') }}</dt>
          <dd>{{ formatNumber(stats?.triangles) }}</dd>
        </div>
        <div class="garage__monitor-cell">
          <dt>{{ t('project.configurator.hud.drawCalls') }}</dt>
          <dd>{{ formatNumber(stats?.drawCalls) }}</dd>
        </div>
        <div class="garage__monitor-cell garage__monitor-cell--fps">
          <dt>{{ t('project.configurator.hud.fps') }}</dt>
          <dd>{{ fps || '—' }}</dd>
        </div>
        <div class="garage__monitor-cell garage__monitor-cell--accent">
          <dt>LOD</dt>
          <dd>{{ lod }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<style scoped>
/*
 * Гараж — экран игры на всю ширину страницы. Палитра своя и не зависит от
 * темы сайта: зал тёмный в любой теме, и HUD поверх него — тоже.
 * Оранжевый — действие и выбор, голубой — только технические данные.
 */
.garage {
  --g-bg: #0b0908;
  --g-surface: rgb(16 12 10 / 0.72);
  --g-surface-strong: rgb(12 9 8 / 0.86);
  --g-line: rgb(255 236 214 / 0.13);
  --g-line-strong: rgb(255 236 214 / 0.26);
  --g-text: #f4ede5;
  --g-text-2: #bdb2a7;
  --g-text-3: #8f857b;
  --g-accent: #ff7a1a;
  --g-accent-2: #ffb36b;
  --g-accent-soft: rgb(255 122 26 / 0.14);
  --g-cyan: #66d4e8;
  --g-pad: clamp(16px, 1.9vw, 36px);
  --g-font: 'Roboto Condensed', 'Arial Narrow', var(--font-sans);

  position: relative;
  isolation: isolate;
  width: 100%;
  height: calc(100svh - 64px);
  min-height: 600px;
  max-height: 1320px;
  overflow: hidden;
  color: var(--g-text);
  background: radial-gradient(120% 90% at 55% 45%, #1c140e 0%, var(--g-bg) 70%);
  font-family: var(--g-font);
  font-variant-numeric: tabular-nums;
}

/* ───── Сцена ───── */

.garage__stage {
  position: absolute;
  inset: 0;
}

.garage__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* opacity управляется из JS: канвас добавляется через JS и не получает
     data-v-xxx, поэтому scoped-правила для него ненадёжны. */
  opacity: 1;
  filter: brightness(0.55) saturate(0.8);
  transition: opacity 600ms ease;
  pointer-events: none;
}

.garage__stage :deep(canvas) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: block;
  max-width: none;
  cursor: grab;
  opacity: 0;
  transition: opacity 600ms ease;
}

@media (pointer: coarse) {
  .garage__stage :deep(canvas) {
    touch-action: pan-y;
  }
}

.garage--ready .garage__stage :deep(canvas):active {
  cursor: grabbing;
}

/* Воздух зала: виньетка, тёплая дымка у пола и тень под HUD снизу, чтобы
   подписи читались на любом участке рендера. */
.garage__atmosphere {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgb(8 6 5 / 0.55) 0%, transparent 16%, transparent 72%, rgb(8 6 5 / 0.72) 100%),
    radial-gradient(70% 40% at 50% 100%, rgb(255 132 48 / 0.08), transparent 70%),
    radial-gradient(130% 110% at 50% 48%, transparent 55%, rgb(0 0 0 / 0.55) 100%);
}

/* ───── HUD ───── */

.garage__hud {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.garage__hud > * {
  pointer-events: auto;
}

.garage__label {
  color: var(--g-text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1.2;
  text-transform: uppercase;
}

.garage__id {
  position: absolute;
  top: var(--g-pad);
  left: var(--g-pad);
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  align-items: end;
  pointer-events: none;
}

.garage__eyebrow {
  grid-column: 1 / -1;
  margin-bottom: 4px;
  padding-left: 10px;
  border-left: 2px solid var(--g-accent);
  color: var(--g-text-2);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.garage__slot {
  color: var(--g-accent);
  font-size: clamp(34px, 3.1vw, 52px);
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.02em;
}

.garage__car {
  padding-bottom: 3px;
  font-size: clamp(16px, 1.25vw, 22px);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.garage__trail {
  position: absolute;
  top: calc(var(--g-pad) + 4px);
  left: 50%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 7px 16px;
  transform: translateX(-50%);
  border: 1px solid var(--g-line);
  background: rgb(10 8 7 / 0.46);
  backdrop-filter: blur(10px);
  color: var(--g-text-3);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
}

.garage__trail-sep {
  color: var(--g-line-strong);
}

.garage__trail-item--current {
  color: var(--g-accent-2);
}

.garage__loading {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 0;
  transform: translate(-50%, -50%);
  color: var(--g-text-2);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  pointer-events: none;
}

.garage__loading-bar {
  position: relative;
  width: 180px;
  height: 2px;
  overflow: hidden;
  background: var(--g-line);
}

.garage__loading-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 40%;
  background: var(--g-accent);
  animation: garage-load 1.2s ease-in-out infinite;
}

@keyframes garage-load {
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
}

/* Общая оболочка HUD-блоков: тонкая рамка, стеклянная подложка, уголок
   акцента — техническая геометрия вместо скруглённых карточек. */
.garage__panel,
.garage__radio,
.garage__menu,
.garage__monitor {
  border: 1px solid var(--g-line);
  background: linear-gradient(180deg, var(--g-surface-strong), var(--g-surface));
  backdrop-filter: blur(14px) saturate(120%);
  box-shadow: 0 18px 50px rgb(0 0 0 / 0.35);
}

.garage__panel::before,
.garage__radio::before,
.garage__monitor::before {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  width: 12px;
  height: 12px;
  border-top: 2px solid var(--g-accent);
  border-left: 2px solid var(--g-accent);
  pointer-events: none;
}

/* ───── Панель ───── */

.garage__panel {
  position: absolute;
  top: clamp(118px, 13vh, 150px);
  bottom: clamp(150px, 16vh, 176px);
  left: var(--g-pad);
  display: flex;
  flex-direction: column;
  width: clamp(290px, 21vw, 384px);
  min-height: 0;
}

.garage__panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 12px 12px 16px;
  border-bottom: 1px solid var(--g-line);
}

.garage__panel-index {
  color: var(--g-accent);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.garage__panel-title {
  flex: 1;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
}

.garage__text-button {
  padding: 6px 4px;
  color: var(--g-text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 150ms ease;
}

.garage__text-button:hover:not(:disabled) {
  color: var(--g-accent-2);
}

.garage__close,
.garage__icon-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--g-text-2);
  border: 1px solid transparent;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease;
}

.garage__close svg,
.garage__icon-button svg {
  width: 14px;
  height: 14px;
}

.garage__close:hover,
.garage__icon-button:hover {
  color: var(--g-text);
  border-color: var(--g-line-strong);
}

.garage__panel-body {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 18px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--g-line-strong) transparent;
}

.garage__sections {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.garage__sections--muted .garage__section {
  opacity: 0.45;
}

.garage__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.garage__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  color: var(--g-text-2);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-align: left;
  text-transform: uppercase;
  cursor: pointer;
}

.garage__section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--g-line);
}

.garage__section-title--static {
  cursor: default;
}

.garage__section-title:hover:not(:disabled, .garage__section-title--static) {
  color: var(--g-text);
}

.garage__note {
  margin: 0;
  padding: 8px 10px;
  border-left: 2px solid var(--g-cyan);
  color: var(--g-text-2);
  background: rgb(102 212 232 / 0.07);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.garage__unit {
  color: var(--g-text-3);
  font-size: 0.78em;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Выбор: тонкая рамка, оранжевый край и лёгкое свечение у выбранного. */
.garage__option,
.garage__row,
.garage__vehicle,
.garage__decal,
.garage__swatch {
  position: relative;
  border: 1px solid var(--g-line);
  background: rgb(255 255 255 / 0.02);
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, color 160ms ease;
}

.garage__option:hover:not(:disabled),
.garage__row:hover:not(:disabled),
.garage__decal:hover:not(:disabled) {
  border-color: var(--g-line-strong);
  background: rgb(255 255 255 / 0.05);
}

.garage__option--active,
.garage__row--active,
.garage__vehicle--active,
.garage__decal--active {
  border-color: var(--g-accent);
  background: var(--g-accent-soft);
  box-shadow: 0 0 0 1px rgb(255 122 26 / 0.25), 0 0 22px rgb(255 122 26 / 0.18);
}

.garage__option--active::after,
.garage__row--active::after,
.garage__decal--active::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  border-top: 8px solid var(--g-accent);
  border-left: 8px solid transparent;
}

.garage__option:disabled,
.garage__row:disabled,
.garage__decal:disabled,
.garage__swatch:disabled {
  cursor: default;
}

.garage__options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.garage__option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 62px;
  padding: 9px 9px 8px;
  color: var(--g-text-2);
  text-align: left;
}

.garage__option--active {
  color: var(--g-text);
}

.garage__option-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.garage__option-meta {
  color: var(--g-cyan);
  font-size: 12px;
}

.garage__option-weight {
  width: 100%;
  height: 2px;
  margin-top: auto;
  background: var(--g-line);
}

.garage__option-weight span {
  display: block;
  height: 100%;
  background: currentColor;
  transform-origin: left center;
  transition: transform 300ms ease;
}

.garage__option--active .garage__option-weight span {
  background: var(--g-accent);
}

/* Машины */

.garage__vehicles {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.garage__vehicle {
  display: grid;
  grid-template-columns: 96px 1fr;
  grid-template-rows: auto auto;
  gap: 8px 12px;
  width: 100%;
  padding: 8px;
  color: var(--g-text);
  text-align: left;
  cursor: default;
}

.garage__vehicle-thumb {
  grid-row: 1 / 3;
  aspect-ratio: 16 / 10;
  background: #120e0b center / cover no-repeat;
  filter: saturate(0.85);
}

.garage__vehicle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.garage__vehicle-index {
  color: var(--g-accent);
  font-size: 12px;
  font-weight: 700;
}

.garage__vehicle-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.garage__vehicle-meta {
  color: var(--g-cyan);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.garage__tag {
  justify-self: start;
  align-self: end;
  padding: 2px 7px;
  color: #140c06;
  background: var(--g-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

/* Окраска */

.garage__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
  gap: 8px;
}

.garage__swatch {
  aspect-ratio: 1;
  padding: 0;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 0.28) 0%, transparent 42%, rgb(0 0 0 / 0.35) 100%),
    var(--swatch);
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
}

.garage__swatch:hover:not(:disabled) {
  border-color: var(--g-line-strong);
}

.garage__swatch--active {
  border: 2px solid var(--g-accent);
  box-shadow: inset 0 0 0 2px rgb(11 9 8 / 0.9), 0 0 18px rgb(255 122 26 / 0.35);
}

.garage__swatch--none {
  background:
    linear-gradient(to bottom right, transparent calc(50% - 1px), rgb(20 16 12 / 0.6) calc(50% - 1px), rgb(20 16 12 / 0.6) calc(50% + 1px), transparent calc(50% + 1px)),
    #e9e4dc;
}

.garage__readout {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--g-line);
}

.garage__readout-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.garage__readout-code {
  color: var(--g-cyan);
  font-size: 13px;
  letter-spacing: 0.08em;
}

/* Винилы */

.garage__decals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
  gap: 6px;
}

.garage__decal {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  color: var(--g-text-3);
}

.garage__decal--active {
  color: var(--g-accent-2);
}

.garage__decal-thumb {
  display: block;
  aspect-ratio: 1;
  background: #1b1511 center / cover no-repeat;
}

.garage__decal-thumb--none {
  background:
    linear-gradient(to bottom right, transparent calc(50% - 1px), var(--g-line-strong) calc(50% - 1px), var(--g-line-strong) calc(50% + 1px), transparent calc(50% + 1px)),
    #16110d;
}

.garage__decal-index {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.garage__tuner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--g-line);
  background: rgb(0 0 0 / 0.2);
  transition: opacity 200ms ease;
}

.garage__tuner--off {
  opacity: 0.4;
}

.garage__tuner-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.garage__tuner-value {
  color: var(--g-accent-2);
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}

.garage__range {
  display: flex;
  align-items: center;
  gap: 10px;
}

.garage__range-end {
  color: var(--g-text-3);
  font-size: 11px;
}

.garage__range-track {
  position: relative;
  flex: 1;
  height: 20px;
}

/* Дорожка — сплошная линия с засечками по шагам; заполнение и бегунок —
   оранжевые. Сам input прозрачный поверх: управление и доступность нативные. */
.garage__range-track::before,
.garage__range-track::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  height: 2px;
  transform: translateY(-50%);
  pointer-events: none;
}

.garage__range-track::before {
  right: 0;
  background:
    repeating-linear-gradient(90deg, var(--g-line-strong) 0 1px, transparent 1px calc(100% / 6)),
    var(--g-line);
  height: 6px;
  background-size: 100% 6px, 100% 2px;
  background-position: 0 0, 0 2px;
  background-repeat: no-repeat;
}

.garage__range-track::after {
  width: calc(var(--progress) * 100%);
  background: var(--g-accent);
}

.garage__range input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.garage__range input:disabled {
  cursor: default;
}

.garage__range input::-webkit-slider-runnable-track {
  height: 20px;
  background: transparent;
}

.garage__range input::-moz-range-track {
  height: 20px;
  background: transparent;
}

.garage__range input::-webkit-slider-thumb {
  width: 12px;
  height: 20px;
  border: 2px solid var(--g-accent);
  background: var(--g-bg);
  box-shadow: 0 0 12px rgb(255 122 26 / 0.45);
  appearance: none;
}

.garage__range input::-moz-range-thumb {
  width: 8px;
  height: 16px;
  border: 2px solid var(--g-accent);
  border-radius: 0;
  background: var(--g-bg);
  box-shadow: 0 0 12px rgb(255 122 26 / 0.45);
}

/* Материал и уровни */

.garage__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.garage__row {
  display: grid;
  grid-template-columns: 38px 1fr;
  grid-template-rows: auto auto;
  column-gap: 12px;
  align-items: center;
  width: 100%;
  padding: 8px 12px 8px 8px;
  color: var(--g-text-2);
  text-align: left;
}

.garage__row--active {
  color: var(--g-text);
}

.garage__row-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.garage__row-meta {
  grid-column: 2;
  color: var(--g-cyan);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.garage__material,
.garage__lod {
  grid-row: 1 / 3;
  width: 38px;
  height: 38px;
}

.garage__material {
  border: 1px solid var(--g-line-strong);
  border-radius: 50%;
  background-color: #6b6259;
  background-position: center;
  background-size: 180%;
}

.garage__material--gloss {
  background-image: radial-gradient(circle at 32% 28%, #fff 0 6%, #bdb4aa 18%, #4b433c 62%, #1d1814 100%);
}

.garage__material--matte {
  background-image: radial-gradient(circle at 38% 34%, #8d847b 0%, #4d4640 60%, #2b2622 100%);
}

.garage__material--ceramic {
  background-image: radial-gradient(circle at 30% 26%, #fff 0 9%, #e9e4de 22%, #8a827a 70%, #3b342f 100%);
}

.garage__material--carbon,
.garage__material--brushed {
  box-shadow: inset -6px -8px 14px rgb(0 0 0 / 0.55), inset 4px 5px 10px rgb(255 255 255 / 0.18);
}

.garage__lod {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--g-line-strong);
  color: var(--g-text-2);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: center;
  line-height: 1.05;
}

.garage__row--active .garage__lod {
  border-color: var(--g-accent);
  color: var(--g-accent-2);
}

.garage__switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  cursor: pointer;
}

.garage__switch input {
  position: absolute;
  opacity: 0;
}

.garage__switch-track {
  position: relative;
  width: 30px;
  height: 14px;
  border: 1px solid var(--g-line-strong);
  transition: border-color 160ms ease;
}

.garage__switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 8px;
  background: var(--g-text-3);
  transition: transform 160ms ease, background-color 160ms ease;
}

.garage__switch input:checked + .garage__switch-track {
  border-color: var(--g-cyan);
}

.garage__switch input:checked + .garage__switch-track::after {
  background: var(--g-cyan);
  transform: translateX(14px);
}

.garage__switch input:focus-visible + .garage__switch-track {
  outline: 2px solid var(--g-accent);
  outline-offset: 2px;
}

.garage__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  border: 1px solid var(--g-line);
  background: var(--g-line);
}

.garage__metric {
  padding: 9px 10px;
  background: rgb(12 9 8 / 0.92);
}

.garage__metric dt {
  color: var(--g-text-3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.garage__metric dd {
  margin: 2px 0 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

.garage__metric dt::before,
.garage__legend {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  vertical-align: 1px;
  background: var(--g-accent);
}

.garage__metric--scene dt::before,
.garage__legend--scene {
  background: var(--g-cyan);
}

.garage__metric dt::before {
  content: '';
}

.garage__note--legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 0;
  border-left: none;
  padding: 0;
  background: none;
  color: var(--g-text-3);
  font-size: 11px;
}

.garage__legend--scene {
  margin-left: 14px;
}

/* ───── Радио ───── */

.garage__radio {
  position: absolute;
  bottom: var(--g-pad);
  left: var(--g-pad);
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: clamp(250px, 17vw, 320px);
  padding: 12px 14px 12px;
}

.garage__radio-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.garage__eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 10px;
}

.garage__eq i {
  width: 2px;
  height: 3px;
  background: var(--g-text-3);
}

.garage__radio--playing .garage__eq i {
  background: var(--g-accent);
  animation: garage-eq 900ms ease-in-out infinite alternate;
}

.garage__radio--playing .garage__eq i:nth-child(2) { animation-delay: -300ms; }
.garage__radio--playing .garage__eq i:nth-child(3) { animation-delay: -600ms; }
.garage__radio--playing .garage__eq i:nth-child(4) { animation-delay: -150ms; }

@keyframes garage-eq {
  from { height: 2px; }
  to { height: 10px; }
}

.garage__radio-track {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin: 0;
}

.garage__radio-artist {
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.garage__radio-title {
  overflow: hidden;
  color: var(--g-text-2);
  font-size: 13px;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.garage__radio-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}

.garage__icon-button--main {
  border-color: var(--g-line-strong);
  color: var(--g-accent);
}

.garage__icon-button--main:hover {
  border-color: var(--g-accent);
  color: var(--g-accent-2);
}

.garage__progress {
  position: relative;
  flex: 1;
  height: 18px;
  margin-left: 8px;
  cursor: pointer;
}

.garage__progress::before,
.garage__progress span {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  transform-origin: left center;
  translate: 0 -50%;
}

.garage__progress::before {
  background: var(--g-line-strong);
}

.garage__progress span {
  display: block;
  background: var(--g-accent);
  transition: transform 250ms linear;
}

.garage__time {
  min-width: 34px;
  color: var(--g-text-3);
  font-size: 11px;
  text-align: right;
}

/* ───── Меню разделов ───── */

.garage__menu {
  position: absolute;
  bottom: var(--g-pad);
  left: 50%;
  display: flex;
  transform: translateX(-50%);
}

.garage__menu-indicator {
  position: absolute;
  top: -1px;
  left: 0;
  height: 2px;
  background: var(--g-accent);
  box-shadow: 0 0 14px rgb(255 122 26 / 0.7);
  opacity: 0;
  transition: transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1), width 280ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease;
  pointer-events: none;
}

.garage__menu-indicator--visible {
  opacity: 1;
}

.garage__menu-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: clamp(92px, 6.6vw, 128px);
  padding: 12px clamp(12px, 1.1vw, 20px) 13px;
  color: var(--g-text-2);
  cursor: pointer;
  transition: color 160ms ease, background-color 160ms ease;
}

.garage__menu-item + .garage__menu-item::before {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 0;
  width: 1px;
  background: var(--g-line);
}

.garage__menu-item:hover {
  color: var(--g-text);
  background: rgb(255 255 255 / 0.04);
}

.garage__menu-item--active {
  color: var(--g-text);
  background: linear-gradient(180deg, rgb(255 122 26 / 0.16), transparent);
}

.garage__menu-index {
  color: var(--g-text-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.garage__menu-item--active .garage__menu-index {
  color: var(--g-accent);
}

.garage__menu-label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

/* ───── Монитор ───── */

.garage__monitor {
  position: absolute;
  right: var(--g-pad);
  bottom: var(--g-pad);
  display: flex;
  margin: 0;
}

.garage__monitor-cell {
  padding: 10px 14px 11px;
}

.garage__monitor-cell + .garage__monitor-cell {
  border-left: 1px solid var(--g-line);
}

.garage__monitor-cell dt {
  color: var(--g-text-3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
}

.garage__monitor-cell dd {
  margin: 2px 0 0;
  color: var(--g-cyan);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.garage__monitor-cell--accent dd {
  color: var(--g-accent);
}

/* ───── Фокус и переходы ───── */

.garage button:focus-visible,
.garage__range input:focus-visible {
  outline: 2px solid var(--g-accent);
  outline-offset: 2px;
}

.garage-panel-enter-active,
.garage-panel-leave-active {
  transition: opacity 240ms ease, transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.garage-panel-enter-from,
.garage-panel-leave-to {
  opacity: 0;
  transform: translateX(-18px);
}

.garage-swap-enter-active,
.garage-swap-leave-active {
  transition: opacity 140ms ease, transform 160ms ease;
}

.garage-swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.garage-swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .garage-panel-enter-active,
  .garage-panel-leave-active,
  .garage-swap-enter-active,
  .garage-swap-leave-active,
  .garage__menu-indicator {
    transition: none;
  }

  .garage__radio--playing .garage__eq i,
  .garage__loading-bar::after {
    animation: none;
  }
}

/* ───── Узкие экраны ───── */

@media (max-width: 1280px) {
  .garage__menu-item {
    min-width: 0;
  }

  .garage__menu-label {
    font-size: 13px;
    letter-spacing: 0.12em;
  }

  .garage__monitor-cell--fps {
    display: none;
  }
}

@media (max-width: 1080px) {
  .garage__trail {
    display: none;
  }

  .garage__radio {
    width: 220px;
  }

  .garage__radio-title {
    display: none;
  }
}

/* Телефон и узкий планшет: меню — полоса по низу кадра, панель — шторка над
   ней, радио сворачивается в строку сверху, монитор уходит в раздел TECH. */
.garage--narrow {
  height: min(78svh, 680px);
  min-height: 460px;
}

.garage--narrow .garage__id {
  gap: 8px;
}

.garage--narrow .garage__slot {
  font-size: 30px;
}

.garage--narrow .garage__car {
  font-size: 14px;
}

.garage--narrow .garage__trail,
.garage--narrow .garage__monitor {
  display: none;
}

.garage--narrow .garage__radio {
  top: var(--g-pad);
  right: var(--g-pad);
  bottom: auto;
  left: auto;
  width: auto;
  padding: 6px 8px;
}

.garage--narrow .garage__radio-head,
.garage--narrow .garage__radio-track,
.garage--narrow .garage__progress,
.garage--narrow .garage__time {
  display: none;
}

.garage--narrow .garage__radio-controls {
  margin: 0;
}

.garage--narrow .garage__menu {
  right: 8px;
  bottom: 8px;
  left: 8px;
  overflow-x: auto;
  transform: none;
  scrollbar-width: none;
}

.garage--narrow .garage__menu-item {
  flex: 1 0 auto;
  align-items: center;
  padding: 9px 12px;
}

.garage--narrow .garage__menu-index {
  display: none;
}

.garage--narrow .garage__menu-label {
  font-size: 12px;
}

.garage--narrow .garage__panel {
  top: auto;
  right: 8px;
  bottom: 60px;
  left: 8px;
  width: auto;
  max-height: 52%;
}

.garage--narrow .garage-panel-enter-from,
.garage--narrow .garage-panel-leave-to {
  transform: translateY(16px);
}
</style>
