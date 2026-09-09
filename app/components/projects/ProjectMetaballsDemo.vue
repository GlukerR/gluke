<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from '~/utils/demoWidgetCache'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'
import { METABALLS_THEME_LOOK } from '~/utils/widgetThemeLook'

type MetaballsParams = Record<string, unknown>

interface MetaballsInstance {
  set: (patch: MetaballsParams) => void
  stop: () => void
  start: () => void
  destroy: () => void
  /* Перецепление между инстансами компонента (смена языка): виджет живёт
     в demoWidgetCache до конца сессии, detach снимает канвас, reattach
     вешает его на новый контейнер без пересоздания WebGL. */
  detach: () => void
  reattach: (el: HTMLElement) => void
}

const props = defineProps<{
  demo: NonNullable<ProjectsCollectionItem['demo']>
  /** Обложка кейса: показывается, пока виджет не запустился, и остаётся
      навсегда, если WebGL недоступен или включено «уменьшить движение». */
  poster: string
  posterAlt: string
  /** `hero` — чистая лава в шапке, `tunable` — лаборатория: лава + ползунки
      + копирование JSON, `bleed` — лава на весь hero-блок. */
  variant?: 'hero' | 'tunable' | 'bleed'
}>()

const { t } = useI18n()

const host = ref<HTMLElement | null>(null)
const lava = shallowRef<MetaballsInstance | null>(null)
const running = ref(false)
const failed = ref(false)
const copied = ref(false)

/* Ключ кэша: тип виджета + вариант размещения. При смене языка компонент
   перемонтируется, и виджет перецепляется из demoWidgetCache, а не создаётся
   заново (иначе перекомпилируются шейдеры и «перемешиваются» капли). */
const cacheKey = computed(() => demoWidgetKey(props.demo.widget, props.variant ?? 'hero'))

/* Ползунки — зеркало API виджета (`~/utils/gluke-metaballs.js`), диапазоны
   из его дефолтов: ползунок показывает ровно то, что работает на экране.
   Фон не выносим — он берётся из темы сайта. */
const GROUPS = [
  {
    id: 'blobs',
    controls: [
      { key: 'count', min: 2, max: 14, step: 1 },
      { key: 'speed', min: 0, max: 2, step: 0.05 },
      { key: 'turbulence', min: 0, max: 2, step: 0.05 },
      { key: 'blobSize', min: 0.05, max: 0.22, step: 0.005 },
      { key: 'threshold', min: 0.2, max: 0.9, step: 0.01 },
    ],
  },
  {
    id: 'palette',
    controls: [
      { key: 'hue', min: 0, max: 1, step: 0.01 },
      { key: 'saturation', min: 0, max: 1.6, step: 0.05 },
      { key: 'glow', min: 0, max: 2.5, step: 0.05 },
      { key: 'gloss', min: 0, max: 1.5, step: 0.05 },
      { key: 'relief', min: 0, max: 4, step: 0.05 },
    ],
  },
  {
    id: 'cursor',
    controls: [
      { key: 'cursorLava', min: 0, max: 1, step: 1 },
      { key: 'cursorPullLava', min: 0, max: 1, step: 0.05 },
      { key: 'cursorPullRadius', min: 0, max: 1.5, step: 0.01 },
      { key: 'cursorSize', min: 0.5, max: 3, step: 0.05 },
    ],
  },
] as const

/* Дефолты повторяют `DEFAULTS` из `gluke-metaballs.js` (основной конфиг). */
const DEFAULT_PARAMS: Record<string, number> = {
  count: 6,
  speed: 0.7,
  turbulence: 0.5,
  blobSize: 0.11,
  threshold: 0.5,
  hue: 0.03,
  saturation: 1,
  glow: 1.1,
  gloss: 0.55,
  relief: 2,
  cursorLava: 1,
  cursorPullLava: 0.4,
  cursorPullRadius: 0.35,
  cursorSize: 1.3,
}

const STORAGE_KEY = 'gluke-metaballs-v4'

const isTuner = computed(() => props.variant === 'tunable')

const colorMode = useColorMode()
const isLight = computed(() => colorMode.value === 'light')

const tuned = reactive<Record<string, number>>({})

/* Сохранённые настройки лаборатории живут на кейсе под своим ключом.
   Ключ версионируется: при смене базовых параметров он бампается, чтобы
   старые сохранённые значения не подменяли новые дефолты. */
if (import.meta.client) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) Object.assign(tuned, JSON.parse(saved))
  }
  catch {
    /* битые данные — просто дефолты */
  }
}

const themeParams = computed<MetaballsParams>(() => ({
  ...DEFAULT_PARAMS,
  ...(props.demo.params as MetaballsParams),
  ...METABALLS_THEME_LOOK[isLight.value ? 'light' : 'dark'],
}))

function currentParams(): MetaballsParams {
  return { ...themeParams.value, ...tuned }
}

function readInitial(key: string): number {
  return Number(themeParams.value[key] ?? DEFAULT_PARAMS[key] ?? 0)
}

