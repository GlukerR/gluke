<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from '~/utils/demoWidgetCache'
import { CONSTELLATION_THEME_COLORS } from '~/utils/widgetThemeLook'

type ConstellationParams = Record<string, unknown>

/* Вид будет самовозникать: компонент умеет перекрашивать поле под тему сайта,
   не пересоздавая точки (recolor), поэтому интерфейс дополнен методом recolor. */
interface ConstellationInstance {
  set: (patch: ConstellationParams) => void
  stop: () => void
  start: () => void
  destroy: () => void
  /* Перекраска без пересоздания точек: те же звёзды на своих местах, другой
     цвет палитры/нитей/планеты. Нужен при смене темы сайта. */
  recolor: (palette: string[], linkColor?: string, auraColor?: string, coreColor?: string) => void
  /* Перецепление между инстансами компонента (смена языка): виджет живёт
     в demoWidgetCache до конца сессии, detach снимает канвас, reattach
     вешает его на новый контейнер без пересоздания WebGL и без
     «перемешивания» звёзд. */
  detach: () => void
  reattach: (el: HTMLElement) => void
}

const props = defineProps<{
  demo: NonNullable<ProjectsCollectionItem['demo']>
  /** Обложка кейса: показывается, пока виджет не запустился, и остаётся
      навсегда, если WebGL недоступен или включено «уменьшить движение». */
  poster: string
  posterAlt: string
  /** `hero` — чистое поле в шапке, `tunable` — лаборатория: поле + ползунки
      + копирование JSON, `bleed` — поле на весь hero-блок. */
  variant?: 'hero' | 'tunable' | 'bleed'
}>()

const { t } = useI18n()

/* Тема сайта определяет цвета поля (палитра, нити, планета) и подложку сцены.
   Поле живёт прямо на фоне сайта, своего тёмного экрана у него больше нет. */
const colorMode = useColorMode()
const isLight = computed(() => colorMode.value === 'light')
const themeColors = computed(() => CONSTELLATION_THEME_COLORS[isLight.value ? 'light' : 'dark'])

const host = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const stageArea = ref({ w: 0, h: 0 })
const widget = shallowRef<ConstellationInstance | null>(null)
const running = ref(false)
const failed = ref(false)
const copied = ref(false)

/* Ключ кэша: тип виджета + вариант размещения. При смене языка компонент
   перемонтируется, и виджет перецепляется из demoWidgetCache, а не создаётся
   заново (иначе поле «перемешивалось» бы — новые случайные звёзды). */
const cacheKey = computed(() => demoWidgetKey(props.demo.widget, props.variant ?? 'hero'))

/* Ползунки — зеркало API виджета (`~/utils/constellation.js`), диапазоны из
   его дефолтов: ползунок показывает ровно то, что работает на экране. */
const GROUPS = [
  {
    id: 'stars',
    controls: [
      { key: 'countMult', min: 0.1, max: 8, step: 0.05 },
      { key: 'size', min: 0.4, max: 10, step: 0.1 },
      { key: 'sizeSpread', min: 0, max: 4, step: 0.05 },
      { key: 'twinkle', min: 0, max: 4, step: 0.05 },
    ],
  },
  {
    id: 'motion',
    controls: [
      { key: 'drift', min: 0, max: 4, step: 0.05 },
      { key: 'wander', min: 0, max: 4, step: 0.05 },
      { key: 'speedSpread', min: 0, max: 5, step: 0.05 },
    ],
  },
  {
    id: 'links',
    controls: [
      { key: 'linkDist', min: 0.2, max: 4, step: 0.02 },
      { key: 'linkAlpha', min: 0, max: 2, step: 0.01 },
    ],
  },
  {
    id: 'cursor',
    controls: [
      { key: 'cursorRadius', min: 0.05, max: 1.4, step: 0.01 },
      { key: 'planetRadius', min: 0, max: 0.6, step: 0.01 },
      { key: 'cursorRepel', min: 0, max: 6, step: 0.05 },
      { key: 'cursorPull', min: 0, max: 6, step: 0.05 },
      { key: 'cursorObject', min: 0, max: 1, step: 1 },
    ],
  },
] as const

/* Дефолты повторяют `DEFAULTS` из `constellation.js`. Плотность — стандартный
   параметр для всех вариантов: число звёзд пропорционально площади поля,
   `countMult` лишь умножает стандарт. */
const DENSITY_STD = 6
const DENSITY_TILE = 100
const MIN_STARS = 30
const MAX_STARS = 2000

