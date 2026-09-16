<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type * as THREE from 'three'
import { diffuseLiftMix } from '~/utils/diffuseLift'
import { createFrameLimiter, createQualityGovernor, physicalPixelRatio } from '~/utils/framePacing'
import { viewerCache } from '~/utils/modelViewerCache'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'
import type { CachedViewer } from '~/utils/modelViewerCache'

const props = withDefaults(
  defineProps<{
    src: string
    alt: string
    width: number
    height: number
    autoRotate?: boolean
    poster?: string
    /* Постер грузить сразу (hero-позиция, LCP), а не лениво. */
    priority?: boolean
    /* Визуальные параметры вьювера — приходят из frontmatter кейса (model:),
       чтобы каждая модель могла переопределять дефолты движка. */
    emissivePulse?: number
    emissivePulseHz?: number
    metalness?: number
    diffuseLift?: number
    rotation?: number
    autoRotateSpeed?: number
    environmentIntensity?: number
    hemisphereLight?: number
    keyLight?: number
    fillLight?: number
    /* Ступор зума: zoomMin — как близко можно приблизить (меньше = модель
       крупнее), zoomMax — как далеко можно отъехать. */
    zoomMin?: number
    zoomMax?: number
    /* Зазор вокруг модели при кадрировании: меньше — модель крупнее в кадре. */
    fit?: number
    /* Масштаб канваса рендера относительно контейнера (1.8): 1 — канвас
       ровно по контейнеру, модель стоит отдельно и не перекрывает соседние
       блоки. */
    canvasScale?: number
  }>(),
  {
    autoRotate: true,
    priority: false,
    emissivePulse: 5,
    emissivePulseHz: 0.7,
    metalness: 0.88,
    diffuseLift: 30,
    rotation: 0,
    autoRotateSpeed: 1.2,
    environmentIntensity: 0.5,
    hemisphereLight: 0.5,
    keyLight: 0.8,
    fillLight: 0.4,
    zoomMin: 0.9,
    zoomMax: 1.4,
    fit: 1.25,
    canvasScale: 1.8,
  },
)

const { t } = useI18n()

const container = ref<HTMLElement | null>(null)

/* Уже загруженный вьювер (канвас + модель + камера) переиспользуем между
   инстансами: при смене языка компонент перемонтируется, но модель не грузим заново —
   лишь подхватываем тот же канвас. Тогда и постер не мигает при переключении. */
const cachedViewer = viewerCache.get(props.src)
const status = ref<'loading' | 'ready' | 'error'>(cachedViewer ? 'ready' : 'loading')

/* Подсказка «покрутить» видна до первого взаимодействия, затем плавно гаснет.
   Локальное состояние: новый инстанс (смена языка) снова показывает подсказку. */
const interacted = ref(false)
const hintDismissed = ref(false)

/* Пульсация эмишн-материалов (LED, индикаторы, дисплеи).
   Максимум и частота — из настроек модели (emissivePulse / emissivePulseHz). */
const EMISSIVE_PULSE_MAX = props.emissivePulse ?? 5
const EMISSIVE_PULSE_HZ = props.emissivePulseHz ?? 0.7

/* Кадрирование: FIT_FILL умножается на дистанцию камеры — чем больше,
   тем дальше камера и тем меньше модель в кадре (с воздухом по краям).
   ＞1 оставляет зазор вокруг габаритного бокса. Дистанция считается по
   канвасу, а он шире контейнера (CANVAS_SCALE), поэтому крупным объектам
   вроде дома нужен зазор меньше единицы — значение приходит из контента. */
const FIT_FILL = props.fit ?? 1.25
/* Зона рендеринга шире контейнера: канвас центрируется на контейнере, поэтому
   модель остаётся в том же месте, но её края выходят за рамку — «окна» не видно.
   На мобильных не масштабируем, чтобы не вылезать за вьюпорт.
   Масштаб настраивается по кейсу (canvasScale): 1 ставит канвас ровно по
   контейнеру — для моделей, которые должны стоять отдельно и не наезжать
   на соседние блоки. */
const CANVAS_SCALE = props.canvasScale ?? 1.8

let viewer: CachedViewer | undefined = cachedViewer
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
/* Наблюдатель приближения: пока блок далеко за экраном, сцена не создаётся. */
let startObserver: IntersectionObserver | undefined
let animationFrame = 0
/* Накопленное время активного рендера: пауза вне вьюпорта не сбивает
   фазу пульсации эмишн-материалов. */
