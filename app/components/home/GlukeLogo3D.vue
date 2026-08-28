<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type * as THREE from 'three'
import { getViewerPose, saveViewerPose } from '~/utils/modelViewPose'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'
import { getGlukeViewer, setGlukeViewer } from '~/utils/glukeLogo3dCache'

const props = withDefaults(
  defineProps<{
    src: string
    /** Idle spin speed, radians/second (вокруг собственной оси модели). */
    spinSpeed?: number
    /** Границы клипа раскрытия в секундах: до tClosed модель собрана,
       к tOpen полностью разобрана. Дефолты под «Take 001» текущей модели —
       при смене модели их можно переопределить из родителя. */
    tClosed?: number
    tOpen?: number
  }>(),
  {
    spinSpeed: 0.25,
    tClosed: 0.667,
    tOpen: 1.667,
  },
)

const container = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
/* Прогресс раскрытия 0..1: считается от позиции скролла по hero-секции
   (см. референс D:/Work/WEB/exploded/index.html). */
const progress = ref(0)

/* Границы окна клипа, которым водит скролл, — из props (tClosed/tOpen),
   чтобы при смене модели не править код вьювера. */
const T_CLOSED = props.tClosed ?? 0.667
const T_OPEN = props.tOpen ?? 1.667

/* Сглаживание прокрутки (выше = отзывчивее) и запас вокруг модели в кадре:
   камера стоит дальше, вокруг раскрытой модели остаётся воздух. */
const DAMPING = 5.5
const MARGIN = 0.9

/* Производительность: лимит кадров 30fps в покое — спин медленный
   (0.25 рад/с), 60fps не видно, но на слабых устройствах (и в аудите
   Lighthouse с 4× троттлингом CPU) каждый кадр — секунды главного потока.
   Во время драга рендерим каждый кадр (отзывчивость важнее). */
const FRAME_INTERVAL = 1000 / 30

/* Камера-зум по прогрессу раскрытия. На старте (прогресс 0) камера вдвое
   ближе к distOpen — модель крупная и хорошо видна. Отдаление нелинейное:
   на первых прокрутках камера быстро уходит назад, а финальная дистанция
   (прогресс 1) чуть дальше базовой — раскрытая модель влезает целиком,
   без обрезки по краям кадра. */
const ZOOM_CLOSE = 0.5
const ZOOM_FAR = 1.15
/* Показатель кривой < 1: рост быстрый в начале и затухает к концу. */
const ZOOM_CURVE = 0.7

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let mixer: THREE.AnimationMixer | undefined
let action: THREE.AnimationAction | undefined
let pivot: THREE.Group | undefined
let tiltPivot: THREE.Group | undefined
let animFrame = 0
let lastFrame = 0
let disposed = false
let resizeObs: ResizeObserver | undefined
/* Точки кадрирования по раскрытому состоянию (радиус свупа, высота). */
let fitOpen: Array<[number, number]> | null = null
/* Дистанция камеры при полностью раскрытой модели (прогресс 1).
   В собранном состоянии (прогресс 0) камера вдвое ближе — модель крупная. */
let distOpen = 5
/* Текущий и целевой прогресс: target приходит из скролла, progress догоняет
   его экспоненциальным сглаживанием в рендер-цикле. */
let progressTarget = 0
let progressCurrent = 0
let heroEl: HTMLElement | null = null
/* Ручное вращение модели: горизонтальный drag крутит pivot вокруг Y,
   вертикальный — наклоняет вокруг мировой оси X в пределах ±TILT_LIMIT.
   Автоповорот на время драга ставится на паузу. */
let dragging = false
let lastPointerX = 0
let lastPointerY = 0
let canvasEl: HTMLCanvasElement | null = null
const DRAG_SENSITIVITY = 0.01
const TILT_LIMIT = (15 * Math.PI) / 180
/* Тач-устройства: вертикальный свайп должен скроллить страницу, а не
   вращать модель. Разделяем жесты по направлению — ось определяется по
   доминирующей компоненте движения от точки касания. */