/* Дефолты — зеркало `DEFAULTS` из `constellation.js` (основной конфиг).
   Если в кейсе задан `demo.params`, он ложится поверх. */
const DEFAULT_PARAMS: Record<string, number> = {
  countMult: 1.35,
  size: 2.1,
  sizeSpread: 3.95,
  twinkle: 0.5,
  drift: 0.45,
  wander: 2,
  speedSpread: 3.25,
  linkDist: 1.48,
  linkAlpha: 0.1,
  cursorRadius: 0.32,
  planetRadius: 0.07,
  cursorRepel: 0.7,
  cursorPull: 0.25,
  cursorObject: 1,
}

const isTuner = computed(() => props.variant === 'tunable')

/* Настройки лаборатории живут только в памяти текущей сессии: подкрученные
   значения никуда не сохраняются, и после любого перезапуска страницы всё
   возвращается к дефолтам кейса. */
const tuned = reactive<Record<string, number>>({})

const themeParams = computed<ConstellationParams>(() => ({
  ...DEFAULT_PARAMS,
  ...(props.demo.params as ConstellationParams),
}))

/* Конфиг лаборатории включает подкрученные значения; hero/bleed-варианты
   всегда используют только дефолты кейса — из лаборатории ничего не
   переходит в шапку, даже в рамках одной сессии. */
function buildConfig(): Record<string, unknown> {
  return {
    density: DENSITY_STD,
    densityTile: DENSITY_TILE,
    ...themeParams.value,
    ...(isTuner.value ? tuned : {}),
  }
}

function readInitial(key: string): number {
  return Number(themeParams.value[key] ?? DEFAULT_PARAMS[key] ?? 0)
}

/* Чанк виджета (константейнер + шейдеры, ~11 КБ gzip) начинаем качать сразу,
   как только исполнился модуль компонента, а не в onMounted: на верхнем hero
   это убирает лишний сетевой хоп после гидрации — поле появляется, как только
   чанк доехал. В SSR промис не заводим (import.meta.client = false). */
type ConstellationModule = typeof import('~/utils/constellation.js')
const constellationModule: Promise<ConstellationModule> | null = import.meta.client
  ? import('~/utils/constellation.js')
  : null

async function mount() {
  const el = host.value
  if (!el) return

  /* Уважаем системную настройку и отсутствие WebGL: в обоих случаях на месте
     виджета остаётся обложка (в полноформатном hero её нет — там фон темы). */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  if (!constellationModule) return

  /* Виджет уже создавался (смена языка, возврат на кейс) — перецепляем
     сохранённый канвас: те же звёзды с их позициями и курсами, без
     пересоздания WebGL и без «перемешивания» поля. Конфиг намеренно не
     переприменяем: set() с countMult/size пересоздал бы массив точек,
     а инстанс и так помнит свои параметры (у лаборатории — только текущей
     сессии). Цвета темы всё же приводим к актуальной — recolor
     не трогает позиции. */
  const cached = getDemoWidget<ConstellationInstance>(cacheKey.value)
  if (cached) {
    widget.value = cached
    cached.reattach(el)
    applyThemeColors(cached)
    running.value = true
    return
  }

  try {
    const { default: Constellation } = await constellationModule
    const instance = Constellation.create(el, {
      ...buildConfig(),
      ...themeColors.value,
    }) as ConstellationInstance
    instance.start()
    widget.value = instance
    /* Кэшируем сразу: смена языка перемонтирует компонент, и следующий
       показ перецепит тот же виджет без перезагрузки. */
    setDemoWidget(cacheKey.value, instance)
    running.value = true
  }
  catch (error) {
    failed.value = true
    console.error('[constellation] не удалось запустить виджет', error)
  }
}

/* Перекрасить поле под текущую тему сайта: те же позиции, другой цвет. */
function applyThemeColors(instance: ConstellationInstance) {
  const c = themeColors.value
  instance.recolor(c.palette, c.linkColor, c.auraColor, c.coreColor)
}

watch(tuned, () => {
  /* Ползунки есть только у лаборатории: подкрутка меняет её собственное
     поле и никуда не сохраняется. Hero/bleed обновлять нечего — они живут
     на дефолтах и в кэше лежат отдельным ключом. */
  if (isTuner.value) widget.value?.set(buildConfig())
}, { deep: true })

/* Число звёзд при текущей площади сцены: стандарт × площадь ÷ опорный
   квадрат × множитель. Та же формула, что в виджете. */
