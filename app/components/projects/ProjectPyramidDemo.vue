<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ProjectsCollectionItem } from '@nuxt/content'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from '~/utils/demoWidgetCache'
import { applyTouchScrollPolicy, isCoarsePointer } from '~/utils/touchScroll'
import { PYRAMID_THEME_LOOK } from '~/utils/widgetThemeLook'

type PyramidParams = Record<string, unknown>

interface PyramidInstance {
  set: (patch: PyramidParams) => void
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
  /** `hero` — чистая пирамида в шапке, `tunable` — с панелью параметров,
      `bleed` — пирамида на весь hero-блок (как звёздное поле). */
  variant?: 'hero' | 'tunable' | 'bleed'
}>()

const { t } = useI18n()

const host = ref<HTMLElement | null>(null)
const pyramid = shallowRef<PyramidInstance | null>(null)
const running = ref(false)
const failed = ref(false)

/* Ключ кэша: тип виджета + вариант размещения. При смене языка компонент
   перемонтируется, и виджет перецепляется из demoWidgetCache, а не создаётся
   заново (иначе перекомпилируются шейдеры и заново качаются логотипы). */
const cacheKey = computed(() => demoWidgetKey(props.demo.widget, props.variant ?? 'hero'))

/* Ползунки описаны здесь, а не в контенте: это отражение реального API виджета,
   и меняться они должны вместе с ним, а не редактором кейса. Набор и границы
   повторяют панель `tune.html` из самого виджета — тот же инструмент, которым
   подбирался конфиг для этой страницы. */