let accumulatedMs = 0
let lastFrameAt = 0
/* Лимит кадров в покое: автоповорот медленный, 60fps не видно, но каждый
   кадр — работа главного потока. Интервал считается с переносом остатка
   (utils/framePacing): при простой разнице с моментом последнего кадра
   лимит 30fps на 60-герцовом rAF превращался в 20. */
const frameLimiter = createFrameLimiter(30)
/* Регулятор качества: если устройство не успевает кадры, плотность буфера
   опускается на ступень (utils/framePacing). Опора — частота самого экрана,
   поэтому экран 30 Гц за перегрузку не принимается. */
const quality = createQualityGovernor()
/* Канвас вьювера больше контейнера (CANVAS_SCALE), и эти пиксели видно —
   «вылет» модели за колонку и есть замысел. Но на большом блоке и экране
   высокой плотности их набегает вчетверо больше без пользы, поэтому кадр
   ограничен бюджетом физических пикселей; ниже плотности 1 вьювер не
   опускается — размытая модель хуже лишних пикселей. */
const DESKTOP_DPR_CAP = 2
const MOBILE_DPR_CAP = 1.5
const DESKTOP_PIXEL_BUDGET = 3_200_000
const MOBILE_PIXEL_BUDGET = 1_600_000
/* Во время ручного вращения рендерим каждый кадр — инерция OrbitControls
   требует непрерывного цикла, иначе поворот «дёргается». */
let userDragging = false
let disposed = false
let dismissTimer: ReturnType<typeof setTimeout> | undefined
/* Отложенный старт: three.js + декодер весят ~1.4 МБ и на главном потоке
   отнимают секунды у первого рендера (LCP/TBT). Инициализируем вьювер
   только когда браузер простаивает, но не позже 2.5 с — постер успевает
   показаться первым. */
let idleId: number | null = null
const IDLE_TIMEOUT = 2500
/* Отступ, с которого блок считается «подходящим»: примерно один экран
   промотки, чтобы к моменту показа модель уже грузилась. */
const START_MARGIN = '300px 0px'

function markInteracted() {
  if (interacted.value) return
  interacted.value = true
  dismissTimer = setTimeout(() => {
    hintDismissed.value = true
  }, 350)
}

/* Ручное вращение: пока пользователь держит модель, рендерим каждый кадр
   (инерция OrbitControls плавная), в покое — 30fps. */
function onDragStart() {
  userDragging = true
}

function onDragEnd() {
  userDragging = false
}

/* Зум колесом — только с Ctrl/⌘. Без модификатора событие до OrbitControls
   не доходит, страница прокручивается как обычно. preventDefault здесь не
   зовём: колесо должно достаться браузеру. Ctrl + колесо пропускаем дальше —
   OrbitControls сам погасит браузерный зум страницы. */
function onWheelCapture(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) return
  event.stopPropagation()
}

/* Кадрирует камеру под текущие размеры канваса. Сохраняет направление взгляда
   (поворот пользователя/автоповорот) и относительный уровень зума при ресайзе. */