const starEstimate = computed(() => {
  if (!isTuner.value) return null
  const area = stageArea.value.w * stageArea.value.h
  if (!area) return null
  const n = Math.round(area * (DENSITY_STD / (DENSITY_TILE * DENSITY_TILE)) * Number(tuned.countMult ?? DEFAULT_PARAMS.countMult))
  return Math.max(MIN_STARS, Math.min(MAX_STARS, n))
})

const jsonOut = computed(() => JSON.stringify(buildConfig(), null, 2))

function reset() {
  /* Ключи чистим через Reflect, а не delete по вычисляемому ключу:
     значения по умолчанию всё равно подставляет buildConfig(). */
  for (const key of Object.keys(tuned)) Reflect.deleteProperty(tuned, key)
  widget.value?.set(buildConfig())
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonOut.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  }
  catch {
    /* clipboard недоступен — текст лежит в блоке под панелью */
    copied.value = false
  }
}

/* Смена темы сайта: палитра, цвет нитей и планеты перекрашиваются на лету
   (recolor не пересоздаёт точки — поле не «перемешивается»). */
watch(isLight, () => {
  if (widget.value) applyThemeColors(widget.value)
})

onMounted(() => {
  mount()
  if (isTuner.value && stageEl.value && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      const r = stageEl.value?.getBoundingClientRect()
      stageArea.value = r ? { w: r.width, h: r.height } : { w: 0, h: 0 }
    })
    ro.observe(stageEl.value)
    const r = stageEl.value.getBoundingClientRect()
    stageArea.value = { w: r.width, h: r.height }
  }
})

onBeforeUnmount(() => {
  /* Виджет не уничтожаем — отцепляем и оставляем в кэше (demoWidgetCache):
     смена языка перемонтирует компонент, и следующий показ перецепит тот же
     канвас без пересоздания WebGL и без «перемешивания» звёзд. */
  widget.value?.detach()
  widget.value = null
})
</script>

<template>
  <div
    class="constellation-demo"
    :class="[`constellation-demo--${props.variant ?? 'hero'}`, { 'constellation-demo--live': running }]"
  >
    <div
      ref="stageEl"
      class="constellation-demo__stage"
    >
      <!-- Полноформатный hero: постер-картинки здесь нет намеренно — генеративная
           заставка выглядит дешевле живого поля и не передаёт его вид, поэтому
           верх ждёт пару кадров реального WebGL. Узкие варианты
           (hero-карточка, лаборатория) оставляют обложку как фолбэк — там она
           за кадром не режет глаз. -->
      <NuxtImg
        v-if="props.variant !== 'bleed'"
        :src="props.poster"
        :alt="props.posterAlt"
        sizes="100vw lg:58vw xl:1000px"
        format="avif,webp"
        loading="eager"
        decoding="async"
        class="constellation-demo__poster"
      />
      <div
        ref="host"
        class="constellation-demo__canvas"
        :aria-label="props.demo.alt"
        role="img"
      />
    </div>

    <div
      v-if="props.variant === 'tunable' && running"
      class="constellation-demo__controls"
    >
      <div class="constellation-demo__controls-head">
        <h3 class="text-heading text-heading--sm">
          {{ t('project.demo.title') }}
        </h3>
        <button
          type="button"
          class="text-body--sm constellation-demo__reset"
          @click="reset"
        >
          {{ t('project.demo.reset') }}
        </button>
      </div>

      <p class="text-body--sm constellation-demo__hint">
        {{ t('project.demo.hint') }}
      </p>

      <p
        v-if="starEstimate !== null"
        class="text-body--sm constellation-demo__estimate"
      >
        {{ t('project.demo.estimate', { n: String(starEstimate) }) }}
      </p>

      <div class="constellation-demo__groups">
        <div
          v-for="group in GROUPS"
          :key="group.id"
          class="constellation-demo__group"
        >
          <h4 class="text-label constellation-demo__group-name">
            {{ t(`project.demo.groups.${group.id}`) }}
          </h4>

          <label
            v-for="control in group.controls"
            :key="control.key"
            class="constellation-demo__slider"
          >
            <span class="text-body--sm constellation-demo__slider-name">
              {{ t(`project.demo.controls.${control.key}`) }}
            </span>
            <input
              :value="tuned[control.key] ?? readInitial(control.key)"
              type="range"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              class="constellation-demo__range"
              @input="tuned[control.key] = Number(($event.target as HTMLInputElement).value)"
            >
            <span class="text-body--sm constellation-demo__slider-value">
              {{ (tuned[control.key] ?? readInitial(control.key)).toFixed(2) }}
            </span>
          </label>
        </div>
      </div>

      <div class="constellation-demo__actions">
        <button
          type="button"
          class="text-body--sm constellation-demo__copy"
          @click="copyJson"
        >
          {{ copied ? t('project.demo.copied') : t('project.demo.copy') }}
        </button>
      </div>

      <details class="constellation-demo__json">
        <summary class="text-body--sm">
          JSON
        </summary>
        <pre class="constellation-demo__json-pre">{{ jsonOut }}</pre>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Сцена живёт на фоне сайта, а не на собственном тёмном экране: тема меняет
   подложку (палитра поля перекрашивается через recolor), поэтому у блока
   нет фиксированного градиента. Скругление остаётся у компактных карточек,
   в полноэкранном режиме оно снимается. */
