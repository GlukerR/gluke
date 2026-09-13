<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  CAR_PATTERN_SCALES,
  CAR_PATTERNS,
  carModelBase,
  carTextureBase,
  createCarMaterials,
  defaultCarSelection,
  lampSplitFromBumpers,
  PATTERN_SCALE_MAX,
  PATTERN_SCALE_MIN,
  patternScale,
  resolvePattern,
  setCarSelection,
  type CarSelection,
} from '~/utils/carMaterials'
import { createGarageAudio, type GarageAudio, type GarageAudioState } from '~/utils/garageAudio'
import { garageFloorLevel } from '~/utils/garageFloor'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'

/* Настройки модели приходят из frontmatter кейса (`model:`) — тот же набор,
   что у обычного вьювера, поэтому кейс с конфигуратором настраивается так же:
   разворот, свет, металличность, кадрирование. */
/* `model.autoRotate`/`autoRotateSpeed` здесь намеренно не читаются: камера
   конфигуратора ходит только за мышью. В гараже облёт — не витрина, а осмотр,
   и автоповорот сам уводил бы кадр в реквизит зала, стоящий в нескольких метрах
   от машины. Витринный автоповорот остаётся у общего вьювера в шапке кейса. */
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
  /* Разрешённая дуга облёта камеры вокруг машины, градусы. `0` — ось +Z сцены,
     отсчёт как у долготы в OrbitControls. Без границ (обычный случай) камера
     обходит машину полным кругом: зал замкнут, меши есть со всех сторон.
     Дуга нужна окружениям с проёмом в стене — тогда её ставят обеими
     границами: одна без второй — это не дуга, а половина круга на выбор. */
  orbitFrom?: number
  orbitTo?: number
  /* Пределы по высоте, градусы над горизонтом цели: `0` — камера на высоте
     машины, `90` — строго сверху. В гараже потолок ограничивает подъём:
     выше предела камера уходит под крышу и смотрит на машину сверху, а ниже
     нуля — под пол. Нужны оба (по умолчанию 3 и 50). */
  tiltFrom?: number
  tiltTo?: number
  /* Кадрирование и предел отъезда в гараже, отдельно от `model:`: большой зал
     снимается ближе — реквизит (верстак, антресоль, стеллажи) стоит уже
     в нескольких метрах от машины, и на общей дистанции камера упирается в него.
     `fit` — тот же множитель кадра, что у модели, `zoomMax` — предел отъезда
     в долях кадра. Без них берутся значения модели. */
  fit?: number
  zoomMax?: number
}

/* Музыка зала (`configurator.audio`): один трек на кейс. Вместе со страницей он
   не грузится — адрес отдаётся, когда сцена уже собрана (модель, уровни
   и текстуры на месте). */
interface ConfiguratorAudio {
  src: string
  /* Громкость, до которой доходит появление, и длина этого появления. */
  volume?: number
  fadeIn?: number
}