const coarsePointer = isCoarsePointer()
let dragAxis: 'x' | 'y' | null = null
let gestureStartX = 0
let gestureStartY = 0
const GESTURE_LOCK_PX = 6
/* Отложенный старт: three.js + декодер весят ~1.4 МБ и на главном потоке
   отнимают секунды у первого рендера (LCP/TBT). Инициализируем вьювер
   только когда браузер простаивает, но не позже 2.5 с. */
let idleId: number | null = null
const IDLE_TIMEOUT = 2500

function markReady() {
  status.value = 'ready'
}

/* Сэмплит клип в момент t и обновляет мировые матрицы — вызывается и для
   кадрирования (до рендера), и в рендер-цикле. */
function sample(t: number) {
  if (!action || !mixer || !pivot) return
  action.time = t
  mixer.update(0)
  pivot.updateMatrixWorld(true)
}

/* Прогресс раскрытия = часть скролла, на которой hero-секция «приколота»
   к верху вьюпорта (пока она не уехала за hero.offsetHeight). */
function scrollProgress(): number {
  if (!heroEl) return 0
  const range = heroEl.offsetHeight - window.innerHeight
  if (range <= 0) return 0
  return Math.min(1, Math.max(0, window.scrollY / range))
}

/* Модель вращается только вокруг Y, поэтому каждая точка заметает окружность
   радиуса hypot(x, z). Сводим геометрию к (радиус, высота) — оба инвариантны
   к вращению — и решаем кадрирование точно для любого вьюпорта. */
function measure(t: number, THREE: typeof import('three')): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  if (!pivot) return pts
  sample(t)
  const v = new THREE.Vector3()
  pivot.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const bb = mesh.geometry.boundingBox
    if (!bb) return
    for (let i = 0; i < 8; i++) {
      v.set(
        i & 1 ? bb.max.x : bb.min.x,
        i & 2 ? bb.max.y : bb.min.y,
        i & 4 ? bb.max.z : bb.min.z,
      ).applyMatrix4(o.matrixWorld)
      pts.push([Math.hypot(v.x, v.z), Math.abs(v.y)])
    }
  })
  return pts
}

/* Дистанция камеры, при которой все точки помещаются во фрустум при любом
   повороте pivot: боковые грани ограничивают синусом половинного hFov,
   вертикаль — тангенсом половинного vFov плюс радиус (точка, свёрнутая
   к камере по кругу). */
