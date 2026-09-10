<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from '~/utils/demoWidgetCache'
import { CONSTELLATION_THEME_COLORS, ENERGY_FILL_THEME_LOOK, IMAGE_PARTICLES_THEME_LOOK, METABALLS_THEME_LOOK, PARTICLES_THEME_LOOK, PYRAMID_THEME_LOOK } from '~/utils/widgetThemeLook'

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
    else if (widget.value === 'metaballs') {
      const { default: GlukeMetaballs } = await import('~/utils/gluke-metaballs.js')
      created = GlukeMetaballs.create(el, {
        ...(props.demo.params as Record<string, unknown>),
        ...METABALLS_THEME_LOOK[isLight.value ? 'light' : 'dark'],
        /* Как и у остальных карточек: курсор не ловим, иначе все превью
           разом начнут следить за указателем. Каплю-курсор тоже гасим. */
        cursorLava: 0,
        pointer: false,
        ratioCap: 1.5,
        pixelBudget: 1.5e6,
        pauseOffscreen: true,
        respectReducedMotion: true,
      }) as DemoInstance
    }
    else if (widget.value === 'image-particles') {
      const { default: GlukeImageParticles } = await import('~/utils/gluke-image-particles.js')
      created = GlukeImageParticles.create(el, {
        ...(props.demo.params as Record<string, unknown>),
        ...IMAGE_PARTICLES_THEME_LOOK[isLight.value ? 'light' : 'dark'],
        src: props.demo.src,
        /* Карточка — превью: плотность поменьше, курсор не ловим. */
        density: Math.max(1, ((props.demo.params as Record<string, number> | undefined)?.density ?? 1) + 1),
        pointer: false,
        ratioCap: 1.5,
        pixelBudget: 1.5e6,
        pauseOffscreen: true,
        respectReducedMotion: true,
      }) as DemoInstance
    }
    else if (widget.value === 'energy-fill') {
      const { default: GlukeEnergyFill } = await import('~/utils/gluke-energy-fill.js')
      /* Знак берётся тем же способом, что и в лаборатории: движок печёт карту
         прихода волны прямо из SVG, поэтому карточке нечего готовить заранее.
         `markPick`/`markAlt` — это выбор ползунка, движку они не нужны. */
      const params = { ...(props.demo.params as Record<string, unknown>) }
      const alt = typeof params.markAlt === 'string' ? params.markAlt : null
      const pick = Number(params.markPick ?? 0)
      delete params.markPick
      delete params.markAlt

      created = GlukeEnergyFill.create(el, {
        ...params,
        ...ENERGY_FILL_THEME_LOOK[isLight.value ? 'light' : 'dark'],
        mark: (pick > 0.5 && alt) ? alt : props.demo.logo,
        /* На карточке сцена всегда идёт по кругу и никогда не стоит на
           стоп-кадре: ползунки лаборатории сюда не относятся. */
        loop: 1,
        freeze: 0,
        ratioCap: 1.5,
        pixelBudget: 1.5e6,
        pauseOffscreen: true,
        respectReducedMotion: true,
      }) as DemoInstance
    }
    else if (widget.value === 'particles') {
      const { default: GlukeParticles } = await import('~/utils/gluke-particles.js')
      created = GlukeParticles.create(el, {
        ...(props.demo.params as Record<string, unknown>),
        ...PARTICLES_THEME_LOOK[isLight.value ? 'light' : 'dark'],
        model: props.demo.model,
        /* Карточка — превью: вращение идёт само, перетаскивание и
           глобальный ловец мыши не нужны (как у остальных карточек). */
        drag: false,
        ratioCap: 1.5,
        pixelBudget: 1.5e6,
        pauseOffscreen: true,
        respectReducedMotion: true,
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
  catch {
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
  }

  /* Observer живёт всё время, а не до первого запуска. Если виджет вытеснен
     из кэша (LRU при переполнении — MAX_INSTANCES в demoWidgetCache),
     destroy() удаляет его канвас и контекст, а карточка остаётся «живой»
     с пустым слоем. При возврате в зону видимости такой виджет
     пересоздаётся, иначе после прокрутки вниз и обратно часть превью
     пропадала бы. */
  observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return
    /* Рендер уже на месте — виджет жив, ничего не делаем. */
    if (host.value?.querySelector('canvas')) return
    /* Инстанс в кэше есть (смена языка) — boot() перецепит его. */
    if (getDemoWidget(cacheKey.value)) {
      void boot()
      return
    }
    /* Инстанса нет ни в host, ни в кэше — вытеснен. Сбрасываем флаг,
       чтобы boot() создал виджет заново. */
    if (booted) booted = false
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
  else if (widget.value === 'metaballs') {
    w.set(METABALLS_THEME_LOOK[isLight.value ? 'light' : 'dark'])
  }
  else if (widget.value === 'image-particles') {
    w.set(IMAGE_PARTICLES_THEME_LOOK[isLight.value ? 'light' : 'dark'])
  }
  else if (widget.value === 'particles') {
    w.set(PARTICLES_THEME_LOOK[isLight.value ? 'light' : 'dark'])
  }
  else if (widget.value === 'energy-fill') {
    w.set(ENERGY_FILL_THEME_LOOK[isLight.value ? 'light' : 'dark'])
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