const GROUPS = [
  {
    id: 'geometry',
    controls: [
      { key: 'rise', min: 0.5, max: 5, step: 0.05 },
      { key: 'baseSpan', min: 1, max: 8, step: 0.05 },
      { key: 'zoom', min: 1, max: 5, step: 0.05 },
    ],
  },
  {
    id: 'color',
    controls: [
      { key: 'hues0', min: 0, max: 6.28, step: 0.05 },
      { key: 'hues1', min: 0, max: 6.28, step: 0.05 },
      { key: 'hues2', min: 0, max: 6.28, step: 0.05 },
      { key: 'hueTurn', min: -3.14, max: 3.14, step: 0.05 },
      { key: 'vividness', min: 0, max: 2.5, step: 0.05 },
      { key: 'bandRate', min: 0.2, max: 3, step: 0.05 },
      { key: 'radiance', min: 0, max: 3, step: 0.05 },
      { key: 'flare', min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    id: 'motion',
    controls: [
      { key: 'drift', min: -1, max: 1, step: 0.01 },
      { key: 'flowRate', min: 0, max: 2, step: 0.05 },
      { key: 'lean', min: -0.6, max: 0.8, step: 0.01 },
      { key: 'swayX', min: 0, max: 2.5, step: 0.05 },
      { key: 'swayY', min: 0, max: 1.5, step: 0.05 },
      { key: 'easing', min: 0.01, max: 0.3, step: 0.005 },
    ],
  },
  {
    id: 'logo',
    controls: [
      { key: 'markSize', min: 0.1, max: 1, step: 0.01 },
      { key: 'markHeight', min: 0, max: 0.9, step: 0.01 },
      { key: 'markGlow', min: 0, max: 40, step: 0.5 },
      { key: 'markDepth', min: 0.02, max: 0.2, step: 0.005 },
    ],
  },
] as const

const HUES_KEY = /^hues([0-2])$/

const colorMode = useColorMode()
const isLight = computed(() => colorMode.value === 'light')

const themeParams = computed<PyramidParams>(() => ({
  ...(props.demo.params as PyramidParams),
  ...PYRAMID_THEME_LOOK[isLight.value ? 'light' : 'dark'],
}))

/* Правило шаблона демо-кейсов: настройки лаборатории живут только в памяти
   текущей сессии и только у экземпляра `tunable`. Hero-вариант всегда создаётся
   и живёт на дефолтах кейса (themeParams) — что бы ни крутили внизу, шапка не
   меняется, и после перезапуска страницы всё снова дефолтное. */
const tuned = ref<Record<string, number>>({})
const isTuner = computed(() => props.variant === 'tunable')

/* `phase` — массив из трёх чисел, а ползунки правят его компоненты по одному,
   поэтому phase0/1/2 собираются обратно в массив и из плоского набора убираются. */
function currentParams(): PyramidParams {
  /* Подкрученные значения уходят только в лабораторию; hero/bleed всегда
     используют дефолты кейса — из лаборатории ничего не переходит в шапку. */
  const merged = { ...themeParams.value, ...(isTuner.value ? tuned.value : {}) }
  const hues = [...((props.demo.params.hues as number[] | undefined) ?? [0, 1, 2])]
  let huesTouched = false

  for (let i = 0; i < 3; i++) {
    const value = tuned.value[`hues${i}`]
    if (typeof value === 'number') {
      hues[i] = value
      huesTouched = true
    }
  }

  /* Плоские phase0/1/2 в виджет не уходят — он ждёт массив `phase`. */
  const base = Object.fromEntries(
    Object.entries(merged).filter(([key]) => !HUES_KEY.test(key)),
  ) as PyramidParams

  if (huesTouched) base.hues = hues

  return base
}

function readInitial(key: string): number {
  const phaseMatch = HUES_KEY.exec(key)
  if (phaseMatch) {
    return (themeParams.value.hues as number[] | undefined)?.[Number(phaseMatch[1])] ?? 0
  }
  return Number(themeParams.value[key] ?? 0)
}

/* Возвращает перецепленному виджету конфиг кейса: инстанс мог быть создан
   другим кейсом или с другими параметрами. Логотипы передаём только при
   расхождении с текущими — иначе set() пересоберёт атлас и заново скачает
   SVG, ради чего кэш и затевался. */
function applyConfig(instance: PyramidInstance) {
  const patch = currentParams()
  const marks = props.demo.logo ? [props.demo.logo, props.demo.logo, props.demo.logo, props.demo.logo] : []
  const current = (instance as unknown as { o?: { marks?: string[] } }).o?.marks
  if (marks.length && JSON.stringify(current) !== JSON.stringify(marks)) {
    patch.marks = marks
  }
  instance.set(patch)
}

async function mount() {
  const el = host.value
  if (!el) return

  /* Уважаем системную настройку и отсутствие WebGL: в обоих случаях на месте
     виджета остаётся обложка — она и так лежит в разметке. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  /* Виджет уже создавался (смена языка, возврат на кейс) — перецепляем
     сохранённый канвас: без пересоздания WebGL-контекста, перекомпиляции
     шейдеров и повторной загрузки логотипов. */
  const cached = getDemoWidget<PyramidInstance>(cacheKey.value)
  if (cached) {
    pyramid.value = cached
    cached.reattach(el)
    applyConfig(cached)
    running.value = true
    const canvas = el.querySelector('canvas')
    if (isCoarsePointer() && canvas) applyTouchScrollPolicy(canvas)
    return
  }

  try {
    const { default: GlukePyramid } = await import('~/utils/gluke-pyramid.js')
    const coarse = isCoarsePointer()

    const instance = GlukePyramid.create(el, {
      ...currentParams(),
      marks: props.demo.logo ? [props.demo.logo, props.demo.logo, props.demo.logo, props.demo.logo] : [],
      /* Планка та же, что у three.js-сцен сайта: 1.5 на узких экранах, 2 на
         десктопе. Плюс потолок площади буфера — марш-цикл считает сто шагов на
         пиксель, и цена растёт строго по площади, а не по геометрии. */
      ratioCap: window.innerWidth < 1024 ? 1.5 : 2,
      pixelBudget: window.innerWidth < 1024 ? 0.7e6 : 2.2e6,
      pauseOffscreen: true,
      respectReducedMotion: true,
      /* Тач тоже ведёт пирамиду: касание работает как курсор. Скролл при
         этом не отбирается — канвас ниже получает touch-action: pan-y, и
         вертикальный свайп уходит странице. */
      pointer: true,
      /* Курсор ловим по всему окну, как в исходном демо: там блок занимает
         экран целиком, и отклик читается, пока мышь просто ходит по странице.
         Нормирует положение виджет всё равно по своему прямоугольнику, так что
         полный ход укладывается в ширину блока, а по краям окна упирается в
         ограничитель +-1.6 — это и задумано. */
      pointerFrom: 'window',
    }) as PyramidInstance

    pyramid.value = instance
    /* Кэшируем сразу: смена языка перемонтирует компонент, и следующий показ
       перецепит тот же виджет без перезагрузки. */
    setDemoWidget(cacheKey.value, instance)

    running.value = true

    /* Канвас создаёт сам виджет внутри контейнера — политику скролла вешаем
       на него, иначе на тач-устройствах он перехватит вертикальный свайп. */
    const canvas = el.querySelector('canvas')
    if (coarse && canvas) applyTouchScrollPolicy(canvas)
  }
  catch (error) {
    failed.value = true
    console.error('[pyramid] не удалось запустить виджет', error)
  }
}

watch(tuned, () => {
  /* Ползунки есть только у лаборатории: подкрутка меняет её собственный виджет
     и никуда не сохраняется. Hero/bleed обновлять нечего — они живут
     на дефолтах и в кэше лежат отдельным ключом. */
  if (isTuner.value) pyramid.value?.set(currentParams())
}, { deep: true })

/* Смена темы сайта: пирамида перекрашивается на лету без пересоздания
   WebGL-контекста и без перекачки логотипов — set() пересылает только
   цветовые юниформы. */
watch(isLight, () => {
  if (pyramid.value) pyramid.value.set(currentParams())
})

function reset() {
  tuned.value = {}
  pyramid.value?.set(currentParams())
}

onMounted(mount)
onBeforeUnmount(() => {
  /* Виджет не уничтожаем — отцепляем и оставляем в кэше (demoWidgetCache):
     смена языка перемонтирует компонент, и следующий показ перецепит тот же
     канвас без пересоздания WebGL и перекачки логотипов. */
  pyramid.value?.detach()
  pyramid.value = null
})
</script>

<template>
  <div
    class="pyramid-demo"
    :class="[`pyramid-demo--${props.variant ?? 'hero'}`, { 'pyramid-demo--live': running }]"
  >
    <div class="pyramid-demo__stage">
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
        class="pyramid-demo__poster"
      />
      <div
        ref="host"
        class="pyramid-demo__canvas"
        :aria-label="props.demo.alt"
        role="img"
      />
    </div>

    <div
      v-if="props.variant === 'tunable' && running"
      class="pyramid-demo__controls"
    >
      <div class="pyramid-demo__controls-head">
        <h3 class="text-heading text-heading--sm">
          {{ t('project.demo.title') }}
        </h3>
        <button
          type="button"
          class="text-body--sm pyramid-demo__reset"
          @click="reset"
        >
          {{ t('project.demo.reset') }}
        </button>
      </div>

      <p class="text-body--sm pyramid-demo__hint">
        {{ t('project.demo.hint') }}
      </p>

      <div class="pyramid-demo__groups">
        <div
          v-for="group in GROUPS"
          :key="group.id"
          class="pyramid-demo__group"
        >
          <h4 class="text-label pyramid-demo__group-name">
            {{ t(`project.demo.groups.${group.id}`) }}
          </h4>

          <label
            v-for="control in group.controls"
            :key="control.key"
            class="pyramid-demo__slider"
          >
            <span class="text-body--sm pyramid-demo__slider-name">{{ control.key }}</span>
            <input
              :value="tuned[control.key] ?? readInitial(control.key)"
              type="range"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              class="pyramid-demo__range"
              @input="tuned[control.key] = Number(($event.target as HTMLInputElement).value)"
            >
            <span class="text-body--sm pyramid-demo__slider-value">
              {{ (tuned[control.key] ?? readInitial(control.key)).toFixed(2) }}
            </span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Сцена живёт на фоне темы сайта, как звёздное поле: своего тёмного экрана
   у пирамиды больше нет. Канвас прозрачный (alpha: true, clearColor 0,0,0,0),
   и пока виджет не ожил — на его месте обложка кейса. Цвета пирамиды
   перекрашиваются по теме через THEME_LOOK (в светлой теме — приглушённая
   палитра, чтобы неон не выцветал по белому фону). */
.pyramid-demo__stage {
  position: relative;
  background: transparent;
  aspect-ratio: 16 / 9;
}

/* Полноэкранный bleed-режим (как звёздное поле): пирамида заполняет весь
   верх страницы фоном, без собственной рамки и подложки — канвас прозрачный
   и лежит прямо на фоне темы сайта. */
.pyramid-demo--bleed {
  position: absolute;
  inset: 0;
}

.pyramid-demo--bleed .pyramid-demo__stage {
  position: absolute;
  inset: 0;
  aspect-ratio: auto;
  border-radius: 0;
}

.pyramid-demo--bleed .pyramid-demo__controls {
  display: none;
}

.pyramid-demo__poster,
.pyramid-demo__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pyramid-demo--bleed .pyramid-demo__poster {
  object-fit: cover;
}

.pyramid-demo__poster {
  object-fit: cover;
  transition: opacity 400ms ease;
}

/* Когда виджет ожил, обложка уходит — но остаётся в разметке как фон на случай
   потери контекста WebGL. */
.pyramid-demo--live .pyramid-demo__poster {
  opacity: 0;
}

.pyramid-demo__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-block-start: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.pyramid-demo__controls-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.pyramid-demo__reset {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.pyramid-demo__reset:hover {
  color: var(--site-accent-text-hover);
}

.pyramid-demo__hint {
  max-width: 62ch;
  color: var(--site-text-secondary);
}

.pyramid-demo__groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(20px, 2.4vw, 32px);
}

.pyramid-demo__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.pyramid-demo__group-name {
  padding-block-end: 6px;
  border-bottom: var(--site-border);
  color: var(--site-text-secondary);
}

.pyramid-demo__slider {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) 2.75rem;
  align-items: center;
  gap: 10px;
}

.pyramid-demo__slider-name {
  color: var(--site-text-secondary);
  /* Имена параметров — из API виджета, самые длинные `colorFrequency` и
     `hoverStrengthY`: колонка считается по ним, иначе они неразличимы. */
  font-size: 0.8125rem;
  white-space: nowrap;
}

.pyramid-demo__slider-value {
  color: var(--site-text);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.pyramid-demo__range {
  width: 100%;
  /* 44px — цель под палец; на десктопе с точным курсором ряд можно сжать,
     чтобы вся панель на 21 ползунок помещалась рядом с призмой. */
  min-height: 44px;
  accent-color: var(--site-accent-text);
  cursor: pointer;
}

@media (pointer: fine) {
  .pyramid-demo__range {
    min-height: 22px;
  }
}

@media (min-width: 768px) {
  .pyramid-demo__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* На десктопе панель уходит вправо от пирамиды — как в `tune.html` виджета.
   Призме полная ширина не нужна: крутить параметры удобнее, когда результат
   и ручки видно одновременно, без прокрутки между ними. */
@media (min-width: 1024px) {
  .pyramid-demo--tunable {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 22rem);
    align-items: start;
    gap: clamp(24px, 2.6vw, 40px);
  }

  .pyramid-demo--tunable .pyramid-demo__controls {
    margin-block-start: 0;
  }

  /* В узкой колонке группы идут в один столбец друг под другом. */
  .pyramid-demo--tunable .pyramid-demo__groups {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .pyramid-demo--tunable .pyramid-demo__slider {
    grid-template-columns: 7.25rem minmax(0, 1fr) 2.5rem;
    gap: 8px;
  }

  .pyramid-demo--tunable .pyramid-demo__hint {
    max-width: none;
  }
}
</style>
