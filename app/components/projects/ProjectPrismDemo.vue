<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'

type PrismParams = Record<string, unknown>

interface PrismInstance {
  set: (patch: PrismParams) => void
  stop: () => void
  start: () => void
  destroy: () => void
}

const props = defineProps<{
  demo: NonNullable<ProjectsCollectionItem['demo']>
  /** Обложка кейса: показывается, пока виджет не запустился, и остаётся
      навсегда, если WebGL недоступен или включено «уменьшить движение». */
  poster: string
  posterAlt: string
  /** `hero` — чистая призма в шапке, `tunable` — с панелью параметров. */
  variant?: 'hero' | 'tunable'
}>()

const { t } = useI18n()

const host = ref<HTMLElement | null>(null)
const prism = shallowRef<PrismInstance | null>(null)
const running = ref(false)
const failed = ref(false)

/* Ползунки описаны здесь, а не в контенте: это отражение реального API виджета,
   и меняться они должны вместе с ним, а не редактором кейса. Набор и границы
   повторяют панель `tune.html` из самого виджета — тот же инструмент, которым
   подбирался конфиг для этой страницы. */
const GROUPS = [
  {
    id: 'geometry',
    controls: [
      { key: 'height', min: 0.5, max: 5, step: 0.05 },
      { key: 'baseWidth', min: 1, max: 8, step: 0.05 },
      { key: 'scale', min: 1, max: 5, step: 0.05 },
    ],
  },
  {
    id: 'color',
    controls: [
      { key: 'phase0', min: 0, max: 6.28, step: 0.05 },
      { key: 'phase1', min: 0, max: 6.28, step: 0.05 },
      { key: 'phase2', min: 0, max: 6.28, step: 0.05 },
      { key: 'hueShift', min: -3.14, max: 3.14, step: 0.05 },
      { key: 'saturation', min: 0, max: 2.5, step: 0.05 },
      { key: 'colorFrequency', min: 0.2, max: 3, step: 0.05 },
      { key: 'glow', min: 0, max: 3, step: 0.05 },
      { key: 'bloom', min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    id: 'motion',
    controls: [
      { key: 'spin', min: -1, max: 1, step: 0.01 },
      { key: 'timeScale', min: 0, max: 2, step: 0.05 },
      { key: 'tilt', min: -0.6, max: 0.8, step: 0.01 },
      { key: 'hoverStrength', min: 0, max: 2.5, step: 0.05 },
      { key: 'hoverStrengthY', min: 0, max: 1.5, step: 0.05 },
      { key: 'inertia', min: 0.01, max: 0.3, step: 0.005 },
    ],
  },
  {
    id: 'logo',
    controls: [
      { key: 'logoScale', min: 0.1, max: 1, step: 0.01 },
      { key: 'logoY', min: 0, max: 0.9, step: 0.01 },
      { key: 'logoGlow', min: 0, max: 40, step: 0.5 },
      { key: 'logoDepth', min: 0.02, max: 0.2, step: 0.005 },
    ],
  },
] as const

const PHASE_KEY = /^phase([0-2])$/

/* Тема страницы на призму не влияет: подложка блока тёмная всегда (см. стили),
   иначе аддитивное свечение по светлому фону теряется. */
const themeParams = computed<PrismParams>(() => ({ ...(props.demo.params as PrismParams) }))

const tuned = ref<Record<string, number>>({})

/* `phase` — массив из трёх чисел, а ползунки правят его компоненты по одному,
   поэтому phase0/1/2 собираются обратно в массив и из плоского набора убираются. */
function currentParams(): PrismParams {
  const merged = { ...themeParams.value, ...tuned.value }
  const phase = [...((props.demo.params.phase as number[] | undefined) ?? [0, 1, 2])]
  let phaseTouched = false

  for (let i = 0; i < 3; i++) {
    const value = tuned.value[`phase${i}`]
    if (typeof value === 'number') {
      phase[i] = value
      phaseTouched = true
    }
  }

  /* Плоские phase0/1/2 в виджет не уходят — он ждёт массив `phase`. */
  const base = Object.fromEntries(
    Object.entries(merged).filter(([key]) => !PHASE_KEY.test(key)),
  ) as PrismParams

  if (phaseTouched) base.phase = phase

  return base
}

function readInitial(key: string): number {
  const phaseMatch = PHASE_KEY.exec(key)
  if (phaseMatch) {
    return (themeParams.value.phase as number[] | undefined)?.[Number(phaseMatch[1])] ?? 0
  }
  return Number(themeParams.value[key] ?? 0)
}

async function mount() {
  const el = host.value
  if (!el) return

  /* Уважаем системную настройку и отсутствие WebGL: в обоих случаях на месте
     виджета остаётся обложка — она и так лежит в разметке. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  try {
    const { default: Pleprism } = await import('~/utils/pleprism.js')
    const coarse = isCoarsePointer()

    prism.value = Pleprism.create(el, {
      ...currentParams(),
      logos: props.demo.logo ? [props.demo.logo, props.demo.logo, props.demo.logo, props.demo.logo] : [],
      /* Планка та же, что у three.js-сцен сайта: 1.5 на узких экранах, 2 на
         десктопе. Плюс потолок площади буфера — raymarch считает сто шагов на
         пиксель, и цена растёт строго по площади, а не по геометрии. */
      dpr: window.innerWidth < 1024 ? 1.5 : 2,
      maxPixels: window.innerWidth < 1024 ? 0.7e6 : 2.2e6,
      pauseOffscreen: true,
      respectReducedMotion: true,
      /* На тач-устройствах курсора нет, а реакция на touchmove отбирала бы
         скролл — там призма просто вращается сама. */
      hover: !coarse,
      /* Курсор ловим по всему окну, как в исходном демо: там блок занимает
         экран целиком, и отклик читается, пока мышь просто ходит по странице.
         Нормирует положение виджет всё равно по своему прямоугольнику, так что
         полный ход укладывается в ширину блока, а по краям окна упирается в
         ограничитель +-1.6 — это и задумано. */
      hoverTarget: 'window',
    }) as PrismInstance

    running.value = true

    /* Канвас создаёт сам виджет внутри контейнера — политику скролла вешаем
       на него, иначе на тач-устройствах он перехватит вертикальный свайп. */
    const canvas = el.querySelector('canvas')
    if (coarse && canvas) applyTouchScrollPolicy(canvas)
  }
  catch (error) {
    failed.value = true
    console.error('[prism] не удалось запустить виджет', error)
  }
}

