<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type * as THREE from 'three'
import { viewerCache } from '~/utils/modelViewerCache'
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
   ＞1 оставляет зазор вокруг габаритного бокса. */
const FIT_FILL = 1.25
/* Зона рендеринга шире контейнера: канвас центрируется на контейнере, поэтому
   модель остаётся в том же месте, но её края выходят за рамку — «окна» не видно.
   На мобильных не масштабируем, чтобы не вылезать за вьюпорт. */
const CANVAS_SCALE = 1.8

let viewer: CachedViewer | undefined = cachedViewer
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let animationFrame = 0
/* Накопленное время активного рендера: пауза вне вьюпорта не сбивает
   фазу пульсации эмишн-материалов. */
let accumulatedMs = 0
let lastFrameAt = 0
/* Лимит кадров 30fps в покое: автоповорот медленный, 60fps не видно,
   но каждый кадр — работа главного потока на слабых устройствах. */
let lastRenderAt = 0
const FRAME_INTERVAL = 1000 / 30
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
    /* В покое рендерим не чаще 30fps (автоповорот плавный и на 30);
       при ручном вращении — каждый кадр, чтобы инерция не дёргалась. */
    if (!userDragging && now - lastRenderAt < FRAME_INTERVAL) return
    lastRenderAt = now

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
    /* DPR-потолок ниже на мобильных: 2× на маленьком экране — вчетверо больше
       пикселей, чем нужно, а модель на телефоне занимает ~пол-экрана. */
    const dprCap = window.innerWidth < 1024 ? 1.5 : 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap))
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
       уровень чёрного через canvas: тёмные участки → тёмно-серые, светлые
       (логотип) почти не меняются. Сила подъёма — из настроек модели (diffuseLift). */
    const DIFFUSE_LIFT = props.diffuseLift ?? 30

    const liftDiffuseTexture = (texture: THREE.Texture): THREE.Texture => {
      const image = texture.image as HTMLImageElement | ImageBitmap
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return texture
      ctx.drawImage(image, 0, 0)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data
      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const v = data[i + c] ?? 0
          data[i + c] = Math.round(v + DIFFUSE_LIFT * (1 - v / 255))
        }
      }
      ctx.putImageData(imgData, 0, 0)
      const newTex = new THREE.CanvasTexture(canvas)
      newTex.colorSpace = THREE.SRGBColorSpace
      newTex.flipY = texture.flipY
      newTex.wrapS = texture.wrapS
      newTex.wrapT = texture.wrapT
      newTex.anisotropy = texture.anisotropy
      texture.dispose()
      return newTex
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
        if (standard.map) {
          standard.map = liftDiffuseTexture(standard.map)
          standard.map.needsUpdate = true
          standard.needsUpdate = true
        }
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

onMounted(() => {
  /* Вьювер стартует в простой браузера: постер и текст рендерятся без
     конкуренции за главный поток. requestIdleCallback — где есть; иначе
     setTimeout с тем же таймаутом. */
  if ('requestIdleCallback' in window) {
    idleId = window.requestIdleCallback(mountViewer, { timeout: IDLE_TIMEOUT })
  }
  else {
    /* setTimeout напрямую: после проверки `in` TS сужает window до never. */
    idleId = setTimeout(mountViewer, IDLE_TIMEOUT)
  }
})
onBeforeUnmount(() => {
  /* Отменяем отложенный старт, если вьювер ещё не инициализировался. */
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

.model-viewer--ready :deep(canvas):active {
  cursor: grabbing;
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
