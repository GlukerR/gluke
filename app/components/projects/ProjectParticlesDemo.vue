<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from '~/utils/demoWidgetCache'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'
import { PARTICLES_THEME_LOOK } from '~/utils/widgetThemeLook'

type ParticlesParams = Record<string, unknown>

interface ParticlesInstance {
  set: (patch: ParticlesParams) => void
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
  /** `hero` — чистая облако в шапке, `tunable` — лаборатория: облако + ползунки
      + копирование JSON, `bleed` — облако на весь hero-блок. */
  variant?: 'hero' | 'tunable' | 'bleed'
}>()

const { t } = useI18n()

const host = ref<HTMLElement | null>(null)
const cloud = shallowRef<ParticlesInstance | null>(null)
const running = ref(false)
const failed = ref(false)
const copied = ref(false)

/* Ключ кэша: тип виджета + вариант размещения. При смене языка компонент
   перемонтируется, и виджет перецепляется из demoWidgetCache, а не создаётся
   заново (иначе перекомпилируются шейдеры и «перемешиваются» капли). */
const cacheKey = computed(() => demoWidgetKey(props.demo.widget, props.variant ?? 'hero'))

/* Ползунки — зеркало API виджета (`~/utils/gluke-particles.js`), диапазоны
   из его дефолтов: ползунок показывает ровно то, что работает на экране.
   Фон не выносим — он берётся из темы сайта. */
const GROUPS = [
  {
    id: 'cloud',
    controls: [
      { key: 'points', min: 0, max: 80000, step: 1000 },
      { key: 'pointSize', min: 0, max: 5, step: 0.1 },
      { key: 'spread', min: 0, max: 0.35, step: 0.005 },
      { key: 'revealSpeed', min: 0, max: 0.4, step: 0.005 },
      { key: 'pointOpacity', min: 0, max: 1, step: 0.005 },
      { key: 'brightness', min: 0, max: 2.5, step: 0.01 },
    ],
  },
  {
    id: 'lines',
    controls: [
      { key: 'paths', min: 0, max: 8, step: 1 },
      { key: 'pathStep', min: 0.03, max: 0.4, step: 0.01 },
      { key: 'pathSpeed', min: 0, max: 100, step: 1 },
      { key: 'lineTail', min: 0, max: 3600, step: 50 },
      { key: 'lineFade', min: 0, max: 10, step: 0.05 },
      { key: 'lineOpacity', min: 0, max: 1, step: 0.005 },
      { key: 'lineDisplace', min: 0, max: 0.3, step: 0.005 },
    ],
  },
  {
    /* В палитре — только про цвет: общий тон и то, как от него расходятся
       и переливаются линии. Насколько что видно — в своих группах. */
    id: 'palette',
    controls: [
      { key: 'hueShift', min: 0, max: 1, step: 0.01 },
      { key: 'lineHueSpread', min: 0, max: 0.5, step: 0.01 },
      { key: 'lineShimmer', min: 0, max: 0.4, step: 0.01 },
    ],
  },
  {
    id: 'motion',
    controls: [
      { key: 'spin', min: -0.8, max: 0.8, step: 0.01 },
      { key: 'tilt', min: -0.6, max: 0.6, step: 0.01 },
    ],
  },
] as const

/* Дефолты повторяют `DEFAULTS` из `gluke-metaballs.js` (основной конфиг). */
const DEFAULT_PARAMS: Record<string, number> = {
  points: 21000,
  pointSize: 0.8,
  spread: 0.03,
  revealSpeed: 0.095,
  pointOpacity: 0.19,
  brightness: 1,
  paths: 8,
  pathStep: 0.09,
  pathSpeed: 13,
  lineTail: 0,
  lineFade: 10,
  lineOpacity: 0.26,
  lineDisplace: 0.05,
  hueShift: 0,
  lineHueSpread: 0.5,
  lineShimmer: 0.09,
  spin: 0.01,
  tilt: 0.17,
}

const STORAGE_KEY = 'gluke-particles-v3'

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

const themeParams = computed<ParticlesParams>(() => ({
  ...DEFAULT_PARAMS,
  ...(props.demo.params as ParticlesParams),
  ...PARTICLES_THEME_LOOK[isLight.value ? 'light' : 'dark'],
}))

function currentParams(): ParticlesParams {
  return { ...themeParams.value, ...tuned }
}