function distanceFor(pts: Array<[number, number]>): number {
  if (!camera) return 5
  const vFov = (camera.fov * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
  const sinH = Math.sin(hFov / 2)
  const tanV = Math.tan(vFov / 2)
  let d = 0
  for (const [radius, height] of pts) {
    d = Math.max(d, radius / sinH, height / tanV + radius)
  }
  return d * MARGIN
}

function resize() {
  if (!renderer || !camera || !container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  if (w === 0 || h === 0) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  /* Базовая дистанция — для полностью раскрытого состояния. Сама позиция
     камеры интерполируется в рендер-цикле по прогрессу раскрытия. */
  if (fitOpen) {
    distOpen = distanceFor(fitOpen)
  }
}

function onScroll() {
  progressTarget = scrollProgress()
}

function onPointerDown(e: PointerEvent) {
  dragging = true
  dragAxis = null
  gestureStartX = e.clientX
  gestureStartY = e.clientY
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  /* На тач-устройствах capture не берём: он не мешает браузерному скроллу
     (touch-action: pan-y), но на всякий случай не удерживаем указатель,
     чтобы вертикальный свайп гарантированно достался странице. На десктопе
     capture нужен — мышью можно уводить курсор за край canvas. */
  if (!coarsePointer) {
    try {
      canvasEl?.setPointerCapture(e.pointerId)
    }
    catch {
      /* Синтетические события (тесты/автоматизация) не имеют активного
         указателя — capture не обязателен, drag работает и без него. */
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging || !pivot) return
  const dx = e.clientX - lastPointerX
  const dy = e.clientY - lastPointerY
  lastPointerX = e.clientX
  lastPointerY = e.clientY

  /* На тач-устройствах ось жеста фиксируем один раз по первой доминирующей
     компоненте движения от точки касания: вертикальный свайп отдаём
     браузеру (скролл страницы), вращаем модель только по горизонтали. */
  if (coarsePointer) {
    if (dragAxis === null) {
      const adx = Math.abs(e.clientX - gestureStartX)
      const ady = Math.abs(e.clientY - gestureStartY)
      if (adx < GESTURE_LOCK_PX && ady < GESTURE_LOCK_PX) return
      dragAxis = adx >= ady ? 'x' : 'y'
    }
    if (dragAxis === 'y') return
  }

  /* Горизонталь — поворот вокруг оси модели. */
  pivot.rotation.y += dx * DRAG_SENSITIVITY
  /* Вертикаль — наклон вперёд/назад в пределах ±15° (только на десктопе,
     где вертикальный жест не занят скроллом страницы). */
  if (tiltPivot && !coarsePointer) {
    tiltPivot.rotation.x = Math.min(
      TILT_LIMIT,
      Math.max(-TILT_LIMIT, tiltPivot.rotation.x + dy * DRAG_SENSITIVITY),
    )
  }
}

function onPointerUp(e: PointerEvent) {
  dragging = false
  dragAxis = null
  if (canvasEl?.hasPointerCapture(e.pointerId)) {
    canvasEl.releasePointerCapture(e.pointerId)
  }
}

function startLoop() {
  if (animFrame) return
  let lastTime = performance.now()

  const animate = () => {
    if (disposed) return
    animFrame = requestAnimationFrame(animate)

    const now = performance.now()
    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    /* Ничего не рисуем, когда hero уже уехал за экран. */
    if (heroEl && window.scrollY > heroEl.offsetHeight) return

    /* В покое рендерим не чаще 30fps; во время драга — каждый кадр. */
    if (!dragging && now - lastFrame < FRAME_INTERVAL) return
    lastFrame = now

    /* Частотно-независимое экспоненциальное сглаживание к позиции скролла. */
    progressCurrent += (progressTarget - progressCurrent) * (1 - Math.exp(-DAMPING * dt))
    progress.value = progressCurrent

    /* Автоповорот крутится, только когда пользователь не держит модель. */
    if (pivot && !dragging) pivot.rotation.y += (props.spinSpeed ?? 0.25) * dt
    sample(T_CLOSED + progressCurrent * (T_OPEN - T_CLOSED))

    /* Камера-зум: нелинейная кривая — начало как было (модель крупная),
       дальше камера быстро отъезжает и в конце стоит чуть дальше базовой
       дистанции, чтобы раскрытая модель не обрезалась краями кадра. */
    if (camera) {
      const zoom = ZOOM_CLOSE + (ZOOM_FAR - ZOOM_CLOSE) * Math.pow(progressCurrent, ZOOM_CURVE)
      camera.position.set(0, 0, distOpen * zoom)
      camera.lookAt(0, 0, 0)
    }

    if (renderer && scene && camera) renderer.render(scene, camera)
  }
  animate()
}

function stopLoop() {
  if (animFrame) cancelAnimationFrame(animFrame)
  animFrame = 0
}

/* Общая часть показа: цепляет канвас к контейнеру, вешает слушатели и
   запускает рендер-цикл. Вызывается и после полной загрузки (mount), и при
   повторном показе из кэша (restore) — поведение одинаковое. */
function attachViewer() {
  if (!container.value || !renderer) return
  /* В пути полной загрузки (mount) канвас ещё не присвоен — берём его из
     рендерера; в пути из кэша (restore) он уже восстановлен. */
  canvasEl ??= renderer.domElement
  if (!canvasEl) return

  heroEl = container.value.closest('.home-hero')

  container.value.appendChild(canvasEl)
  /* На тач-устройствах вертикальный свайп по модели скроллит страницу
     (touch-action: pan-y), горизонтальный — вращает модель. Общая логика
     для всех вьюверов — utils/touchScroll. */
  applyTouchScrollPolicy(canvasEl)
  /* Ручное вращение модели перетаскиванием. */
  canvasEl.addEventListener('pointerdown', onPointerDown)
  canvasEl.addEventListener('pointermove', onPointerMove)
  canvasEl.addEventListener('pointerup', onPointerUp)
  canvasEl.addEventListener('pointercancel', onPointerUp)

  resize()
  resizeObs = new ResizeObserver(resize)
  resizeObs.observe(container.value)

  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  progressCurrent = progressTarget
  progress.value = progressCurrent

  markReady()
  startLoop()
}

/* Снимает канвас с DOM и гасит слушатели, но НЕ выгружает вьювер: он
   остаётся в кэше (utils/glukeLogo3dCache) до конца сессии — при следующем
   показе (смена языка, возврат на главную) цепляется без перезагрузки. */
function detachViewer() {
  stopLoop()
  resizeObs?.disconnect()
  resizeObs = undefined
  window.removeEventListener('scroll', onScroll)
  if (canvasEl) {
    canvasEl.removeEventListener('pointerdown', onPointerDown)
    canvasEl.removeEventListener('pointermove', onPointerMove)
    canvasEl.removeEventListener('pointerup', onPointerUp)
    canvasEl.removeEventListener('pointercancel', onPointerUp)
    if (canvasEl.parentElement === container.value) {
      canvasEl.remove()
    }
  }
}

/* Повторный показ: вьювер уже загружен (смена языка / возврат на главную) —
   достаём из кэша и цепляем канвас сразу. Отложенный старт не нужен: грузить
   нечего, канвас появляется без моргания. Поза модели (поворот/наклон) уже
   живёт в самом pivot — восстанавливать ничего не нужно. */
function restore() {
  const cached = getGlukeViewer()
  if (!cached || !container.value) return

  renderer = cached.renderer
  scene = cached.scene
  camera = cached.camera
  pivot = cached.pivot
  tiltPivot = cached.tiltPivot
  mixer = cached.mixer
  action = cached.action
  fitOpen = cached.fitOpen
  canvasEl = cached.canvas

  attachViewer()
}

async function mount() {
  if (!container.value || disposed) return

  try {
    const THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')

    if (disposed || !container.value) return

    const w = container.value.clientWidth || 600
    const h = container.value.clientHeight || 300

    /* ── Renderer ──────────────────────────────────────────────────────── */
    const rendererInstance = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    /* DPR-потолок ниже на мобильных: 2× на маленьком экране — вчетверо больше
       пикселей, чем нужно, а модель на телефоне занимает ~пол-экрана. */
    const dprCap = window.innerWidth < 1024 ? 1.5 : 2
    rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio, dprCap))
    rendererInstance.setSize(w, h)
    rendererInstance.outputColorSpace = THREE.SRGBColorSpace
    rendererInstance.toneMapping = THREE.ACESFilmicToneMapping
    rendererInstance.toneMappingExposure = 1.05

    /* ── Scene ─────────────────────────────────────────────────────────── */
    const sceneInstance = new THREE.Scene()

    const pmrem = new THREE.PMREMGenerator(rendererInstance)
    sceneInstance.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    sceneInstance.environmentIntensity = 0.6

    /* Студийный свет, как в референсе: ключевой + контровой + заливочный. */
    const key = new THREE.DirectionalLight(0xffffff, 2.6)
    key.position.set(4, 6, 6)
    sceneInstance.add(key)

    const rim = new THREE.DirectionalLight(0x88aaff, 1.7)
    rim.position.set(-6, 2, -5)
    sceneInstance.add(rim)

    const fill = new THREE.DirectionalLight(0xffffff, 0.7)
    fill.position.set(0, -5, 3)
    sceneInstance.add(fill)

    /* ── Camera ────────────────────────────────────────────────────────── */
    const cameraInstance = new THREE.PerspectiveCamera(35, w / h, 1, 20000)
    cameraInstance.position.set(0, 0, 5)
    cameraInstance.lookAt(0, 0, 0)

    /* ── Tilt pivot: наклон модели (вокруг мировой оси X, ±15°) ───────── */
    const tiltPivotInstance = new THREE.Group()
    sceneInstance.add(tiltPivotInstance)

    /* ── Pivot: крутится вокруг собственной оси модели ────────────────── */
    const pivotInstance = new THREE.Group()
    tiltPivotInstance.add(pivotInstance)

    /* Инстансы присваиваем до кадрирования: measure()/sample() требуют
       готовых pivot/camera, иначе камера останется в начале координат
       (внутри модели), а MARGIN не будет работать. */
    renderer = rendererInstance
    scene = sceneInstance
    camera = cameraInstance
    pivot = pivotInstance
    tiltPivot = tiltPivotInstance

    /* ── Load GLB ──────────────────────────────────────────────────────── */
    const draco = new DRACOLoader()
    /* Без setDecoderPath: three 0.185 сам эмитит декодер (wasm + wrapper)
       через new URL(..., import.meta.url) — Vite кладёт их в /_nuxt/.
       Явный путь '/draco/' создавал дубль: грузились и Vite-копии (703KB),
       и статика public/draco (279KB wasm + wrapper). */

    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)

    const gltf = await loader.loadAsync(props.src)
    draco.dispose()

    if (disposed || !container.value) {
      rendererInstance.dispose()
      return
    }

    const modelInstance = gltf.scene
    pivotInstance.add(modelInstance)

    const mixerInstance = new THREE.AnimationMixer(modelInstance)
    const clip = gltf.animations[0]
    if (clip) {
      const actionInstance = mixerInstance.clipAction(clip)
      actionInstance.play()
      /* Время двигаем сами по прогрессу скролла: timeScale = 0 не даёт
         клипу прокручиваться, mixer.update(0) применяет нужный кадр. */
      actionInstance.timeScale = 0
      actionInstance.time = 0
      action = actionInstance
      mixer = mixerInstance
    }

    /* Центрируем модель на собранных границах: ось вращения pivot проходит
       через центр модели. */
    sample(T_CLOSED)
    const center = new THREE.Box3().setFromObject(modelInstance).getCenter(new THREE.Vector3())
    modelInstance.position.sub(center)

    /* Кадрируем камеру один раз — по полностью раскрытому состоянию. */
    fitOpen = measure(T_OPEN, THREE)

    /* Восстанавливаем позу модели (поворот/наклон) после смены языка:
       вьювер пересоздаётся с нуля, но модель должна остаться в том же
       положении, в котором её оставил пользователь. Кадрирование выше
       посчитано по канонической ориентации — восстановление после него
       не влияет на дистанцию камеры. Прогресс раскрытия не трогаем: он
       сам выводится из позиции скролла, которую сохраняет роутер. */
    const pose = getViewerPose(props.src)
    if (pose) {
      pivotInstance.rotation.y = pose.rotationY ?? 0
      tiltPivotInstance.rotation.x = pose.tiltX ?? 0
    }

    /* ── Start ─────────────────────────────────────────────────────────── */
    /* Кэшируем готовый вьювер до цепляния канваса: смена языка перемонтирует
       компонент, и повторный показ подхватит ту же модель без перезагрузки
       GLB и без чёрного моргания. */
    setGlukeViewer({
      renderer: rendererInstance,
      scene: sceneInstance,
      camera: cameraInstance,
      pivot: pivotInstance,
      tiltPivot: tiltPivotInstance,
      mixer,
      action,
      fitOpen,
      canvas: rendererInstance.domElement,
    })

    attachViewer()
  }
  catch (err) {
    if (!disposed) {
      status.value = 'error'
      console.error('[GlukeLogo3D]', err)
    }
  }
}

