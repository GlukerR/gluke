<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from '~/utils/demoWidgetCache'
import { CONSTELLATION_THEME_COLORS, PYRAMID_THEME_LOOK } from '~/utils/widgetThemeLook'

/* Живое превью на карточке кейса: у проектов с demo-виджетом (призма,
   звёздное поле) вместо статичной обложки после простоя страницы
   запускается настоящий WebGL-рендер. Обложка остаётся под слоем как фолбэк —
   она видна, пока виджет не ожил, и навсегда при «уменьшить движение» или без
   WebGL. Внешний вид приводится к теме сайта (тот же widgetThemeLook, что на
   кейсе), чтобы превью на карточке не отличалось от виджета в самом кейсе. */

const props = defineProps<{
  demo: NonNullable<ProjectsCollectionItem['demo']>
}>()

interface DemoInstance {
  start: () => void
  stop: () => void
  set: (patch: Record<string, unknown>) => void
  destroy: () => void
  /* Перекраска поля под тему без пересоздания точек (звёздное поле). */
  recolor?: (palette: string[], linkColor?: string, auraColor?: string, coreColor?: string) => void
  /* Перецепление между инстансами компонента (смена языка, переход между
     страницами): виджет живёт в demoWidgetCache до конца сессии. */
  detach: () => void
  reattach: (el: HTMLElement) => void
}

const host = ref<HTMLElement | null>(null)
const live = ref(false)

const colorMode = useColorMode()
const isLight = computed(() => colorMode.value === 'light')

let instance: DemoInstance | null = null
let observer: IntersectionObserver | null = null
let disposed = false
let booted = false

const widget = computed(() => props.demo.widget)

/* Ключ кэша: тип виджета + вариант `card`. На карточках виджет не должен
   конкурировать с инстансами кейса (hero/bleed/tunable) — у них свои ключи,
   а при смене языка карточка перецепляет сохранённый канвас, а не создаёт
   виджет заново. */
const cacheKey = computed(() => demoWidgetKey(props.demo.widget, 'card'))

/* Всё, что мешает живому превью: системное «уменьшить движение» — виджет
   остаётся статичной обложкой (позже он всё равно замрёт внутри), отсутствие
   WebGL отловит сам create. Тач-экран не мешает: призма и поле просто не
   получают pointer-события (слой pointer-events: none), а вращение/дрейф
   идут сами по себе. */
function supportedOnThisDevice(): boolean {
  if (import.meta.server) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

/* Карточка должна оживать не сразу после гидрации, а когда страница уже
   отдохнула: ждём полной загрузки документа и следующего idle-слота. */
function whenReady(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') return resolve()
    const done = () => resolve()
    window.addEventListener('load', done, { once: true })
    /* Страховка для клиентских переходов: load мог уже не выстрелить. */
    setTimeout(done, 4000)
  })
}

function whenIdle(): Promise<void> {
  const ric = window.requestIdleCallback
  if (ric) {
    return new Promise(resolve => ric(() => resolve(), { timeout: 1500 }))
  }
  return new Promise(resolve => setTimeout(resolve, 300))
}