function readInitial(key: string): number {
  return Number(themeParams.value[key] ?? DEFAULT_PARAMS[key] ?? 0)
}

/* Чанк виджета (константейнер + шейдеры) начинаем качать сразу, как только
   исполнился модуль компонента, а не в onMounted: на верхнем hero это убирает
   лишний сетевой хоп после гидрации — облако появляется, как только чанк доехал. */
type MetaballsModule = typeof import('~/utils/gluke-particles.js')
const particlesModule: Promise<MetaballsModule> | null = import.meta.client
  ? import('~/utils/gluke-particles.js')
  : null

async function mount() {
  const el = host.value
  if (!el) return

  /* Уважаем системную настройку и отсутствие WebGL: в обоих случаях на месте
     виджета остаётся обложка (в полноформатном hero её нет — там фон темы). */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  if (!particlesModule) return

  /* Виджет уже создавался (смена языка, возврат на кейс) — перецепляем
     сохранённый канвас: без пересоздания WebGL и без «перемешивания» капель.
     Конфиг переприменяем — он и так помнит свои параметры, но после смены
     темы нужно обновить светлоту/свечение. */
  const cached = getDemoWidget<ParticlesInstance>(cacheKey.value)
  if (cached) {
    cloud.value = cached
    cached.reattach(el)
    cached.set(currentParams())
    running.value = true
    const canvas = el.querySelector('canvas')
    if (isCoarsePointer() && canvas) applyTouchScrollPolicy(canvas)
    return
  }

  try {
    const { default: GlukeParticles } = await particlesModule
    const coarse = isCoarsePointer()

    const instance = GlukeParticles.create(el, {
      ...currentParams(),
      /* Модель задаёт кейс: виджет умеет сэмплировать любую, а не только
         наш двигатель. */
      model: props.demo.model,
      ratioCap: window.innerWidth < 1024 ? 1.5 : 2,
      pixelBudget: window.innerWidth < 1024 ? 0.7e6 : 2.2e6,
      pauseOffscreen: true,
      respectReducedMotion: true,
      /* На тач-устройствах курсора нет — облако просто дрейфует сама. */
      /* Вращение перетаскиванием, как у 3D-вьюверов сайта. */
      drag: true,
    }) as ParticlesInstance

    cloud.value = instance
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
    console.error('[particles] не удалось запустить виджет', error)
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
  cloud.value?.set(currentParams())
}, { deep: true })

/* Смена темы сайта: облако перекрашивается на лету — set() пересылает только
   светлоту и свечение, капли не «перемешиваются». */
watch(isLight, () => {
  if (cloud.value) cloud.value.set(currentParams())
})

function reset() {
  /* Снимаем ключи через Reflect: оператор delete с вычисляемым ключом
     запрещён правилами проекта, а тип у `tuned` — строго number. */
  for (const key of Object.keys(tuned)) Reflect.deleteProperty(tuned, key)
  cloud.value?.set(currentParams())
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
  cloud.value?.detach()
  cloud.value = null
})
</script>