onMounted(() => {
  /* Вьювер уже загружен (смена языка, возврат на главную) — показываем
     сразу, без отложенного старта: канвас цепляется мгновенно, модель не
     моргает. */
  if (getGlukeViewer()) {
    restore()
    return
  }
  /* Первый показ: вьювер стартует в простой браузера — текст героя и LCP
     рендерятся без конкуренции за главный поток. requestIdleCallback — где
     есть; иначе setTimeout с тем же таймаутом. */
  if ('requestIdleCallback' in window) {
    idleId = window.requestIdleCallback(mount, { timeout: IDLE_TIMEOUT })
  }
  else {
    /* setTimeout напрямую: после проверки `in` TS сужает window до never. */
    idleId = setTimeout(mount, IDLE_TIMEOUT)
  }
})

onBeforeUnmount(() => {
  /* Отменяем отложенный старт, если вьювер ещё не инициализировался. */
  if (idleId !== null) {
    if ('requestIdleCallback' in window) window.cancelIdleCallback(idleId)
    else clearTimeout(idleId)
    idleId = null
  }

  /* Сохраняем позу модели перед размонтированием (смена языка/навигация),
     чтобы при следующем показе модель не «прыгала» в исходный ракурс.
     Сохраняем только когда вьювер реально загрузился (pivot создан) —
     иначе размонтирование во время загрузки затёрло бы прошлую позу
     пустыми значениями. */
  if (pivot) {
    saveViewerPose(props.src, {
      rotationY: pivot.rotation.y,
      tiltX: tiltPivot?.rotation.x,
    })
  }
  disposed = true
  /* Вьювер не выгружаем — он живёт в кэше (utils/glukeLogo3dCache) до конца
     сессии: смена языка / возврат на главную покажут ту же модель без
     перезагрузки. Снимаем только канвас, слушатели и рендер-цикл. */
  detachViewer()
})
</script>