watch(tuned, () => prism.value?.set(currentParams()), { deep: true })

function reset() {
  tuned.value = {}
  prism.value?.set(currentParams())
}

onMounted(mount)
onBeforeUnmount(() => {
  prism.value?.destroy()
  prism.value = null
})
</script>

<template>
  <div
    class="prism-demo"
    :class="[`prism-demo--${props.variant ?? 'hero'}`, { 'prism-demo--live': running }]"
  >
    <div class="prism-demo__stage">
      <!-- Обложка лежит под виджетом и видна, пока он не запустился: так блок
           не мигает пустотой и остаётся осмысленным без WebGL. -->
      <NuxtImg
        :src="props.poster"
        :alt="props.posterAlt"
        sizes="100vw lg:58vw xl:1000px"
        format="avif,webp"
        loading="eager"
        decoding="async"
        class="prism-demo__poster"
      />
      <div
        ref="host"
        class="prism-demo__canvas"
        :aria-label="props.demo.alt"
        role="img"
      />
    </div>

    <div
      v-if="props.variant === 'tunable' && running"
      class="prism-demo__controls"
    >
      <div class="prism-demo__controls-head">
        <h3 class="text-heading text-heading--sm">
          {{ t('project.demo.title') }}
        </h3>
        <button
          type="button"
          class="text-body--sm prism-demo__reset"
          @click="reset"
        >
          {{ t('project.demo.reset') }}
        </button>
      </div>

      <p class="text-body--sm prism-demo__hint">
        {{ t('project.demo.hint') }}
      </p>

      <div class="prism-demo__groups">
        <div
          v-for="group in GROUPS"
          :key="group.id"
          class="prism-demo__group"
        >
          <h4 class="text-label prism-demo__group-name">
            {{ t(`project.demo.groups.${group.id}`) }}
          </h4>

          <label
            v-for="control in group.controls"
            :key="control.key"
            class="prism-demo__slider"
          >
            <span class="text-body--sm prism-demo__slider-name">{{ control.key }}</span>
            <input
              :value="tuned[control.key] ?? readInitial(control.key)"
              type="range"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              class="prism-demo__range"
              @input="tuned[control.key] = Number(($event.target as HTMLInputElement).value)"
            >
            <span class="text-body--sm prism-demo__slider-value">
              {{ (tuned[control.key] ?? readInitial(control.key)).toFixed(2) }}
            </span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Тёмная поверхность в обеих темах — решение осознанное, а не рамка «на всякий
   случай». Свечение призмы аддитивное: шейдер добавляет свет, а к светлому фону
   добавлять его некуда, и фигура выцветает. Мягкую тёмную подложку пробовали —
   на светлой теме она читается грязным пятном. Поэтому здесь ровная поверхность
   с радиусом сайта: блок выглядит экраном, на котором идёт рендер.
   Модели в кейсах Getic и SoftLogic обходятся без неё потому, что это
   освещённые объекты, а не источник света. */