function frameCamera() {
  if (!viewer || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  if (w === 0 || h === 0) return

  const direction = viewer.camera.position.clone().sub(viewer.controls.target)
  const currentDistance = direction.length() || 1
  direction.normalize()

  /* Вписываем наибольший габарит модели в тесную ось фрустума. */
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
  viewer.controls.minDistance = fit * props.zoomMin
  viewer.controls.maxDistance = fit * props.zoomMax
  viewer.controls.update()
  viewer.fitDistance = fit
}

/* Плотность кадра: не выше потолка устройства и не выше бюджета пикселей,
   но не ниже 1 — иначе модель на большом блоке превращается в кашу. */
function pixelRatioFor(cssWidth: number, cssHeight: number): number {
  const narrow = window.innerWidth < 1024
  return physicalPixelRatio({
    cssWidth,
    cssHeight,
    dpr: window.devicePixelRatio || 1,
    cap: narrow ? MOBILE_DPR_CAP : DESKTOP_DPR_CAP,
    budget: narrow ? MOBILE_PIXEL_BUDGET : DESKTOP_PIXEL_BUDGET,
    floor: 1,
    scale: quality.scale(),
  })
}

function resizeRenderer() {
  if (!viewer || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  if (w === 0 || h === 0) return
  const scale = window.innerWidth >= 1024 ? CANVAS_SCALE : 1
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  viewer.renderer.setPixelRatio(pixelRatioFor(cw, ch))
  viewer.renderer.setSize(cw, ch)
  viewer.camera.aspect = cw / ch
  viewer.camera.updateProjectionMatrix()
  frameCamera()
}

function startLoop() {
  if (!viewer || animationFrame) return
  /* Возврат к экрану рисует кадр сразу, а не через интервал лимита. */
  frameLimiter.reset(performance.now())
  lastFrameAt = performance.now()
  const animate = () => {
    if (disposed || !viewer) return
    animationFrame = requestAnimationFrame(animate)

    const now = performance.now()
    if (quality.sample(now)) resizeRenderer()
    /* В покое рендерим не чаще 30fps (автоповорот плавный и на 30);
       при ручном вращении — каждый кадр, чтобы инерция не дёргалась. */
    if (!userDragging && !frameLimiter.shouldRender(now)) return

    accumulatedMs += now - lastFrameAt
    lastFrameAt = now

    /* Эмишн дышит по синусоиде в диапазоне 0..EMISSIVE_PULSE_MAX. */
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
  quality.pause()
}

/* Рендерим, только когда вьювер виден: вне вьюпорта цикл останавливается,
   при появлении — запускается снова. rootMargin подгружает чуть заранее. */
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

/* Подцепляем готовый канвас к текущему контейнеру и запускаем рендер-цикл.
   Вьювер сам по себе не уничтожаем — он живёт в кэше до конца сессии. */
function attachViewer() {
  if (!viewer || !container.value) return

  const canvas = viewer.renderer.domElement
  container.value.appendChild(canvas)
  /* Колесо перехватываем на контейнере в фазе перехвата — до того, как его
     увидит OrbitControls на самом канвасе. Простое колесо отдаём странице
     (иначе мимо модели не пролистать: канвас шире рамки и перекрывает
     половину экрана), зум остаётся на Ctrl/⌘ + колесо. */
  container.value.addEventListener('wheel', onWheelCapture, { capture: true })
  canvas.addEventListener('pointerdown', markInteracted)
  canvas.addEventListener('pointerdown', onDragStart)
  canvas.addEventListener('pointerup', onDragEnd)
  canvas.addEventListener('pointercancel', onDragEnd)
  canvas.addEventListener('wheel', markInteracted)

  resizeRenderer()

  resizeObserver = new ResizeObserver(resizeRenderer)
  resizeObserver.observe(container.value)

  /* Применяем opacity через JS, а не через scoped CSS — канвас добавляется
     в DOM через JS и не получает data-v-xxx, поэтому :deep() селекторы
     для opacity не работают стабильно. */
  canvas.style.opacity = '1'
  const poster = container.value.querySelector<HTMLElement>('.model-viewer__poster')
  if (poster) poster.style.opacity = '0'

  status.value = 'ready'
  observeVisibility()
}

function detachViewer() {
  stopLoop()
  resizeObserver?.disconnect()
  resizeObserver = undefined
  intersectionObserver?.disconnect()
  intersectionObserver = undefined
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = undefined
  }
  container.value?.removeEventListener('wheel', onWheelCapture, { capture: true })
  if (viewer) {
    const canvas = viewer.renderer.domElement
    canvas.removeEventListener('pointerdown', markInteracted)
    canvas.removeEventListener('pointerdown', onDragStart)
    canvas.removeEventListener('pointerup', onDragEnd)
    canvas.removeEventListener('pointercancel', onDragEnd)
    canvas.removeEventListener('wheel', markInteracted)
    canvas.style.opacity = ''
    const poster = container.value?.querySelector<HTMLElement>('.model-viewer__poster')
    if (poster) poster.style.opacity = ''
    if (canvas.parentElement === container.value) {
      canvas.remove()
    }
  }
}

async function mountViewer() {
  if (!container.value || disposed) return

  if (viewer) {
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

    const width = container.value.clientWidth || props.width
    const height = container.value.clientHeight || props.height

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    /* Точную плотность кадра ставит resizeRenderer() по бюджету пикселей;
       здесь — только стартовое приближение, чтобы первый кадр не рисовался
       в полную плотность экрана. */
    renderer.setPixelRatio(pixelRatioFor(width, height))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    /* Тени отключены: на тёмной модели они не читаются и только добавляют
       вычислительную нагрузку. */

    const scene = new THREE.Scene()

    /* Студийное окружение. Раньше было интенсивности 1 (по умолчанию) —
       оно и давало сильные засветы на светлых гранях. Снизили вдвое
       через scene.environmentIntensity = 0.5. */
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    scene.environmentIntensity = props.environmentIntensity ?? 0.5

    /* Свет для формы: полусфера + ключевой + мягкая подсветка.
       Все источники слегка наклонены от вертикали: при виде строго сверху
       блик не попадает в центр. */
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x333333, props.hemisphereLight ?? 0.5)
    hemisphere.rotation.x = 0.08
    hemisphere.rotation.z = -0.1
    scene.add(hemisphere)

    const key = new THREE.DirectionalLight(0xffffff, props.keyLight ?? 0.8)
    key.position.set(5, 5.5, 3.5)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, props.fillLight ?? 0.4)
    fill.position.set(-4.5, 2.8, -3.5)
    scene.add(fill)

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100)
    camera.position.set(0, 1, 3)

    const controls = new OrbitControls(camera, renderer.domElement)
    /* OrbitControls при connect() ставит inline `touch-action: none` — это
       перекрывает CSS и на мобильных блокирует скролл страницы мимо модели
       (вертикальный свайп крутил бы модель). Возвращаем вертикаль браузеру:
       свайп вверх/вниз скроллит страницу, горизонтальный — вращает модель.
       Общая логика для всех вьюверов — utils/touchScroll. */
    applyTouchScrollPolicy(renderer.domElement)
    /* На телефоне модель крутится только в стороны: вертикаль принадлежит
       странице. Панорамирование двумя пальцами тоже выключаем — остаётся
       зум щипком, как просили. Полярный угол запирается ниже, когда камера
       уже встала на стартовый ракурс. */
    if (isCoarsePointer()) controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = props.autoRotate
    controls.autoRotateSpeed = props.autoRotateSpeed ?? 1.2

    const draco = new DRACOLoader()
    /* Без setDecoderPath: three 0.185 сам эмитит декодер (wasm + wrapper)
       через new URL(..., import.meta.url) — Vite кладёт их в /_nuxt/.
       Явный путь '/draco/' создавал дубль: грузились и Vite-копии (703KB),
       и статика public/draco (279KB wasm + wrapper). */

    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)

    const gltf = await loader.loadAsync(props.src)
    draco.dispose()

    /* Компонент могли размонтировать, пока модель грузилась (смена языка
       во время первой загрузки). Тогда вычищаем неиспользуемый контекст. */
    if (disposed || !container.value) {
      controls.dispose()
      renderer.dispose()
      return
    }

    const model = gltf.scene
    /* Разворот модели вокруг Y (градусы → радианы): каждая GLB может быть
       экспортирована своей стороной к камере — задаётся в frontmatter. */
    model.rotation.y = ((props.rotation ?? 0) * Math.PI) / 180
    scene.add(model)

    /* Диффузная текстура корпуса почти чисто чёрная (медиана яркости ~1/255):
       тени на таком материале не читаются, форма «проваливается». Поднимаем
       уровень чёрного: тёмные участки → тёмно-серые, светлые (логотип) почти
       не меняются. Сила подъёма — из настроек модели (diffuseLift).

       Это микс в шейдере, а не попиксельный проход по canvas: у Softlogic
       карта 4096², то есть ~50 млн операций на главном потоке плюс вторая
       копия текстуры в памяти — на первом показе это заметный фриз, а не
       «экономия на качестве». Формула та же и в том же пространстве sRGB:
       sRGBTransferOETF/EOTF three подключает в префикс любого фрагментного
       шейдера (WebGLProgram → colorspace_pars_fragment). */
    const DIFFUSE_LIFT = props.diffuseLift ?? 30

    const applyDiffuseLift = (material: THREE.MeshStandardMaterial, lift: number) => {
      material.onBeforeCompile = (shader) => {
        /* `lift` — в единицах канала 0–255 (как в контенте), а mix нужна
           доля: сырое 30 выбивало карту в белый (utils/diffuseLift). */
        shader.uniforms.uDiffuseLift = { value: diffuseLiftMix(lift) }
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uDiffuseLift;')
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            {
              /* Карта пришла в линейном пространстве: поднимаем уровень
                 чёрного в sRGB, как это делал canvas-проход, и возвращаем
                 обратно — так результат совпадает с прежним. */
              vec3 liftedSrgb = sRGBTransferOETF(vec4(diffuseColor.rgb, 1.0)).rgb;
              diffuseColor.rgb = sRGBTransferEOTF(vec4(mix(liftedSrgb, vec3(1.0), uDiffuseLift), 1.0)).rgb;
            }`,
          )
      }
      /* Разные значения подъёма — разные программы: без своего ключа three
         переиспользовал бы программу модели с другим подъёмом и чужим
         юниформом. */
      material.customProgramCacheKey = () => `diffuseLift:${lift}`
      material.needsUpdate = true
    }

    /* Материалы со свечением: их `emissiveIntensity` пульсирует в цикле рендера. */
    const emissiveMaterials: THREE.MeshStandardMaterial[] = []
    model.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        const standard = material as THREE.MeshStandardMaterial
        /* Снижаем металличность: металл даёт почти чисто зеркальный отклик
           без диффузии, из-за чего чёрный корпус «проваливается». Фактор
           умножает карту металла — 0.88 приглушает зеркальность.
           Значение — из настроек модели (metalness). */
        standard.metalness = (standard.metalness ?? 1) * (props.metalness ?? 0.88)
        /* При нулевом подъёме хук не вешаем вовсе: на моделях с запечённым
           светом (дома) поднимать нечего, а лишний вариант шейдера — лишняя
           компиляция. */
        if (standard.map && DIFFUSE_LIFT > 0) applyDiffuseLift(standard, DIFFUSE_LIFT)
        if (standard.emissiveMap || standard.emissive.getHex() !== 0) {
          emissiveMaterials.push(standard)
        }
      }
    })

    /* Габариты модели + стартовый ракурс: камера смотрит чуть сверху-сбоку. */
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const direction = new THREE.Vector3(0.6, 0.35, 1).normalize()

    camera.position.copy(center).addScaledVector(direction, 1)
    controls.target.copy(center)
    controls.update()

    /* Наклон запрещён на тач-устройствах: свайп вверх/вниз браузер забирает
       под скролл (touch-action: pan-y), но диагональный жест успевал завалить
       дом до того, как прилетит pointercancel. Запираем полярный угол на
       стартовом — горизонтальное вращение и зум щипком остаются. */
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
    }
    viewerCache.set(props.src, viewer)
    attachViewer()
  }
  catch (error) {
    if (!disposed) status.value = 'error'
    console.error('[3d] model viewer failed:', error)
  }
}

/* Старт отложен вдвойне: сначала ждём, пока блок подойдёт к экрану, потом —
   простоя браузера. Постер держит кадр вместо модели, поэтому ожидание не
   читается как пустое место, а three.js с декодером (~1,4 МБ) не отнимают
   главный поток у текста и первой отрисовки. */
function scheduleMount() {
  if (disposed) return
  if ('requestIdleCallback' in window) {
    idleId = window.requestIdleCallback(mountViewer, { timeout: IDLE_TIMEOUT })
  }
  else {
    /* setTimeout напрямую: после проверки `in` TS сужает window до never. */
    idleId = setTimeout(mountViewer, IDLE_TIMEOUT)
  }
}

onMounted(() => {
  /* У кейса с двумя моделями обе GLB раньше уходили в сеть сразу после
     навигации, хотя вторая стоит на две тысячи пикселей ниже (Hilbert —
     4,3 МБ). Теперь загрузку открывает приближение блока к окну. */
  if (typeof IntersectionObserver === 'undefined' || !container.value) {
    scheduleMount()
    return
  }
  startObserver = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1]
    if (entry && !entry.isIntersecting) return
    startObserver?.disconnect()
    startObserver = undefined
    scheduleMount()
  }, { rootMargin: START_MARGIN })
  startObserver.observe(container.value)
})
onBeforeUnmount(() => {
  /* Отменяем отложенный старт, если вьювер ещё не инициализировался. */
  startObserver?.disconnect()
  startObserver = undefined
  if (idleId !== null) {
    if ('requestIdleCallback' in window) window.cancelIdleCallback(idleId)
    else clearTimeout(idleId)
    idleId = null
  }
  disposed = true
  detachViewer()
  viewer = undefined
})
</script>

<template>
  <div
    ref="container"
    class="model-viewer"
    :class="{ 'model-viewer--ready': status === 'ready' }"
    :style="{ aspectRatio: `${width} / ${height}` }"
    role="img"
    :aria-label="alt"
    :aria-busy="status === 'loading'"
  >
    <img
      v-if="poster && !cachedViewer"
      :src="poster"
      :alt="alt"
      class="model-viewer__poster"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
      decoding="async"
    >
    <div
      v-if="status === 'loading' && !poster"
      class="model-viewer__overlay"
    >
      <span
        class="model-viewer__spinner"
        aria-hidden="true"
      />
    </div>
    <p
      v-else-if="status === 'error' && !poster"
      class="model-viewer__overlay"
    >
      {{ alt }}
    </p>
    <div
      v-if="status === 'ready' && !hintDismissed"
      class="model-viewer__hint"
      :class="{ 'model-viewer__hint--leaving': interacted }"
      aria-hidden="true"
    >
      <svg
        class="model-viewer__hint-icon"
        viewBox="0 0 24 24"
        width="44"
        height="44"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      <span class="model-viewer__hint-text">{{ t('project.media.rotate') }}</span>
    </div>
  </div>
</template>

<style scoped>
.model-viewer {
  /* Без рамки и подложки: модель лежит прямо на фоне сайта. */
  position: relative;
  display: block;
  width: 100%;
  background-color: transparent;
}

.model-viewer__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* opacity управляется из JS в attachViewer()/detachViewer():
     канвас добавляется через JS и не получает data-v-xxx,
     поэтому scoped-правила :deep() для opacity ненадёжны. */
  opacity: 1;
  transition: opacity 400ms ease;
  pointer-events: none;
}

/* Канвас прозрачный и лежит поверх постера: модель плавно проявляется,
   пока обложка уходит в прозрачность — мягкий кроссфейд без вспышки фона. */
.model-viewer :deep(canvas) {
  /* Канвас больше контейнера и центрирован на нём: модель остаётся на месте,
     но зона рендеринга выходит за края — рамки окна не видно. */
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: block;
  /* Глобальное `canvas { max-width: 100% }` прижимает ширину канваса к контейнеру,
     искажая пропорции (модель «толстеет»). Размер канваса задаёт three inline. */
  max-width: none;
  /* Курсор-«хваталка»: grab в покое, grabbing при перетаскивании. */
  cursor: grab;
}

/* На тач-устройствах вертикальный свайп по модели должен скроллить страницу,
   а не вращать модель (fallback для CSS-правила; inline-стиль из
   utils/touchScroll всё равно главный, т.к. OrbitControls ставит inline none). */
@media (pointer: coarse) {
  .model-viewer :deep(canvas) {
    touch-action: pan-y;
  }
}

.model-viewer--ready :deep(canvas):active {
  cursor: grabbing;
}

.model-viewer__hint {
  position: absolute;
  left: 50%;
  top: 56%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 26px;
  border-radius: 999px;
  color: var(--site-accent);
  /* Полупрозрачная подложка-чип без обводки: слово и стрелка читаются
     поверх тёмного корпуса в обеих темах, модель мягко просвечивает. */
  background-color: color-mix(in srgb, var(--site-media-canvas-loop) 70%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
  opacity: 1;
  transition: opacity 350ms ease;
  pointer-events: none;
  /* Канвас добавляется в DOM через JS после шаблона Vue и оказывается
     последним элементом → перекрывает подсказку при z-index: auto.
     Поднимаем подсказку выше канваса. */
  z-index: 2;
}

.model-viewer__hint--leaving {
  opacity: 0;
}

.model-viewer__hint-icon {
  display: block;
  flex: none;
  animation: model-viewer-hint-pulse 2.4s ease-in-out infinite;
}

.model-viewer__hint-text {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

@keyframes model-viewer-hint-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(0.94) rotate(-7deg);
  }

  50% {
    opacity: 1;
    transform: scale(1.06) rotate(7deg);
  }
}

.model-viewer__overlay {
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

.model-viewer__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--site-border);
  border-top-color: var(--site-accent-text);
  border-radius: 50%;
  animation: model-viewer-spin 0.8s linear infinite;
}

@keyframes model-viewer-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