<template>
  <div
    ref="container"
    class="gluke-3d"
    :class="{ 'gluke-3d--ready': status === 'ready' }"
    role="img"
    aria-label="3D model of a radial pneumatic engine"
    :aria-busy="status === 'loading'"
    :data-progress="progress.toFixed(3)"
  >
    <div
      v-if="status === 'loading'"
      class="gluke-3d__loader"
    >
      <span
        class="gluke-3d__spinner"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
.gluke-3d {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

/* На мобильном модель занимает заметную часть экрана под текстом. */
@media (max-width: 1023px) {
  .gluke-3d {
    height: clamp(320px, 52vh, 480px);
  }
}

.gluke-3d :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  /* Жест на модели вращает её, а не скроллит страницу. */
  touch-action: none;
  cursor: grab;
}

/* На тач-устройствах (телефоны/планшеты) вертикальный свайп по модели
   должен скроллить страницу, а не вращать модель: pan-y отдаёт вертикаль
   браузеру, горизонталь по-прежнему обрабатывает вьювер. */
@media (pointer: coarse) {
  .gluke-3d :deep(canvas) {
    touch-action: pan-y;
  }
}

.gluke-3d :deep(canvas:active) {
  cursor: grabbing;
}

.gluke-3d__loader {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gluke-3d__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--site-border, rgba(255, 255, 255, 0.15));
  border-top-color: var(--site-accent, #724C9D);
  border-radius: 50%;
  animation: gluke-spin 0.75s linear infinite;
}

@keyframes gluke-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