async function boot() {
  if (disposed || booted || !host.value) return
  booted = true

  /* Виджет уже создавался (смена языка, возврат на страницу) — цепляем
     сохранённый канвас сразу, без пересоздания WebGL и повторной загрузки
     логотипов. Показ слоя — те же два кадра, чтобы не мелькнул градиент. */
  const cached = getDemoWidget<DemoInstance>(cacheKey.value)
  if (cached) {
    instance = cached
    cached.reattach(host.value)
    applyTheme(cached)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!disposed) live.value = true
      })
    })
    return
  }

  try {
    const el = host.value
    let created: DemoInstance | null = null

    if (widget.value === 'pyramid') {
      const { default: GlukePyramid } = await import('~/utils/gluke-pyramid.js')
      created = GlukePyramid.create(el, {
        ...(props.demo.params as Record<string, unknown>),
        ...PYRAMID_THEME_LOOK[isLight.value ? 'light' : 'dark'],
        /* На карточке курсор не нужен: вращение из параметров идёт само,
           а глобальный ловец мыши заставил бы все карточки разом следить
           за указателем. */
        marks: props.demo.logo ? [props.demo.logo, props.demo.logo, props.demo.logo, props.demo.logo] : [],
        ratioCap: 1.5,
        pixelBudget: 1.5e6,
        pointer: false,
        pointerFrom: 'self',
        pauseOffscreen: true,
        respectReducedMotion: true,
      }) as DemoInstance
    }
    else if (widget.value === 'constellation') {
      const { default: Constellation } = await import('~/utils/constellation.js')
      created = Constellation.create(el, {
        ...(props.demo.params as Record<string, unknown>),
        ...CONSTELLATION_THEME_COLORS[isLight.value ? 'light' : 'dark'],
        pointer: false,
        dprCap: 1.5,
        pauseOffscreen: true,
        honorReducedMotion: true,
      }) as DemoInstance
    }

    if (!created || disposed) return
    instance = created
    /* Кэшируем сразу: следующий показ (смена языка) перецепит тот же виджет
       вместо пересоздания. */
    setDemoWidget(cacheKey.value, created)
    created.start?.()

    /* Показываем слой только после первого кадра, иначе мелькнёт пустой
       градиент до того, как WebGL что-нибудь нарисует. */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!disposed) live.value = true
      })
    })
  }
  catch (error) {
    /* WebGL недоступен или модуль упал — остаётся обложка. Не логаем как
       ошибку: это ожидаемый фолбэк, а не поломка страницы. */
    booted = false
  }
}

onMounted(() => {
  if (!supportedOnThisDevice()) return
  const el = host.value
  if (!el) return

  /* Кэшированный виджет (смена языка) цепляем сразу: канвас уже готов,
     ждать простоя страницы незачем, карточка оживает без моргания обложки. */
  if (getDemoWidget(cacheKey.value)) {
    void boot()
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return
    observer?.disconnect()
    observer = null
    /* Дождались и простоя, и близости карточки к экрану. */
    whenReady()
      .then(whenIdle)
      .then(boot)
  }, { rootMargin: '320px 0px' })

  observer.observe(el)
})

/* Тема сайта поменялась — перекрашиваем виджет на карточке так же, как на
   кейсе: призма через set() (палитра/свечение), звёзды через recolor(). */
function applyTheme(w: DemoInstance): void {
  if (widget.value === 'pyramid') {
    w.set(PYRAMID_THEME_LOOK[isLight.value ? 'light' : 'dark'])
  }
  else if (widget.value === 'constellation' && w.recolor) {
    const c = CONSTELLATION_THEME_COLORS[isLight.value ? 'light' : 'dark']
    w.recolor(c.palette, c.linkColor, c.auraColor, c.coreColor)
  }
}

watch(isLight, () => {
  if (instance) applyTheme(instance)
})

onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  observer = null
  /* Виджет не уничтожаем — отцепляем и оставляем в кэше (demoWidgetCache):
     смена языка/переход между страницами перецепит канвас без пересоздания. */
  instance?.detach()
  instance = null
})
</script>

<template>
  <div
    class="project-card-demo"
    :class="{ 'project-card-demo--live': live }"
    aria-hidden="true"
  >
    <div
      ref="host"
      class="project-card-demo__host"
    />
  </div>
</template>

<style scoped>
/* Слой поверх обложки: пока виджет не запущен, он прозрачен и обложка
   читается как обычно. Когда рендер ожил — проявляется только канвас, без
   собственной подложки: фон даёт сама страница, как и на кейсе. */
.project-card-demo {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  border-radius: inherit;
  background: transparent;
  transition: opacity 500ms ease;
}

.project-card-demo--live {
  opacity: 1;
}

.project-card-demo__host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