const props = withDefaults(defineProps<{
  model: ConfiguratorModel
  /* Манифест вариантов (`<slug>.json` рядом с GLB): какие ноды к какой роли
     и варианту относятся. Панель и подписи строятся по нему — вторая машина
     подключается копией манифеста, без правок кода. */
  manifest: string
  /* Необязательное окружение: без него конфигуратор работает как раньше,
     на прозрачном фоне, — включается самим кейсом. */
  garage?: ConfiguratorGarage
  /* Музыка зала: без этого поля в конфигураторе никакого звука нет вообще. */
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
/* Группы обвеса для панели — всегда полный набор, по самой подробной
   детализации: на других уровнях обвесов в модели нет, но панель должна
   остаться на месте и показать, что выбор там недоступен. */
const groups = ref<CarVariantGroup[]>([])
/* У активного уровня детализации обвесы есть? У LOD1/LOD2 их нет вовсе —
   тогда панель обвесов гаснет и кнопки выключаются. */
const kitsActive = ref(true)
const selection = ref<Record<string, string>>({})
const stats = ref<CarRenderStats | null>(null)
/* Уровни детализации из манифеста и активный из них. */
const lods = ref<CarLodEntry[]>([])
const lod = ref<string>('0')
/* Окраска: цвет кузова, узор и покрытие — три независимые оси, как у настоящей
   машины. Узор живёт отдельно от покрытия: он ложится поверх любого из них.
   Состояние переживает смену языка вместе с закэшированной моделью. */
const paint = ref<CarSelection>(defaultCarSelection())

/* Превью карт узора лежат рядом с моделью: подпись строкой тут ничего не даёт,
   печать показывают именно квадратиком карты. */
const textureBase = computed(() => carTextureBase(props.model.src))

/* Множитель масштаба показываем только у выбранного узора: у «без узора»
   масштабировать нечего. */
const activePattern = computed(() => resolvePattern(paint.value.pattern))
const hasPatternTile = computed(() => !!activePattern.value.tile)

/* Загруженный конфигуратор переиспользуем между инстансами: при смене языка
   страница перемонтируется, но модель не грузим заново — подхватываем
   ту же сцену вместе с выбранной конфигурацией. */
const CACHE_KEY = `${props.model.src}|${props.garage?.src ?? ''}|configurator`
const cachedViewer = carConfiguratorCache.get(CACHE_KEY)
const status = ref<'loading' | 'ready' | 'error'>(cachedViewer ? 'ready' : 'loading')
if (cachedViewer) {
  groups.value = cachedViewer.groups
  selection.value = { ...cachedViewer.selection }
  paint.value = { ...cachedViewer.paint }
  lod.value = cachedViewer.lod
  kitsActive.value = buildVariantGroups(cachedViewer.manifest, cachedViewer.lod).length > 0
}

/* Наклон камеры в гараже по умолчанию: камера не опускается ниже высоты машины
   и не поднимается выше ~50° над ней. */
const GARAGE_TILT_FROM = 3
const GARAGE_TILT_TO = 50

/* Роль колёс в манифесте: колёса живут в сцене, а не внутри уровня детализации. */
const WHEEL_ROLE = 'wheel'

/*
 * Полярный угол OrbitControls (0 — камера строго сверху, 90° — на высоте цели).
 * Контент задаёт подъём над горизонтом в градусах — так это и обсуждается
 * («подниматься на 45–50°»), — а перевод в полярный угол живёт здесь.
 */
function polarFromElevation(degrees: number): number {
  return ((90 - degrees) * Math.PI) / 180
}

/* Пульсация эмишн-материалов (фары, стопы, подсветка салона). */
const EMISSIVE_PULSE_MAX = props.model.emissivePulse ?? 5
const EMISSIVE_PULSE_HZ = props.model.emissivePulseHz ?? 0.7

/* Папка кейса с моделями: имена файлов уровней приходят из манифеста, поэтому
   путь собирается из неё, а не хардкодится. */
const modelBase = carModelBase(props.model.src)

/** Путь к GLB уровня детализации. */
function lodSrc(entry: CarLodEntry | undefined): string {
  return entry ? `${modelBase}/${entry.file}` : props.model.src
}

/* Кадрирование и зона рендера — как у общего вьювера. Для конфигуратора
   канвас по умолчанию ровно по контейнеру: под сценой стоит панель
   вариантов, и вылезающий канвас перекрывал бы кнопки. */
const FIT_FILL = props.garage?.fit ?? props.model.fit ?? 1.25
const CANVAS_SCALE = props.model.canvasScale ?? 1

let viewer: CachedCarConfigurator | undefined = cachedViewer
/* Группы вариантов активного уровня: их гаснет applyVariantSelection. Панель же
   рисует `groups` — полный набор, чтобы она не исчезала на LOD1/LOD2. */
let viewerGroups: CarVariantGroup[] = []
let manifestPromise: Promise<CarManifest | null> | null = null
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let animationFrame = 0
let accumulatedMs = 0
let lastFrameAt = 0
let lastRenderAt = 0
const FRAME_INTERVAL = 1000 / 30
let userDragging = false
let disposed = false
let idleId: number | null = null
const IDLE_TIMEOUT = 2500

function onDragStart() {
  userDragging = true
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
  const fit = ((maxDim / 2) / Math.min(vHalf, hHalf)) * FIT_FILL

  const ratio = viewer.fitDistance > 0 ? currentDistance / viewer.fitDistance : 1
  const distance = fit * ratio

  viewer.camera.position.copy(viewer.controls.target).addScaledVector(direction, distance)
  viewer.camera.near = distance / 100
  viewer.camera.far = distance * 100
  viewer.camera.updateProjectionMatrix()
  const minDistance = fit * (props.model.zoomMin ?? 0.9)
  const maxDistance = fit * (props.garage?.zoomMax ?? props.model.zoomMax ?? 1.4)
  /* Гараж ограничивает отъезд: камера за стеной показывает коробку снаружи
     вместо машины внутри. Расстояние считаем не от центра коробки, а от цели
     облёта (центра машины) до каждой из четырёх стен: зал редко бывает
     симметричен, и машина стоит не в его середине. */
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
  frameCamera()
}

function startLoop() {
  if (!viewer || animationFrame) return
  lastFrameAt = performance.now()
  const animate = () => {
    if (disposed || !viewer) return
    animationFrame = requestAnimationFrame(animate)

    const now = performance.now()
    if (!userDragging && now - lastRenderAt < FRAME_INTERVAL) return
    lastRenderAt = now

    accumulatedMs += now - lastFrameAt
    lastFrameAt = now

    const elapsed = accumulatedMs / 1000
    const phase = (Math.sin(elapsed * EMISSIVE_PULSE_HZ * Math.PI * 2) + 1) / 2
    for (const material of viewer.emissiveMaterials) {
      material.emissiveIntensity = phase * EMISSIVE_PULSE_MAX
    }

    viewer.controls.update()
    viewer.renderer.render(viewer.scene, viewer.camera)
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

/*
 * Живые показатели текущей конфигурации: считаем по видимым мешам после
 * каждого переключения, поэтому счётчик всегда совпадает с тем, что на экране.
 *
 * Колёса в цифры не идут. Машина сдана без них: то, что стоит в кадре, вьювер
 * подставил сам с подробного уровня, и это не работа модели. Иначе счётчик
 * показывал бы число, которого в файле кейса нет — из 30 526 трисов подробного
 * уровня 23 016 приходились на четыре подставленных колеса. Оговорка об этом
 * стоит рядом с самими числами (`statsNote`), чтобы цифру нельзя было прочитать
 * неправильно.
 */
function refreshStats() {
  if (!viewer) return
  stats.value = countRenderStats(viewer.model)
}

/* Группы и роли активного уровня: у LOD1/LOD2 в модели одна только нода
   `body`, поэтому набор пустой — обвесов там нет и включать нечего. */
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

/** Ноды уровня по роли колёс — из меты активного уровня. */
function wheelNodes(active: CachedCarConfigurator): THREE.Object3D[] {
  return nodeNamesByRole(active.nodeMeta, WHEEL_ROLE)
    .map(name => active.nodeByName.get(name))
    .filter((node): node is THREE.Object3D => !!node)
}

/*
 * Колёса держим в сцене, а не внутри уровня детализации: упрощённые уровни
 * приходят без колёс вовсе, и при переключении машина оставалась на пустом месте
 * и висела в воздухе. Ноды подробного уровня переносятся в группу `lod-wheels`
 * через `attach`: мировые координаты при этом сохраняются, поэтому колёса стоят
 * там, где их поставил подробный уровень, на любом выбранном уровне. Из документа
 * уровня ноды после переноса уезжают, но в `nodeByName` остаются — по ним к ним
 * по-прежнему достаётся выбор вариантов.
 */
function hoistWheels(active: CachedCarConfigurator): void {
  if (active.wheels.children.length > 0) return
  /* Источник — только самый подробный уровень (первый в манифесте): колёса
     упрощённого уровня стоят там не просто так, делиться ими с LOD0 нельзя. */
  if (active.lod !== lods.value[0]?.id) return

  const nodes = wheelNodes(active)
  if (nodes.length === 0) return

  active.wheels.name = 'lod-wheels'
  active.scene.add(active.wheels)
  active.wheels.updateMatrixWorld(true)
  for (const node of nodes) active.wheels.attach(node)
}

/*
 * Колёса на текущем уровне: если уровень пришёл со своими — показываем их и гасим
 * перенесённые (у пере-экспортированных уровней габарит колеса проще), иначе
 * остаются колёса подробного уровня. Свои определяется по родству с корнем уровня,
 * а не по манифесту: после переноса те же ноды из корня уже уехали.
 */
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

/*
 * Окраска одной точкой: всё, что собрано и может оказаться в кадре, покрашено
 * тем, что выбрано в панели. Красятся все уровни сразу, а не только видимый:
 * колёса подробного уровня живут в сцене отдельной группой и свои материалы
 * сохранили от него же — иначе после смены уровня машина меняет цвет, а колёса
 * остаются в прежнем, а возврат на просмотренный уровень показывал ту краску,
 * в какой его собрали. Карты берутся из общего кэша тайлов, поэтому повторный
 * вызов — это запись тех же значений в юниформы.
 */
async function paintScene(): Promise<void> {
  if (!viewer) return
  await Promise.all(carPaintHandles(viewer).map(handle => setCarSelection(handle, { ...paint.value })))
}

function selectVariant(groupId: string, variant: string) {
  if (status.value !== 'ready' || !kitsActive.value) return
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
    /* Уровень мог уже лежать в кэше со своей прежней окраской: перед показом
       накладываем текущий выбор заново. */
    await paintScene()
    lod.value = nextLod
    status.value = 'ready'
  }
  catch (error) {
    status.value = 'ready'
    console.error('[3d] car configurator lod failed:', nextLod, error)
  }
}

/* Сборка одного уровня: тот же путь, что и у первой модели — GLB, зонные
   материалы по маске, выбор узора и покрытия. */
async function buildLodModel(active: CachedCarConfigurator, entry: CarLodEntry): Promise<CarLodModel> {
  /* Свой декодер на загрузку: после первого GLB draco уничтожается (иначе
     висел бы вместе со воркерами), а загрузчику нужен рабочий. */
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
  /* Уровень переносится тем же смещением, что и LOD0. Своим габаритом его
     сажать нельзя: колёса есть только у подробного уровня, и посадка по
     нижней точке кузова утапливала бы машину в пол при переключении. */
  root.position.y += active.seatOffsetY

  const materials = createCarMaterials(active.three, root, {
    textureBase: carTextureBase(props.model.src),
    anisotropy: active.renderer.capabilities.getMaxAnisotropy(),
    selection: { ...paint.value },
    lampSplit: active.lampSplit ?? lampSplitFromBumpers(active.three, root),
    /* Тайлы берём из кэша уже собранного уровня: карты у всех уровней одни,
       и вторая копия той же картинки в видеопамяти не нужна. */
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

/* Смена окраски не пересобирает геометрию: новые значения уезжают в юниформы
   уже собранного материала, а карты узора и покрытия при необходимости
   догружаются. */
async function applyPaint(next: CarSelection) {
  paint.value = next
  if (!viewer) return
  viewer.paint = { ...next }
  await paintScene()
}

function selectPaint(kind: 'color' | 'pattern' | 'coverage', id: string) {
  if (status.value !== 'ready') return
  if (paint.value[kind] === id) return
  void applyPaint({ ...paint.value, [kind]: id })
}

/* Множитель масштаба узора: одно значение на всю машину, как и остальные оси. */
function selectScale(scale: number) {
  if (status.value !== 'ready') return
  if (paint.value.scale === scale) return
  void applyPaint({ ...paint.value, scale })
}

/* Подпись множителя — в формате локали: ×0,5 против ×0.5. */
function scaleLabel(scale: number): string {
  return `×${new Intl.NumberFormat(locale.value === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 }).format(scale)}`
}

function optionLabel(variant: string): string {
  if (variant === NO_VARIANT) return t('project.configurator.none')
  const names: Record<string, string> = { a: 'stock', b: 'sport', c: 'racing' }
  return t(`project.configurator.variants.${names[variant] ?? variant}`)
}

const numberFormat = computed(() => new Intl.NumberFormat(locale.value === 'ru' ? 'ru-RU' : 'en-US'))

const triangleLabel = computed(() => (stats.value ? numberFormat.value.format(stats.value.triangles) : '—'))
const drawCallLabel = computed(() => (stats.value ? numberFormat.value.format(stats.value.drawCalls) : '—'))

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
  const poster = container.value.querySelector<HTMLElement>('.car-config__poster')
  if (poster) poster.style.opacity = '0'

  status.value = 'ready'
  applySelection()
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
    const poster = container.value?.querySelector<HTMLElement>('.car-config__poster')
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
    /* Закэшированная сцена: группы и роли считаем заново. В замыкании
       компонента после перемонтирования они пусты, а без них переключение
       обвеса меняет только кнопку в панели, но не саму модель. Колёса тоже
       пересчитываем: перенесённую группу кэш хранит вместе со сценой. */
    ensureLod(viewer)
    hoistWheels(viewer)
    syncWheels(viewer)
    /* Сцена живёт в кэше вместе с материалами, но выбор пользователя — в панели:
       перед показом синхронизируем одно с другим. */
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
    /* Камера конфигуратора стоит, пока её не потянут мышью: автоповорот
       уводил бы кадр в реквизит зала мимо желания смотрящего. */
    controls.autoRotate = false

    const draco = new DRACOLoader()
    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)

    /* Первый уровень берём из манифеста: имена GLB лежат там, поэтому
       в коде номер уровня нигде не захардкожен. Если манифеста нет — падаем
       на модель из контента. */
    const levels = buildLods(manifest)
    lods.value = levels
    const firstLod = levels[0]
    const startLod = levels.some(item => item.id === lod.value) ? lod.value : (firstLod?.id ?? '0')

    /* Гараж грузим параллельно машине: у него тот же draco и та же папка,
       а последовательная загрузка — лишний кадр ожидания. */
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

    /* Гараж встаёт в ту же сцену до машины, и машина садится на его пол:
       в GLB кузов висит над землёй (колёса отдельные), а у окружения ниже
       плиты пола идёт плинтус, поэтому ни габарит машины, ни габарит гаража
       сами по себе точку опоры не задают. */
    let garage: THREE.Object3D | null = null
    let garageBox: THREE.Box3 | null = null
    /* Посадка машины на пол — одна на все уровни детализации: считаем её по
       подробному уровню (единственному с колёсами, они и касаются пола) и этим
       же смещением ставим остальные. */
    let seatOffsetY = 0
    if (garageGltf) {
      garage = garageGltf.scene
      garage.scale.setScalar(props.garage?.scale ?? 1)
      garage.rotation.y = ((props.garage?.rotation ?? 0) * Math.PI) / 180
      garage.updateMatrixWorld(true)
      garageBox = new THREE.Box3().setFromObject(garage)
      const carBox = new THREE.Box3().setFromObject(model)
      /* Пол ищем пробами по габариту машины: низ габарита гаража — это плинтус
         по периметру, на 13 см ниже плиты, и посадка по нему утапливала колёса
         внутрь пола. Если под машиной ничего не нашлось — опираемся на низ
         габарита, как раньше. */
      const floorY = garageFloorLevel(THREE, garage, {
        footprint: carBox,
        from: carBox.max.y + 0.5,
      })
      seatOffsetY = (floorY ?? garageBox.min.y) - carBox.min.y
      model.position.y += seatOffsetY
      scene.add(garage)
    }

    scene.add(model)

    /* Материалы собираются по UV-маске GLB: цвет квадранта шейдер заменяет
       зоной (краска / салон / стекло / чёрные элементы), тайл выбранного
       покрытия тянется по UV1, а стёкла уходят на отдельный прозрачный
       материал. Подъём диффузной текстуры и множитель металличности, которые
       стояли здесь раньше, маску разрушали: после +30 к каждому каналу
       квадранты превращались в пастельные пятна. */
    const lampSplit = lampSplitFromBumpers(THREE, model)
    const carMaterials = createCarMaterials(THREE, model, {
      textureBase: carTextureBase(props.model.src),
      anisotropy: renderer.capabilities.getMaxAnisotropy(),
      selection: { ...paint.value },
      lampSplit,
      /* Ноды колёс из манифеста: внутри них металл обода становится светлым
         металлом, а не чёрной зоной своей маски. */
      wheelNodes: nodeNamesByRole(buildNodeMeta(manifest, startLod), WHEEL_ROLE),
    })
    await setCarSelection(carMaterials, { ...paint.value })

    /* Пульсация эмишн-материалов общая для вьюверов. У оптики этой машины свет
       ровный: пульс раскачивал бы фары от нуля до максимума, а горящие и гаснущие
       фары — не то, что нужно. Массив остаётся пустым, цикл ничего не найдёт. */
    const emissiveMaterials: THREE.MeshStandardMaterial[] = []

    /* Ноды по имени — по ним конфигуратор включает выбранные варианты.
       Варианты обвеса в GLB лежат друг на друге, поэтому невыбранные
       обязательно гасим: иначе на машине окажутся все три бампера сразу. */
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

    /* В гараже камера не уходит под пол и не задирается в потолок: стены и
       крыша — часть кадра, и вид снизу или сверху их ломает. Пределы приходят
       из контента в градусах над горизонтом цели и переводятся в полярный угол
       с вычитанием из 90°: верхний предел становится нижней границей полярного
       угла. */
    if (garageBox) {
      const tiltFrom = props.garage?.tiltFrom ?? GARAGE_TILT_FROM
      const tiltTo = props.garage?.tiltTo ?? GARAGE_TILT_TO
      controls.minPolarAngle = polarFromElevation(Math.max(tiltFrom, tiltTo))
      controls.maxPolarAngle = polarFromElevation(Math.min(tiltFrom, tiltTo))
    }

    /* Дуга облёта — необязательная: без границ камера обходит машину полным
       кругом и стоит на месте, пока её не потянут мышью (автоповорота в зале
       нет). Замкнутому залу стопор не нужен, он остаётся для окружений
       с проёмом в стене — тогда границы читает и мышь, и зум. */
    const orbitFrom = props.garage?.orbitFrom
    const orbitTo = props.garage?.orbitTo
    if (orbitFrom !== undefined && orbitTo !== undefined) {
      const from = ((Math.min(orbitFrom, orbitTo)) * Math.PI) / 180
      const to = ((Math.max(orbitFrom, orbitTo)) * Math.PI) / 180
      controls.minAzimuthAngle = from
      controls.maxAzimuthAngle = to
    }

    /* На тач-устройствах наклон запрещён: вертикаль принадлежит странице
       (горизонтальное вращение и зум щипком остаются). */
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
    ;(window as unknown as Record<string, unknown>).__cfgViewer = viewer
    attachViewer()
  }
  catch (error) {
    if (!disposed) status.value = 'error'
    console.error('[3d] car configurator failed:', error)
  }
}

onMounted(async () => {
  /* Панель строится по манифесту (это лёгкий JSON) и не ждёт three.js:
     группы и варианты видны сразу, кнопки включаются после загрузки модели. */
  const manifest = await fetchManifest()
  if (disposed) return

  lods.value = buildLods(manifest)

  if (!cachedViewer) {
    /* Панель строится по самой подробной детализации: на остальных уровнях
       обвесов в модели нет, но панель обязана остаться на месте — она просто
       гаснет, пока выбран уровень без обвесов. */
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

/* Музыка зала: трек подхватывается не таймером, а самой сценой — пока модель
   с уровнями и текстуры не на месте, музыка только отбирала бы канал.
   Автопоявление громкости и кнопка живут в `garageAudio`. */
const soundState = ref<GarageAudioState>('muted')
const hasSound = computed(() => !!props.audio?.src)
const soundLabel = computed(() => t(soundState.value === 'playing'
  ? 'project.configurator.sound.off'
  : 'project.configurator.sound.on'))
let garageAudio: GarageAudio | undefined

function startSound() {
  if (garageAudio || !props.audio?.src) return
  garageAudio = createGarageAudio(
    { src: props.audio.src, volume: props.audio.volume, fadeIn: props.audio.fadeIn },
    { onChange: (state) => { soundState.value = state } },
  )
  garageAudio.start()
}

function toggleSound() {
  if (!garageAudio) startSound()
  else garageAudio.toggle()
}

/* `immediate`: с закэшированной сценой статус уже `ready`, и трек должен
   подхватиться сразу, а не ждать события. */
watch(status, (value) => {
  if (value === 'ready') startSound()
}, { immediate: true })

onBeforeUnmount(() => {
  if (idleId !== null) {
    if ('requestIdleCallback' in window) window.cancelIdleCallback(idleId)
    else clearTimeout(idleId)
    idleId = null
  }
  /* Музыка привязана к конфигуратору: ушли со страницы — стало тихо. */
  garageAudio?.stop()
  garageAudio = undefined
  disposed = true
  detachViewer()
  viewer = undefined
})
</script>

<template>
  <div class="car-config">
    <div
      ref="container"
      class="car-config__stage"
      :class="{ 'car-config__stage--ready': status === 'ready' }"
      :style="{ aspectRatio: `${model.width} / ${model.height}` }"
      role="img"
      :aria-label="model.alt"
      :aria-busy="status === 'loading'"
    >
      <img
        v-if="poster && !cachedViewer"
        :src="poster"
        :alt="model.alt"
        class="car-config__poster"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : 'auto'"
        decoding="async"
      >

      <div
        v-if="status === 'loading' && !poster"
        class="car-config__overlay"
      >
        <span
          class="car-config__spinner"
          aria-hidden="true"
        />
      </div>
      <p
        v-else-if="status === 'error' && !poster"
        class="car-config__overlay"
      >
        {{ model.alt }}
      </p>

      <!-- Музыка зала: кнопка появляется вместе со сценой, потому что раньше
           трек и не подхвачен. Перечёркнутая нота — звук выключен; пока браузер
           ждёт действия пользователя, кнопка выглядит так же и первый клик
           по странице запускает трек. -->
      <button
        v-if="hasSound && status === 'ready'"
        type="button"
        class="car-config__sound"
        :class="{ 'car-config__sound--off': soundState !== 'playing' }"
        :aria-pressed="soundState === 'playing'"
        :aria-label="soundLabel"
        :title="soundLabel"
        @click="toggleSound"
      >
        <svg
          class="car-config__sound-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <ellipse
            cx="9.4"
            cy="17.4"
            rx="3.5"
            ry="2.7"
            transform="rotate(-22 9.4 17.4)"
            fill="currentColor"
          />
          <path
            d="M12.8 17.4V4.2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
          <path
            d="M12.8 4.6c2.7.9 4.6 2.4 4.6 4.3 0 1.2-.7 2.3-1.8 3.2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <!-- Панель настроек: группа = роль детали в GLB, кнопки — её варианты.
         Список групп приходит из манифеста, поэтому у машины со спойлером
         вторая группа появится сама, без правок компонента. На десктопе
         панель стоит справа от сцены и листается отдельно от неё. -->
    <div class="car-config__controls">
      <!-- Заголовок лаборатории: он объясняет, что тут можно, а не начинается
           сразу с кнопок. -->
      <div class="car-config__head">
        <h3 class="text-heading text-heading--sm">
          {{ t('project.configurator.title') }}
        </h3>
        <p class="text-body--sm car-config__lead">
          {{ t('project.configurator.hint') }}
        </p>
      </div>

      <!-- Уровень детализации: LOD0/1/2 из манифеста. Обвесы есть только у
           подробного уровня, поэтому на остальных панель комплектации гаснет —
           и этого достаточно: пояснительной сноски к ней нет (решение
           владельца), погасшие кнопки читаются сами. -->
      <div
        v-if="lods.length > 1"
        class="car-config__group"
      >
        <h3 class="text-label car-config__group-name">
          {{ t('project.configurator.lodTitle') }}
        </h3>
        <div
          class="car-config__options"
          role="group"
          :aria-label="t('project.configurator.lodTitle')"
        >
          <button
            v-for="item in lods"
            :key="item.id"
            type="button"
            class="text-body--sm car-config__option"
            :class="{ 'car-config__option--active': lod === item.id }"
            :aria-pressed="lod === item.id"
            :disabled="status !== 'ready'"
            @click="selectLod(item.id)"
          >
            LOD{{ item.id }}
          </button>
        </div>
      </div>

      <div
        v-for="group in groups"
        :key="group.id"
        class="car-config__group"
        :class="{ 'car-config__group--muted': !kitsActive }"
      >
        <h3 class="text-label car-config__group-name">
          {{ t(`project.configurator.roles.${group.id}`) }}
        </h3>
        <div
          class="car-config__options"
          role="group"
          :aria-label="t(`project.configurator.roles.${group.id}`)"
          :aria-disabled="!kitsActive"
        >
          <button
            v-for="option in group.options"
            :key="option"
            type="button"
            class="text-body--sm car-config__option"
            :class="{ 'car-config__option--active': kitsActive && selection[group.id] === option }"
            :aria-pressed="kitsActive && selection[group.id] === option"
            :disabled="status !== 'ready' || !kitsActive"
            @click="selectVariant(group.id, option)"
          >
            {{ optionLabel(option) }}
          </button>
        </div>
      </div>

      <!-- Окраска: цвет, узор и покрытие. Оси независимы — любой оттенок,
           любой узор и любое покрытие складываются вместе в шейдере. -->
      <div class="car-config__group">
        <h3 class="text-label car-config__group-name">
          {{ t('project.configurator.paint.colorTitle') }}
        </h3>
        <div
          class="car-config__options"
          role="group"
          :aria-label="t('project.configurator.paint.colorTitle')"
        >
          <button
            v-for="color in CAR_PAINT_COLORS"
            :key="color.id"
            type="button"
            class="car-config__swatch"
            :class="{
              'car-config__swatch--active': paint.color === color.id,
              'car-config__swatch--none': !color.hex || color.id === 'none',
            }"
            :style="{ '--car-swatch': color.hex }"
            :aria-pressed="paint.color === color.id"
            :aria-label="t(`project.configurator.paint.colors.${color.id}`)"
            :title="t(`project.configurator.paint.colors.${color.id}`)"
            :disabled="status !== 'ready'"
            @click="selectPaint('color', color.id)"
          />
        </div>
      </div>

      <div class="car-config__group">
        <h3 class="text-label car-config__group-name">
          {{ t('project.configurator.paint.patternTitle') }}
        </h3>
        <div
          class="car-config__options"
          role="group"
          :aria-label="t('project.configurator.paint.patternTitle')"
        >
          <button
            v-for="pattern in CAR_PATTERNS"
            :key="pattern.id"
            type="button"
            class="car-config__pattern"
            :class="{ 'car-config__pattern--active': paint.pattern === pattern.id }"
            :aria-pressed="paint.pattern === pattern.id"
            :aria-label="t(`project.configurator.paint.patterns.${pattern.id}`)"
            :title="t(`project.configurator.paint.patterns.${pattern.id}`)"
            :disabled="status !== 'ready'"
            @click="selectPaint('pattern', pattern.id)"
          >
            <!-- Плитка — отдельная мелкая карта (`-thumb`): панель показывает
                 все печати сразу, и полные карты в ней были бы сотнями КБ
                 ради квадратиков 38 px. Карта для шейдера (`-color`) грузится
                 только при выборе печати. -->
            <span
              v-if="pattern.tile"
              class="car-config__pattern-thumb"
              :style="{ backgroundImage: `url(${textureBase}/${pattern.tile}-thumb.webp)` }"
              aria-hidden="true"
            />
            <span
              v-else
              class="car-config__pattern-thumb car-config__pattern-thumb--none"
              aria-hidden="true"
            />
            <span class="text-body--sm">
              {{ t(`project.configurator.paint.patterns.${pattern.id}`) }}
            </span>
          </button>
        </div>

        <!-- Множитель масштаба: насколько крупно ложится печать. Ползунок и
             полоска вариантов — одно и то же значение, просто разные способы
             его выставить; появляется вместе с выбранным узором. -->
        <div
          v-if="hasPatternTile"
          class="car-config__scale"
        >
          <div class="car-config__scale-head">
            <span class="text-body--sm car-config__scale-name">
              {{ t('project.configurator.paint.scaleTitle') }}
            </span>
            <span class="text-body--sm car-config__scale-value">
              {{ scaleLabel(paint.scale) }}
            </span>
          </div>
          <input
            class="car-config__scale-range"
            type="range"
            :min="PATTERN_SCALE_MIN"
            :max="PATTERN_SCALE_MAX"
            step="0.25"
            :value="patternScale(paint.scale)"
            :aria-label="t('project.configurator.paint.scaleTitle')"
            :disabled="status !== 'ready'"
            @input="selectScale(Number(($event.target as HTMLInputElement).value))"
          >
          <div
            class="car-config__scale-strip"
            role="group"
            :aria-label="t('project.configurator.paint.scaleTitle')"
          >
            <button
              v-for="value in CAR_PATTERN_SCALES"
              :key="value"
              type="button"
              class="text-body--sm car-config__scale-option"
              :class="{ 'car-config__scale-option--active': patternScale(paint.scale) === value }"
              :aria-pressed="patternScale(paint.scale) === value"
              :disabled="status !== 'ready'"
              @click="selectScale(value)"
            >
              {{ scaleLabel(value) }}
            </button>
          </div>
        </div>
      </div>

      <div class="car-config__group">
        <h3 class="text-label car-config__group-name">
          {{ t('project.configurator.paint.coverageTitle') }}
        </h3>
        <div
          class="car-config__options"
          role="group"
          :aria-label="t('project.configurator.paint.coverageTitle')"
        >
          <button
            v-for="coverage in CAR_COVERAGES"
            :key="coverage.id"
            type="button"
            class="text-body--sm car-config__option"
            :class="{ 'car-config__option--active': paint.coverage === coverage.id }"
            :aria-pressed="paint.coverage === coverage.id"
            :disabled="status !== 'ready'"
            @click="selectPaint('coverage', coverage.id)"
          >
            {{ t(`project.configurator.paint.coverages.${coverage.id}`) }}
          </button>
        </div>
      </div>

      <dl class="car-config__stats">
        <div class="car-config__stat">
          <dt class="text-label">
            {{ t('project.configurator.triangles') }}
          </dt>
          <dd class="text-body--sm car-config__stat-value">
            {{ triangleLabel }}
          </dd>
        </div>
        <div class="car-config__stat">
          <dt class="text-label">
            {{ t('project.configurator.drawCalls') }}
          </dt>
          <dd class="text-body--sm car-config__stat-value">
            {{ drawCallLabel }}
          </dd>
        </div>
        <button
          type="button"
          class="text-body--sm car-config__reset"
          :disabled="status !== 'ready'"
          @click="resetSelection"
        >
          {{ t('project.configurator.reset') }}
        </button>
      </dl>
      <p class="text-label car-config__stats-note">
        {{ t('project.configurator.statsNote') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.car-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* Сцена: без рамки и подложки — машина стоит прямо на фоне сайта. */
.car-config__stage {
  position: relative;
  display: block;
  width: 100%;
  background-color: transparent;
}

.car-config__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* opacity управляется из JS: канвас добавляется через JS и не получает
     data-v-xxx, поэтому scoped-правила для него ненадёжны. */
  opacity: 1;
  transition: opacity 400ms ease;
  pointer-events: none;
}

.car-config__stage :deep(canvas) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: block;
  max-width: none;
  cursor: grab;
}

@media (pointer: coarse) {
  .car-config__stage :deep(canvas) {
    touch-action: pan-y;
  }
}

.car-config__stage--ready :deep(canvas):active {
  cursor: grabbing;
}

/* Подсказки «покрутить» здесь нет намеренно: окружение рисует гараж, и любая
   подпись поверх него спорит с интерьером. Камера при этом ходит только за
   мышью (автоповорота нет), поэтому курсор-«рука» — единственная подсказка,
   что сцену можно крутить. */

/* Кнопка музыки: та же полупрозрачная чашка, что у подсказки вьювера, —
   поверх чужого интерьера гаража читается в обеих темах. Перечёркнутость
   рисует ::after, а не второй значок: линия всегда одной толщины и проходит
   ровно по ноте (центр — через top/translate, иначе absolute встаёт по потоку
   и линия уезжает вниз). */
.car-config__sound {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: var(--site-accent);
  background-color: color-mix(in srgb, var(--site-media-canvas-loop) 70%, transparent);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: color 200ms ease, opacity 200ms ease;
}

.car-config__sound:hover {
  color: var(--site-accent-hover, var(--site-accent));
}

.car-config__sound:focus-visible {
  outline: 2px solid var(--site-focus);
  outline-offset: 2px;
}

.car-config__sound-icon {
  display: block;
  width: 19px;
  height: 19px;
}

.car-config__sound--off {
  color: var(--site-text-muted);
}

.car-config__sound--off::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 7px;
  right: 7px;
  height: 1.6px;
  border-radius: 2px;
  background-color: currentColor;
  transform: translateY(-50%) rotate(-45deg);
}

.car-config__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 16px;
  color: var(--site-text-muted);
  text-align: center;
}

.car-config__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--site-border);
  border-top-color: var(--site-accent-text);
  border-radius: 50%;
  animation: car-config-spin 0.8s linear infinite;
}

@keyframes car-config-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Панель — в том же языке, что и настройки виджетов: без карточки-рамки,
   группы с подписью и линией, кнопки-чипы по теме сайта. */
.car-config__panel {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: clamp(16px, 2vw, 28px);
}

/* Голова лаборатории занимает свою строку: панель — flex-wrap-ряд групп,
   и без flex-basis:100% заголовок встал бы первой «плиткой» рядом с ними. */
.car-config__head {
  display: flex;
  flex-basis: 100%;
  flex-direction: column;
  gap: 6px;
}

.car-config__lead {
  max-width: 68ch;
  color: var(--site-text-muted);
}

.car-config__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

/* Уровень детализации без обвесов: панель комплектации гаснет целиком — видно,
   что деталей у этого LOD нет, а не что они сломались. */
.car-config__group--muted {
  opacity: 0.45;
}

.car-config__group-name {
  padding-block-end: 6px;
  border-bottom: var(--site-border);
  color: var(--site-text-secondary);
}

.car-config__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.car-config__option {
  min-height: 40px;
  padding: 8px 16px;
  border: var(--site-border);
  border-radius: 999px;
  color: var(--site-text-secondary);
  background-color: transparent;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease;
}

.car-config__option:hover:not(:disabled) {
  color: var(--site-text);
  border-color: var(--site-border-strong);
}

.car-config__option--active {
  color: var(--site-text);
  border-color: var(--site-accent-text);
  background-color: color-mix(in srgb, var(--site-accent) 16%, transparent);
}

.car-config__option:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Свотч палитры: круг заливки плюс внутренняя обводка — тёмные оттенки
   не сливаются с фоном в светлой теме. */
.car-config__swatch {
  position: relative;
  width: 40px;
  height: 40px;
  padding: 0;
  border: var(--site-border);
  border-radius: 50%;
  background-color: var(--car-swatch);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--site-text) 22%, transparent);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.car-config__swatch:hover:not(:disabled) {
  transform: scale(1.08);
}