.prism-demo__stage {
  position: relative;
  border-radius: var(--site-radius-lg);
  background:
    radial-gradient(120% 90% at 50% 46%, #10131f 0%, #05060a 62%, #040508 100%);
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.prism-demo__poster,
.prism-demo__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.prism-demo__poster {
  object-fit: cover;
  transition: opacity 400ms ease;
}

/* Когда виджет ожил, обложка уходит — но остаётся в разметке как фон на случай
   потери контекста WebGL. */
.prism-demo--live .prism-demo__poster {
  opacity: 0;
}

.prism-demo__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-block-start: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.prism-demo__controls-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.prism-demo__reset {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.prism-demo__reset:hover {
  color: var(--site-accent-text-hover);
}

.prism-demo__hint {
  max-width: 62ch;
  color: var(--site-text-secondary);
}

.prism-demo__groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(20px, 2.4vw, 32px);
}

.prism-demo__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.prism-demo__group-name {
  padding-block-end: 6px;
  border-bottom: var(--site-border);
  color: var(--site-text-secondary);
}

.prism-demo__slider {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: 10px;
}

.prism-demo__slider-name {
  color: var(--site-text-secondary);
  /* Имена параметров — из API виджета, самые длинные `colorFrequency` и
     `hoverStrengthY`: колонка считается по ним, иначе они неразличимы. */
  font-size: 0.8125rem;
  white-space: nowrap;
}

.prism-demo__slider-value {
  color: var(--site-text);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.prism-demo__range {
  width: 100%;
  /* 44px — цель под палец; на десктопе с точным курсором ряд можно сжать,
     чтобы вся панель на 21 ползунок помещалась рядом с призмой. */
  min-height: 44px;
  accent-color: var(--site-accent-text);
  cursor: pointer;
}

@media (pointer: fine) {
  .prism-demo__range {
    min-height: 22px;
  }
}

@media (min-width: 768px) {
  .prism-demo__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* На десктопе панель уходит вправо от призмы — как в `tune.html` виджета.
   Призме полная ширина не нужна: крутить параметры удобнее, когда результат
   и ручки видно одновременно, без прокрутки между ними. */
@media (min-width: 1024px) {
  .prism-demo--tunable {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 22rem);
    align-items: start;
    gap: clamp(24px, 2.6vw, 40px);
  }

  .prism-demo--tunable .prism-demo__controls {
    margin-block-start: 0;
  }

  /* В узкой колонке группы идут в один столбец друг под другом. */
  .prism-demo--tunable .prism-demo__groups {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .prism-demo--tunable .prism-demo__slider {
    grid-template-columns: 7.25rem minmax(0, 1fr) 2.5rem;
    gap: 8px;
  }

  .prism-demo--tunable .prism-demo__hint {
    max-width: none;
  }
}
</style>