.constellation-demo__stage {
  position: relative;
  border-radius: var(--site-radius-lg);
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

/* Полноразмерный режим: канвас заполняет hero целиком и работает фоном,
   а не карточкой с собственным соотношением сторон. Рамку и скругление
   убираем — блок должен сливаться с hero-подложкой. */
.constellation-demo--bleed {
  position: absolute;
  inset: 0;
}

.constellation-demo--bleed .constellation-demo__stage {
  position: absolute;
  inset: 0;
  aspect-ratio: auto;
  border-radius: 0;
}

.constellation-demo--bleed .constellation-demo__poster {
  object-fit: cover;
}

.constellation-demo--bleed .constellation-demo__controls {
  display: none;
}

.constellation-demo__poster,
.constellation-demo__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.constellation-demo__poster {
  object-fit: cover;
  transition: opacity 400ms ease;
}

/* Когда виджет ожил, обложка уходит — но остаётся в разметке как фон на случай
   потери контекста WebGL. */
.constellation-demo--live .constellation-demo__poster {
  opacity: 0;
}

.constellation-demo__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-block-start: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.constellation-demo__controls-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.constellation-demo__reset,
.constellation-demo__copy {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.constellation-demo__reset:hover,
.constellation-demo__copy:hover {
  color: var(--site-accent-text-hover);
}

.constellation-demo__hint,
.constellation-demo__estimate {
  max-width: 62ch;
  color: var(--site-text-secondary);
}

.constellation-demo__estimate {
  color: var(--site-text);
}

.constellation-demo__groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(20px, 2.4vw, 32px);
}

.constellation-demo__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.constellation-demo__group-name {
  padding-block-end: 6px;
  border-bottom: var(--site-border);
  color: var(--site-text-secondary);
}

.constellation-demo__slider {
  display: grid;
  /* Колонка имени шире, чем у призмы: русские подписи длиннее ключей API
     (`Разброс размеров` против `sizeSpread`). Если совсем узко — имя
     переносится на две строки, ползунок при этом не сжимается в ноль. */
  grid-template-columns: minmax(0, 8rem) minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: 10px;
}

.constellation-demo__slider-name {
  color: var(--site-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.25;
}

.constellation-demo__slider-value {
  color: var(--site-text);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.constellation-demo__range {
  width: 100%;
  min-height: 44px;
  accent-color: var(--site-accent-text);
  cursor: pointer;
}

.constellation-demo__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-block-start: 4px;
}

.constellation-demo__json {
  border-top: var(--site-border);
  padding-block-start: 10px;
}

.constellation-demo__json summary {
  cursor: pointer;
  color: var(--site-text-secondary);
}

.constellation-demo__json-pre {
  margin-block-start: 10px;
  padding: 14px;
  border-radius: var(--site-radius-sm);
  background: var(--site-surface);
  border: var(--site-border);
  font-size: 0.75rem;
  line-height: 1.5;
  overflow: auto;
  max-height: 320px;
}

@media (pointer: fine) {
  .constellation-demo__range {
    min-height: 22px;
  }
}

@media (min-width: 768px) {
  .constellation-demo__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .constellation-demo--tunable {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(21rem, 24rem);
    align-items: start;
    gap: clamp(24px, 2.6vw, 40px);
  }

  .constellation-demo--tunable .constellation-demo__controls {
    margin-block-start: 0;
  }

  .constellation-demo--tunable .constellation-demo__groups {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .constellation-demo--tunable .constellation-demo__slider {
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 2.5rem;
    gap: 8px;
  }

  .constellation-demo--tunable .constellation-demo__hint {
    max-width: none;
  }
}
</style>
