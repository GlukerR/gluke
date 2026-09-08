<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from '~/utils/demoWidgetCache'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'
import { IMAGE_PARTICLES_THEME_LOOK } from '~/utils/widgetThemeLook'

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
  /** `hero` — частицы в шапке кейса, `tunable` — лаборатория: частицы
      + ползунки + копирование JSON. Bleed-режима пока нет (см.
      BLEED_DEMO_WIDGETS в demoWidgetCache.ts). */
  variant?: 'hero' | 'tunable'
}>()

const { t } = useI18n()

const host = ref<HTMLElement | null>(null)
const particles = shallowRef<ParticlesInstance | null>(null)
const running = ref(false)
const failed = ref(false)
const copied = ref(false)

/* Ключ кэша: тип виджета + вариант размещения. При смене языка компонент
   перемонтируется, и виджет перецепляется из demoWidgetCache, а не создаётся
   заново (иначе перекомпилируются шейдеры и картинка «перемешивается»). */
const cacheKey = computed(() => demoWidgetKey(props.demo.widget, props.variant ?? 'hero'))

/* Ползунки — зеркало API виджета (`~/utils/gluke-image-particles.js`).
   Фон не выносим — он берётся из темы сайта. */
const GROUPS = [
  {
    id: 'field',
    controls: [
      { key: 'density', min: 1, max: 4, step: 1 },
      { key: 'dotSize', min: 0.4, max: 3, step: 0.05 },
      { key: 'scatter', min: 0, max: 1, step: 0.005 },
      { key: 'depth', min: 0, max: 0.5, step: 0.01 },
      { key: 'flow', min: 0.2, max: 2.5, step: 0.05 },
      { key: 'colorSat', min: 0, max: 1, step: 0.05 },
      { key: 'contrast', min: 1, max: 3, step: 0.05 },
      { key: 'floor', min: 0, max: 0.4, step: 0.005 },
      { key: 'shadowFill', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'cursor',
    controls: [
      { key: 'radius', min: 0.1, max: 1.5, step: 0.05 },
      { key: 'repel', min: 0, max: 1.5, step: 0.05 },
      { key: 'glide', min: 0.02, max: 0.4, step: 0.01 },
      { key: 'parallax', min: 0, max: 1, step: 0.05 },
    ],
  },
] as const

/* Дефолты повторяют `DEFAULTS` из `gluke-image-particles.js`. */
const DEFAULT_PARAMS: Record<string, number> = {
  density: 1,
  dotSize: 1.6,
  /* Разлёт держим маленьким — картинка должна читаться, а не быть облаком. */
  scatter: 0.02,
  depth: 0.04,
  flow: 1.4,
  colorSat: 0.3,
  contrast: 1.35,
  floor: 0.28,
  shadowFill: 0.08,
  radius: 0.5,
  repel: 0.1,
  glide: 0.12,
  parallax: 1,
}

/* Правило шаблона (одинаково для всех WebGL-кейсов): настройки лаборатории
   живут только в памяти текущей сессии и только у экземпляра `tunable`.
   Hero всегда создаётся и живёт на дефолтах кейса — что бы ни крутили внизу,
   шапка не меняется, и после перезапуска страницы всё снова дефолтное.
   Никакого localStorage: это сознательное решение, чтобы посетитель не мог
   «сломать» красивый дефолт и случайно сохранить это для всех. */
const colorMode = useColorMode()
const isLight = computed(() => colorMode.value === 'light')

const tuned = reactive<Record<string, number>>({})

const themeParams = computed<ParticlesParams>(() => ({
  ...DEFAULT_PARAMS,
  ...(props.demo.params as ParticlesParams),
  ...IMAGE_PARTICLES_THEME_LOOK[isLight.value ? 'light' : 'dark'],
}))

function currentParams(): ParticlesParams {
  return { ...themeParams.value, ...tuned }
}

function readInitial(key: string): number {
  return Number(themeParams.value[key] ?? DEFAULT_PARAMS[key] ?? 0)
}

/* Чанк виджета начинаем качать сразу, как только исполнился модуль
   компонента, а не в onMounted: на верхнем hero это убирает лишний
   сетевой хоп после гидрации — частицы появляются, как только чанк доехал. */
type ParticlesModule = typeof import('~/utils/gluke-image-particles.js')
const particlesModule: Promise<ParticlesModule> | null = import.meta.client
  ? import('~/utils/gluke-image-particles.js')
  : null

async function mount() {
  const el = host.value
  if (!el) return

  /* Уважаем системную настройку и отсутствие WebGL: в обоих случаях на месте
     виджета остаётся обложка. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!particlesModule) return

  /* Виджет уже создавался (смена языка, возврат на кейс) — перецепляем
     сохранённый канвас без пересоздания WebGL. */
  const cached = getDemoWidget<ParticlesInstance>(cacheKey.value)
  if (cached) {
    particles.value = cached
    cached.reattach(el)
    cached.set(currentParams())
    running.value = true
    const canvas = el.querySelector('canvas')
    if (isCoarsePointer() && canvas) applyTouchScrollPolicy(canvas)
    return
  }

  try {
    const { default: GlukeImageParticles } = await particlesModule
    const coarse = isCoarsePointer()

    const instance = GlukeImageParticles.create(el, {
      ...currentParams(),
      src: props.demo.src,
      ratioCap: window.innerWidth < 1024 ? 1.5 : 2,
      pixelBudget: window.innerWidth < 1024 ? 0.9e6 : 2.2e6,
      pauseOffscreen: true,
      respectReducedMotion: true,
      /* На тач-устройствах курсора нет — картинка просто собрана из точек. */
      pointer: !coarse,
      pointerFrom: 'window',
    }) as ParticlesInstance

    particles.value = instance
    /* Кэшируем сразу: смена языка перемонтирует компонент, и следующий
       показ перецепит тот же виджет без перезагрузки. */
    setDemoWidget(cacheKey.value, instance)

    running.value = true

    const canvas = el.querySelector('canvas')
    if (coarse && canvas) applyTouchScrollPolicy(canvas)
  }
  catch (error) {
    failed.value = true
    console.error('[image-particles] не удалось запустить виджет', error)
  }
}

/* Лаборатория меняет только себя: hero не пересоздаётся и не трогается. */
watch(tuned, () => {
  particles.value?.set(currentParams())
}, { deep: true })

/* Смена темы сайта: частицы перекрашиваются на лету — set() пересылает
   режим смешивания и яркость, точки не «перемешиваются». */
watch(isLight, () => {
  if (particles.value) particles.value.set(currentParams())
})

function reset() {
  /* Ключи чистим присваиванием, а не delete: значения по умолчанию всё равно
     подставляет currentParams(), а реактивность так не теряется. */
  for (const key of Object.keys(tuned)) Reflect.deleteProperty(tuned, key)
  particles.value?.set(currentParams())
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
    copied.value = false
  }
}

onMounted(mount)
onBeforeUnmount(() => {
  /* Виджет не уничтожаем — отцепляем и оставляем в кэше (demoWidgetCache):
     смена языка перемонтирует компонент, и следующий показ перецепит тот же
     канвас без пересоздания WebGL. */
  particles.value?.detach()
  particles.value = null
})
</script>

<template>
  <div
    class="particles-demo"
    :class="[`particles-demo--${props.variant ?? 'hero'}`, { 'particles-demo--live': running }]"
  >
    <div class="particles-demo__stage">
      <!-- Обложка лежит под виджетом и видна, пока он не запустился: так блок
           не мигает пустотой и остаётся осмысленным без WebGL. -->
      <NuxtImg
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
        <pre class="text-body--xs particles-demo__json-body">{{ jsonOut }}</pre>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Сцена живёт на фоне темы сайта: своего тёмного экрана у частиц нет.
   Канвас прозрачный, и пока виджет не ожил — на его месте обложка кейса.
   Цвета перекрашиваются по теме через THEME_LOOK (в светлой теме —
   «чернильные» точки, чёрный фон донора невидим). */
.particles-demo__stage {
  position: relative;
  background: transparent;
  aspect-ratio: 16 / 9;
}

.particles-demo__poster,
.particles-demo__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.particles-demo__poster {
  object-fit: cover;
  transition: opacity 400ms ease;
}

/* Когда виджет ожил, обложка уходит — но остаётся в разметке как фон на
   случай потери контекста WebGL. */
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
  font-size: 0.8125rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.particles-demo__range {
  width: 100%;
  accent-color: var(--site-accent);
}

.particles-demo__actions {
  display: flex;
  gap: 12px;
}

.particles-demo__json {
  border: var(--site-border);
  border-radius: 10px;
}

.particles-demo__json summary {
  cursor: pointer;
  padding: 8px 12px;
  color: var(--site-text-secondary);
}

.particles-demo__json-body {
  margin: 0;
  padding: 0 12px 12px;
  overflow: auto;
  max-height: 260px;
  color: var(--site-text-secondary);
}

/* На средних экранах группы идут в две колонки. */
@media (min-width: 768px) {
  .particles-demo__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* На десктопе панель уходит вправо от сцены — как у пирамиды и звёзд. */
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