/* Чанк виджета (константейнер + шейдеры) начинаем качать сразу, как только
   исполнился модуль компонента, а не в onMounted: на верхнем hero это убирает
   лишний сетевой хоп после гидрации — лава появляется, как только чанк доехал. */
type MetaballsModule = typeof import('~/utils/gluke-metaballs.js')
const metaballsModule: Promise<MetaballsModule> | null = import.meta.client
  ? import('~/utils/gluke-metaballs.js')
  : null

async function mount() {
  const el = host.value
  if (!el) return

  /* Уважаем системную настройку и отсутствие WebGL: в обоих случаях на месте
     виджета остаётся обложка (в полноформатном hero её нет — там фон темы). */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  if (!metaballsModule) return

  /* Виджет уже создавался (смена языка, возврат на кейс) — перецепляем
     сохранённый канвас: без пересоздания WebGL и без «перемешивания» капель.
     Конфиг переприменяем — он и так помнит свои параметры, но после смены
     темы нужно обновить светлоту/свечение. */
  const cached = getDemoWidget<MetaballsInstance>(cacheKey.value)
  if (cached) {
    lava.value = cached
    cached.reattach(el)
    cached.set(currentParams())
    running.value = true
    const canvas = el.querySelector('canvas')
    if (isCoarsePointer() && canvas) applyTouchScrollPolicy(canvas)
    return
  }

  try {
    const { default: GlukeMetaballs } = await metaballsModule
    const coarse = isCoarsePointer()

    const instance = GlukeMetaballs.create(el, {
      ...currentParams(),
      ratioCap: window.innerWidth < 1024 ? 1.5 : 2,
      pixelBudget: window.innerWidth < 1024 ? 0.7e6 : 2.2e6,
      pauseOffscreen: true,
      respectReducedMotion: true,
      /* Тач ведёт лаву так же, как курсор: капли тянутся за пальцем.
         Вертикальный свайп остаётся у страницы — см. touch-action ниже. */
      pointer: true,
      pointerFrom: 'window',
    }) as MetaballsInstance

    lava.value = instance
    /* Кэшируем сразу: смена языка перемонтирует компонент, и следующий
       показ перецепит тот же виджет без перезагрузки. */
    setDemoWidget(cacheKey.value, instance)

    running.value = true

    /* Канвас создаёт сам виджет внутри контейнера — политику скролла вешаем
       на него, иначе на тач-устройствах он перехватит вертикальный свайп. */
    const canvas = el.querySelector('canvas')
    if (coarse && canvas) applyTouchScrollPolicy(canvas)
  }
  catch (error) {
    failed.value = true
    console.error('[metaballs] не удалось запустить виджет', error)
  }
}

watch(tuned, () => {
  if (isTuner.value && import.meta.client) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tuned))
    }
    catch {
      /* приватный режим — молчим */
    }
  }
  lava.value?.set(currentParams())
}, { deep: true })

/* Смена темы сайта: лава перекрашивается на лету — set() пересылает только
   светлоту и свечение, капли не «перемешиваются». */
watch(isLight, () => {
  if (lava.value) lava.value.set(currentParams())
})

function reset() {
  /* Ключи чистим через Reflect, а не delete по вычисляемому ключу:
     значения по умолчанию всё равно подставляет currentParams(). */
  for (const key of Object.keys(tuned)) Reflect.deleteProperty(tuned, key)
  lava.value?.set(currentParams())
}

const jsonOut = computed(() => JSON.stringify(currentParams(), null, 2))

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

onMounted(mount)
onBeforeUnmount(() => {
  /* Виджет не уничтожаем — отцепляем и оставляем в кэше (demoWidgetCache):
     смена языка перемонтирует компонент, и следующий показ перецепит тот же
     канвас без пересоздания WebGL и без «перемешивания» капель. */
  lava.value?.detach()
  lava.value = null
})
</script>