.car-config__swatch--active {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--site-text) 22%, transparent),
    0 0 0 2px var(--site-media-canvas),
    0 0 0 4px var(--site-accent-text);
}

.car-config__swatch:disabled {
  opacity: 0.5;
  cursor: default;
}

/* «Без цвета»: светлый фон палитры без тонировки — показываем перечёркнутый
   круг, иначе свотч читается как белый цвет. */
.car-config__swatch--none {
  background-image: linear-gradient(
    to bottom right,
    transparent calc(50% - 1px),
    color-mix(in srgb, var(--site-text) 45%, transparent) calc(50% - 1px),
    color-mix(in srgb, var(--site-text) 45%, transparent) calc(50% + 1px),
    transparent calc(50% + 1px),
  );
}

/* Кнопка узора: квадратик карты плюс подпись. Превью — та же карта, что уезжает
   в шейдер, поэтому выбор виден до клика. */
.car-config__pattern {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 4px 16px 4px 4px;
  border: var(--site-border);
  border-radius: 999px;
  color: var(--site-text-secondary);
  background-color: transparent;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease;
}

.car-config__pattern:hover:not(:disabled) {
  color: var(--site-text);
  border-color: var(--site-border-strong);
}

.car-config__pattern--active {
  color: var(--site-text);
  border-color: var(--site-accent-text);
  background-color: color-mix(in srgb, var(--site-accent) 16%, transparent);
}