<template>
  <div
    class="particles-demo"
    :class="[`particles-demo--${props.variant ?? 'hero'}`, { 'particles-demo--live': running }]"
  >
    <div class="particles-demo__stage">
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
        class="particles-demo__poster"
      />
      <div
        ref="host"
        class="particles-demo__canvas"
        :aria-label="props.demo.alt"
        role="img"
      />
    </div>

    <div
      v-if="props.variant === 'tunable' && running"
      class="particles-demo__controls"
    >
      <div class="particles-demo__controls-head">
        <h3 class="text-heading text-heading--sm">
          {{ t('project.demo.title') }}
        </h3>
        <button
          type="button"
          class="text-body--sm particles-demo__reset"
          @click="reset"
        >
          {{ t('project.demo.reset') }}
        </button>
      </div>

      <p class="text-body--sm particles-demo__hint">
        {{ t('project.demo.hint') }}
      </p>

      <div class="particles-demo__groups">
        <div
          v-for="group in GROUPS"
          :key="group.id"
          class="particles-demo__group"
        >
          <h4 class="text-label particles-demo__group-name">
            {{ t(`project.demo.groups.${group.id}`) }}
          </h4>

          <label
            v-for="control in group.controls"
            :key="control.key"
            class="particles-demo__slider"
          >
            <span class="text-body--sm particles-demo__slider-name">
              {{ t(`project.demo.controls.${control.key}`) }}
            </span>
            <input
              :value="tuned[control.key] ?? readInitial(control.key)"
              type="range"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              class="particles-demo__range"
              @input="tuned[control.key] = Number(($event.target as HTMLInputElement).value)"
            >
            <span class="text-body--sm particles-demo__slider-value">
              {{ (tuned[control.key] ?? readInitial(control.key)).toFixed(control.step >= 1 ? 0 : 2) }}
            </span>
          </label>
        </div>
      </div>

      <div class="particles-demo__actions">
        <button
          type="button"
          class="text-body--sm particles-demo__copy"
          @click="copyJson"
        >
          {{ copied ? t('project.demo.copied') : t('project.demo.copy') }}
        </button>
      </div>

      <details class="particles-demo__json">
        <summary class="text-body--sm">
          JSON
        </summary>
        <pre class="particles-demo__json-pre">{{ jsonOut }}</pre>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Сцена живёт на фоне темы сайта, как звёздное поле: своего тёмного экрана
   у облака нет. Канвас прозрачный (alpha: true, clearColor 0,0,0,0), и пока
   виджет не ожил — на его месте обложка кейса. Цвета облака перекрашиваются
   по теме через THEME_LOOK (в светлой теме — чернильные, читаемые на белом). */
.particles-demo__stage {
  position: relative;
  background: transparent;
  aspect-ratio: 16 / 9;
}

/* Полноэкранный bleed-режим (как звёздное поле): облако заполняет весь верх
   страницы фоном, без собственной рамки и подложки — канвас прозрачный
   и лежит прямо на фоне темы сайта. */
.particles-demo--bleed {
  position: absolute;
  inset: 0;
}

.particles-demo--bleed .particles-demo__stage {
  position: absolute;
  inset: 0;
  aspect-ratio: auto;
  border-radius: 0;
}

.particles-demo--bleed .particles-demo__controls {
  display: none;
}

.particles-demo__poster,
.particles-demo__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.particles-demo--bleed .particles-demo__poster {
  object-fit: cover;
}

.particles-demo__poster {
  object-fit: cover;
  transition: opacity 400ms ease;
}

/* Когда виджет ожил, обложка уходит — но остаётся в разметке как фон на случай
   потери контекста WebGL. */
.particles-demo--live .particles-demo__poster {
  opacity: 0;
}

.particles-demo__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-block-start: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.particles-demo__controls-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.particles-demo__reset,
.particles-demo__copy {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.particles-demo__reset:hover,
.particles-demo__copy:hover {
  color: var(--site-accent-text-hover);
}

.particles-demo__hint {
  max-width: 62ch;
  color: var(--site-text-secondary);
}

.particles-demo__groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(20px, 2.4vw, 32px);
}

.particles-demo__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.particles-demo__group-name {
  padding-block-end: 6px;
  border-bottom: var(--site-border);
  color: var(--site-text-secondary);
}

.particles-demo__slider {
  display: grid;
  grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: 10px;
}

.particles-demo__slider-name {
  color: var(--site-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.25;
}

.particles-demo__slider-value {
  color: var(--site-text);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.particles-demo__range {
  width: 100%;
  min-height: 44px;
  accent-color: var(--site-accent-text);
  cursor: pointer;
}

.particles-demo__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-block-start: 4px;
}

.particles-demo__json {
  border-top: var(--site-border);
  padding-block-start: 10px;
}

.particles-demo__json summary {
  cursor: pointer;
  color: var(--site-text-secondary);
}

.particles-demo__json-pre {
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
  .particles-demo__range {
    min-height: 22px;
  }
}

@media (min-width: 768px) {
  .particles-demo__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* На десктопе панель уходит вправо от облака — как у пирамиды и звёзд. */
@media (min-width: 1024px) {
  .particles-demo--tunable {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 22rem);
    align-items: start;
    gap: clamp(24px, 2.6vw, 40px);
  }

  .particles-demo--tunable .particles-demo__controls {
    margin-block-start: 0;
  }

  .particles-demo--tunable .particles-demo__groups {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .particles-demo--tunable .particles-demo__slider {
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 2.5rem;
    gap: 8px;
  }

  .particles-demo--tunable .particles-demo__hint {
    max-width: none;
  }
}
</style>