<template>
  <div
    class="metaball-demo"
    :class="[`metaball-demo--${props.variant ?? 'hero'}`, { 'metaball-demo--live': running }]"
  >
    <div class="metaball-demo__stage">
      <!-- Обложка лежит под виджетом и видна, пока он не запустился: так блок
           не мигает пустотой и остаётся осмысленным без WebGL. В полноэкранном
           bleed-режиме её нет намеренно — там фоном служит сама страница
           (тема сайта), как у звёздного поля. -->
      <NuxtImg
        v-if="props.variant !== 'bleed'"
        :src="props.poster"
        :alt="props.posterAlt"
        sizes="100vw lg:58vw xl:1000px"
        format="avif,webp"
        loading="eager"
        decoding="async"
        class="metaball-demo__poster"
      />
      <div
        ref="host"
        class="metaball-demo__canvas"
        :aria-label="props.demo.alt"
        role="img"
      />
    </div>

    <div
      v-if="props.variant === 'tunable' && running"
      class="metaball-demo__controls"
    >
      <div class="metaball-demo__controls-head">
        <h3 class="text-heading text-heading--sm">
          {{ t('project.demo.title') }}
        </h3>
        <button
          type="button"
          class="text-body--sm metaball-demo__reset"
          @click="reset"
        >
          {{ t('project.demo.reset') }}
        </button>
      </div>

      <p class="text-body--sm metaball-demo__hint">
        {{ t('project.demo.hint') }}
      </p>

      <div class="metaball-demo__groups">
        <div
          v-for="group in GROUPS"
          :key="group.id"
          class="metaball-demo__group"
        >
          <h4 class="text-label metaball-demo__group-name">
            {{ t(`project.demo.groups.${group.id}`) }}
          </h4>

          <label
            v-for="control in group.controls"
            :key="control.key"
            class="metaball-demo__slider"
          >
            <span class="text-body--sm metaball-demo__slider-name">
              {{ t(`project.demo.controls.${control.key}`) }}
            </span>
            <input
              :value="tuned[control.key] ?? readInitial(control.key)"
              type="range"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              class="metaball-demo__range"
              @input="tuned[control.key] = Number(($event.target as HTMLInputElement).value)"
            >
            <span class="text-body--sm metaball-demo__slider-value">
              {{ (tuned[control.key] ?? readInitial(control.key)).toFixed(control.step >= 1 ? 0 : 2) }}
            </span>
          </label>
        </div>
      </div>

      <div class="metaball-demo__actions">
        <button
          type="button"
          class="text-body--sm metaball-demo__copy"
          @click="copyJson"
        >
          {{ copied ? t('project.demo.copied') : t('project.demo.copy') }}
        </button>
      </div>

      <details class="metaball-demo__json">
        <summary class="text-body--sm">
          JSON
        </summary>
        <pre class="metaball-demo__json-pre">{{ jsonOut }}</pre>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Сцена живёт на фоне темы сайта, как звёздное поле: своего тёмного экрана
   у лавы нет. Канвас прозрачный (alpha: true, clearColor 0,0,0,0), и пока
   виджет не ожил — на его месте обложка кейса. Цвета лавы перекрашиваются
   по теме через THEME_LOOK (в светлой теме — чернильные, читаемые на белом). */
.metaball-demo__stage {
  position: relative;
  background: transparent;
  aspect-ratio: 16 / 9;
}

/* Полноэкранный bleed-режим (как звёздное поле): лава заполняет весь верх
   страницы фоном, без собственной рамки и подложки — канвас прозрачный
   и лежит прямо на фоне темы сайта. */
.metaball-demo--bleed {
  position: absolute;
  inset: 0;
}

.metaball-demo--bleed .metaball-demo__stage {
  position: absolute;
  inset: 0;
  aspect-ratio: auto;
  border-radius: 0;
}

.metaball-demo--bleed .metaball-demo__controls {
  display: none;
}

.metaball-demo__poster,
.metaball-demo__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.metaball-demo--bleed .metaball-demo__poster {
  object-fit: cover;
}

.metaball-demo__poster {
  object-fit: cover;
  transition: opacity 400ms ease;
}

/* Когда виджет ожил, обложка уходит — но остаётся в разметке как фон на случай
   потери контекста WebGL. */
.metaball-demo--live .metaball-demo__poster {
  opacity: 0;
}

.metaball-demo__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-block-start: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.metaball-demo__controls-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.metaball-demo__reset,
.metaball-demo__copy {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.metaball-demo__reset:hover,
.metaball-demo__copy:hover {
  color: var(--site-accent-text-hover);
}

.metaball-demo__hint {
  max-width: 62ch;
  color: var(--site-text-secondary);
}

.metaball-demo__groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(20px, 2.4vw, 32px);
}

.metaball-demo__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.metaball-demo__group-name {
  padding-block-end: 6px;
  border-bottom: var(--site-border);
  color: var(--site-text-secondary);
}

.metaball-demo__slider {
  display: grid;
  grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: 10px;
}

.metaball-demo__slider-name {
  color: var(--site-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.25;
}

.metaball-demo__slider-value {
  color: var(--site-text);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.metaball-demo__range {
  width: 100%;
  min-height: 44px;
  accent-color: var(--site-accent-text);
  cursor: pointer;
}

.metaball-demo__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-block-start: 4px;
}

.metaball-demo__json {
  border-top: var(--site-border);
  padding-block-start: 10px;
}

.metaball-demo__json summary {
  cursor: pointer;
  color: var(--site-text-secondary);
}

.metaball-demo__json-pre {
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
  .metaball-demo__range {
    min-height: 22px;
  }
}

@media (min-width: 768px) {
  .metaball-demo__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* На десктопе панель уходит вправо от лавы — как у пирамиды и звёзд. */
@media (min-width: 1024px) {
  .metaball-demo--tunable {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 22rem);
    align-items: start;
    gap: clamp(24px, 2.6vw, 40px);
  }

  .metaball-demo--tunable .metaball-demo__controls {
    margin-block-start: 0;
  }

  .metaball-demo--tunable .metaball-demo__groups {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .metaball-demo--tunable .metaball-demo__slider {
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 2.5rem;
    gap: 8px;
  }

  .metaball-demo--tunable .metaball-demo__hint {
    max-width: none;
  }
}
</style>