.car-config__pattern:disabled {
  opacity: 0.5;
  cursor: default;
}

.car-config__pattern-thumb {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: var(--site-border);
  background-size: cover;
  background-position: center;
}

/* Множитель масштаба узора: ползунок и полоска одинаковых вариантов под ним —
   «×0.5» и «×2» по краям, между ними — середина. */
.car-config__scale {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 420px;
  padding-block-start: 4px;
}

.car-config__scale-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.car-config__scale-name {
  color: var(--site-text-secondary);
}

.car-config__scale-value {
  color: var(--site-text);
  font-variant-numeric: tabular-nums;
}

.car-config__scale-range {
  width: 100%;
  accent-color: var(--site-accent-text);
  cursor: pointer;
}

.car-config__scale-range:disabled {
  opacity: 0.5;
  cursor: default;
}

.car-config__scale-strip {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.car-config__scale-option {
  flex: 1 1 0;
  min-height: 32px;
  padding: 4px 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--site-text-muted);
  background-color: transparent;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease;
}

.car-config__scale-option:hover:not(:disabled) {
  color: var(--site-text);
  border-color: var(--site-border);
}

.car-config__scale-option--active {
  color: var(--site-text);
  border-color: var(--site-accent-text);
  background-color: color-mix(in srgb, var(--site-accent) 16%, transparent);
}

