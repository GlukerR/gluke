/* Описания WebGL-виджетов кейсов для общей оболочки `ProjectWidgetDemo.vue`.
 *
 * Обвязка у всех пяти виджетов одна: сцена с обложкой под канвасом, панель
 * ползунков, кэш инстанса между перемонтированиями, политика тач-скролла,
 * потолки dpr и площади буфера. Раньше она была скопирована в пять
 * компонентов по 500–600 строк, и копии успели разойтись — у пирамиды,
 * например, забыли перевод подписей, и на публичной странице показывались
 * сырые ключи. Здесь остаётся только то, чем виджеты действительно
 * отличаются: какой модуль грузить, какие ползунки показывать и что
 * передать в `create`.
 *
 * Сами движки не пересекаются и общего кода не имеют: пирамида — raymarching
 * по SDF, созвездие — точки и нити, лава — поле метаболлов, облако —
 * three.js и сэмплирование поверхности, портрет — gl.POINTS из пикселей.
 */
import {
  CONSTELLATION_THEME_COLORS,
  IMAGE_PARTICLES_THEME_LOOK,
  METABALLS_THEME_LOOK,
  PARTICLES_THEME_LOOK,
  PYRAMID_THEME_LOOK,
} from '~/utils/widgetThemeLook'

export type WidgetParams = Record<string, unknown>

export interface WidgetControl {
  key: string
  min: number
  max: number
  step: number
}

export interface WidgetControlGroup {
  id: string
  controls: readonly WidgetControl[]
}

/* Минимальный контракт виджета, на который опирается оболочка. `recolor`
   есть только у звёздного поля — оно умеет менять цвета, не пересоздавая
   точки. */
export interface WidgetDemoInstance {
  set: (patch: WidgetParams) => void
  start: () => void
  stop: () => void
  destroy: () => void
  detach: () => void
  reattach: (el: HTMLElement) => void
  recolor?: (palette: string[], linkColor?: string, auraColor?: string, coreColor?: string) => void
}

export interface WidgetFactory {
  create: (el: HTMLElement, options: WidgetParams) => unknown
}

/** Данные кейса, доступные описанию при сборке опций `create`. */
export interface WidgetCreateContext {
  /** `demo` из контента кейса: модель, картинка-донор, логотип. */
  demo: Record<string, unknown>
  /** Узкий экран (<1024): для него ниже потолки dpr и площади буфера. */
  narrow: boolean
}

export interface WidgetDemoSpec {
  /** Загрузка движка отдельным чанком: на странице живёт только свой. */
  load: () => Promise<{ default: WidgetFactory }>
  /** Группы ползунков лаборатории — зеркало API движка. */
  groups: readonly WidgetControlGroup[]
  /** Дефолты, повторяющие `DEFAULTS` движка. Поверх ложится `demo.params`. */
  defaults?: Record<string, number>
  /** Значения темы, которые уходят в параметры и меняются через `set`. */
  themeLook?: (light: boolean) => WidgetParams
  /** Значения темы, нужные только при `create` (цвета звёздного поля). */
  createTheme?: (light: boolean) => WidgetParams
  /** Смена темы без пересоздания: звёздное поле перекрашивается `recolor`. */
  applyTheme?: (instance: WidgetDemoInstance, light: boolean) => void
  /** Опции `create`, зависящие от кейса: модель, донор, логотип. */
  createOptions?: (ctx: WidgetCreateContext) => WidgetParams
  /** Последняя правка параметров перед отправкой в движок. */
  mapParams?: (merged: WidgetParams, tuned: Record<string, number>, demo: Record<string, unknown>) => WidgetParams
  /** Стартовое значение ползунка, если оно лежит не плоским ключом. */
  readInitial?: (key: string, params: WidgetParams) => number | undefined
  /** Ключ localStorage лаборатории. Без него настройки живут в памяти сессии. */
  storageKey?: string
  /** Префикс для подписей ползунков: разводит одноимённые ключи разных
      виджетов (`drift` — вращение у пирамиды, полёт звёзд у поля). */
  labelPrefix?: string
  /** Движок не запускается сам — нужен явный `start()`. */
  needsStart?: boolean
  /** Переприменять конфиг при перецеплении из кэша. Звёздному полю нельзя:
      `set` с `countMult` пересоздал бы массив точек и «перемешал» поле. */
  reapplyOnReattach?: boolean
  /** Гасить поле под текстом в полноэкранном режиме. Нужно тем, кто заливает
      большие плотные пятна: в светлой теме «чернильные» капли лавы попадают
      под такой же тёмный текст и заголовок пропадает. Разреженному звёздному
      полю не нужно — буквы читаются прямо по нему. */
  bleedScrim?: boolean
  /** Подпись под панелью: сколько объектов получится при текущих настройках. */
  estimate?: (stage: { w: number, h: number }, value: (key: string) => number) => number | null
}

/* Одинаковые для всех движков потолки производительности. */
function perfOptions(narrow: boolean, budget = 2.2e6): WidgetParams {
  return {
    ratioCap: narrow ? 1.5 : 2,
    pixelBudget: narrow ? budget : 2.2e6,
    pauseOffscreen: true,
    respectReducedMotion: true,
  }
}