.car-config__scale-option:disabled {
  opacity: 0.5;
  cursor: default;
}

.car-config__pattern-thumb--none {
  background-image: linear-gradient(
    to bottom right,
    transparent calc(50% - 1px),
    color-mix(in srgb, var(--site-text) 45%, transparent) calc(50% - 1px),
    color-mix(in srgb, var(--site-text) 45%, transparent) calc(50% + 1px),
    transparent calc(50% + 1px),
  );
}

.car-config__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px 24px;
  margin-inline-start: auto;
}

/* Оговорка к цифрам: колёс в счёте нет. Тише самих чисел — это примечание,
   а не ещё одна строка показателей. */
.car-config__stats-note {
  margin: 6px 0 0;
  color: color-mix(in srgb, var(--site-text) 55%, transparent);
}

.car-config__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.car-config__stat-value {
  color: var(--site-text);
  font-variant-numeric: tabular-nums;
}

.car-config__reset {
  align-self: center;
  min-height: 40px;
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.car-config__reset:hover:not(:disabled) {
  color: var(--site-accent-text-hover);
}

.car-config__reset:disabled {
  opacity: 0.5;
  cursor: default;
}

/* The configurator is a game screen: controls overlay the garage stage instead of
   creating a second site section below it. */
.car-config {
  position: relative;
  min-width: 0;
}

.car-config__stage {
  aspect-ratio: 16 / 10 !important;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  background: #0d1419;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
}

.car-config__controls {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: block;
  padding: 16px;
  pointer-events: none;
}

.car-config__head,
.car-config__stats,
.car-config__stats-note {
  display: none;
}

.car-config__group {
  pointer-events: auto;
}

.car-config__controls > .car-config__group {
  position: absolute;
  right: 78px;
  bottom: 14px;
  width: min(300px, calc(100% - 132px));
  max-height: min(64%, 310px);
  overflow: auto;
  padding: 15px;
  color: #e8f0f1;
  background: rgba(8, 14, 18, 0.93);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(16px);
}

.car-config__controls > .car-config__group:nth-of-type(n + 2) {
  display: none;
}

.car-config__controls > .car-config__group:first-of-type {
  display: flex;
}

.car-config__controls > .car-config__group:first-of-type::before {
  content: 'GARAGE';
  display: block;
  margin-bottom: 10px;
  color: #caff50;
  font: 800 13px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 0.13em;
}

@media (max-width: 700px) {
  .car-config__stage {
    border-radius: 10px;
  }

  .car-config__controls {
    padding: 8px;
  }

  .car-config__controls > .car-config__group {
    right: 57px;
    bottom: 8px;
    width: min(220px, calc(100% - 75px));
    max-height: 57%;
    padding: 10px;
    border-radius: 9px;
  }
}
</style>