/* Звёздное поле: плотность задана на площадь, `countMult` лишь умножает
   стандарт — поэтому опорный квадрат живёт здесь, а не в ползунках. */
const DENSITY_STD = 6
const DENSITY_TILE = 100
const MIN_STARS = 30
const MAX_STARS = 2000

const HUES_KEY = /^hues([0-2])$/

export const WIDGET_DEMO_SPECS: Record<string, WidgetDemoSpec> = {
  'pyramid': {
    load: () => import('~/utils/gluke-pyramid.js') as unknown as Promise<{ default: WidgetFactory }>,
    labelPrefix: 'pyramid',
    themeLook: light => PYRAMID_THEME_LOOK[light ? 'light' : 'dark'],
    groups: [
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
    ],
    createOptions: ({ demo, narrow }) => ({
      /* Логотип кейса вплавляется во все четыре грани. */
      marks: demo.logo ? [demo.logo, demo.logo, demo.logo, demo.logo] : [],
      ...perfOptions(narrow, 0.7e6),
      pointer: true,
      pointerFrom: 'window',
    }),
    /* Три ползунка оттенка — это один массив `hues` в API движка: плоские
       hues0/1/2 в него не уходят. */
    mapParams: (merged, tuned, demo) => {
      const hues = [...(((demo.params as WidgetParams | undefined)?.hues as number[] | undefined) ?? [0, 1, 2])]
      let touched = false
      for (let i = 0; i < 3; i++) {
        const value = tuned[`hues${i}`]
        if (typeof value === 'number') {
          hues[i] = value
          touched = true
        }
      }
      const base = Object.fromEntries(
        Object.entries(merged).filter(([key]) => !HUES_KEY.test(key)),
      ) as WidgetParams
      if (touched) base.hues = hues
      return base
    },
    readInitial: (key, params) => {
      const match = HUES_KEY.exec(key)
      if (!match) return undefined
      return (params.hues as number[] | undefined)?.[Number(match[1])] ?? 0
    },
  },

  'constellation': {
    load: () => import('~/utils/constellation.js') as unknown as Promise<{ default: WidgetFactory }>,
    needsStart: true,
    /* Конфиг при перецеплении не переприменяем: `set` с countMult/size
       пересоздал бы массив точек, а инстанс и так помнит свои параметры. */
    reapplyOnReattach: false,
    createTheme: light => ({ ...CONSTELLATION_THEME_COLORS[light ? 'light' : 'dark'] }),
    applyTheme: (instance, light) => {
      const c = CONSTELLATION_THEME_COLORS[light ? 'light' : 'dark']
      instance.recolor?.(c.palette, c.linkColor, c.auraColor, c.coreColor)
    },
    defaults: {
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
    },
    createOptions: () => ({ density: DENSITY_STD, densityTile: DENSITY_TILE }),
    estimate: (stage, value) => {
      const area = stage.w * stage.h
      if (!area) return null
      const n = Math.round(area * (DENSITY_STD / (DENSITY_TILE * DENSITY_TILE)) * value('countMult'))
      return Math.max(MIN_STARS, Math.min(MAX_STARS, n))
    },
    groups: [
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
    ],
  },

  'metaballs': {
    load: () => import('~/utils/gluke-metaballs.js') as unknown as Promise<{ default: WidgetFactory }>,
    storageKey: 'gluke-metaballs-v4',
    bleedScrim: true,
    themeLook: light => METABALLS_THEME_LOOK[light ? 'light' : 'dark'],
    defaults: {
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
    },
    createOptions: ({ narrow }) => ({
      ...perfOptions(narrow, 0.7e6),
      /* Тач ведёт лаву так же, как курсор; вертикальный свайп остаётся
         у страницы — канвасу проставляется touch-action: pan-y. */
      pointer: true,
      pointerFrom: 'window',
    }),
    groups: [
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
    ],
  },

  'particles': {
    load: () => import('~/utils/gluke-particles.js') as unknown as Promise<{ default: WidgetFactory }>,
    storageKey: 'gluke-particles-v3',
    themeLook: light => PARTICLES_THEME_LOOK[light ? 'light' : 'dark'],
    defaults: {
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
    },
    createOptions: ({ demo, narrow }) => ({
      /* Модель задаёт кейс: движок сэмплирует любую. */
      model: demo.model,
      ...perfOptions(narrow, 0.7e6),
      /* Вращение перетаскиванием, как у 3D-вьюверов сайта. */
      drag: true,
    }),
    groups: [
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
    ],
  },

  'image-particles': {
    load: () => import('~/utils/gluke-image-particles.js') as unknown as Promise<{ default: WidgetFactory }>,
    themeLook: light => IMAGE_PARTICLES_THEME_LOOK[light ? 'light' : 'dark'],
    defaults: {
      density: 1,
      dotSize: 1.6,
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
    },
    createOptions: ({ demo, narrow }) => ({
      /* Картинку-донор задаёт кейс. */
      src: demo.src,
      ...perfOptions(narrow, 0.9e6),
      pointer: true,
      pointerFrom: 'window',
    }),
    groups: [
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
    ],
  },
}

export function widgetDemoSpec(widget: string | null | undefined): WidgetDemoSpec | null {
  if (!widget) return null
  return WIDGET_DEMO_SPECS[widget] ?? null
}
