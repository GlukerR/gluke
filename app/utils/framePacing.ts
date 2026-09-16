/*
 * Частота кадров и цена кадра для вьюверов сайта.
 *
 * Два независимых сюжета, которые раньше решались по месту и оба неправильно:
 *
 * 1. Лимит «не чаще N кадров в секунду» отмерялся от момента последнего
 *    отрисованного кадра (`now - lastRender < interval → пропуск`). Остаток
 *    при этом терялся: при шаге rAF 16,6 мс интервал 33,33 мс не набирался
 *    (33,2 < 33,33), кадр пропускался снова, и лимит 30 fps превращался в 20.
 *    Здесь интервал прибавляется к плановому моменту, поэтому средняя частота
 *    ровно заданная, а субкадровый остаток переносится.
 *
 * 2. Число физических пикселей кадра складывалось из масштаба канваса и
 *    devicePixelRatio без общего потолка: большой блок на телефоне с DPR 3
 *    рисовал вчетверо больше пикселей, чем маленький, хотя полезной разницы
 *    в картинке не было. Бюджет считает долю DPR, при которой кадр укладывается
 *    в заданное число физических пикселей.
 */

/*
 * 3. Признак «камера ещё едет» брался из ответа `OrbitControls.update()`.
 *    В three 0.185 этот метод возвращает true и при полностью неподвижной
 *    камере (внутренняя книга зума), поэтому цикл гаража не засыпал никогда:
 *    замер показал 60 кадров в секунду и 7700 draw-вызовов за 2 с в покое.
 *    Позу камеры сравниваем сами: положение и поворот со снимком прошлого
 *    кадра.
 */

export interface CameraPose {
  position: { x: number, y: number, z: number }
  quaternion: { x: number, y: number, z: number, w: number }
}

/** Сколько чисел в снимке позы: три координаты и четыре компоненты поворота. */
export const CAMERA_POSE_LENGTH = 7

/* Допуск сравнения позы в мировых единицах и долях кватерниона. Сцена гаража
   размером в несколько единиц: 1e-4 не видно глазом, но движение, которое
   стоит рисовать, заведомо больше. */
const POSE_EPSILON = 1e-4

/** Матрица позы камеры: положение и поворот. */
export function writeCameraPose(camera: CameraPose, snapshot: Float64Array): void {
  const { position: p, quaternion: q } = camera
  snapshot[0] = p.x
  snapshot[1] = p.y
  snapshot[2] = p.z
  snapshot[3] = q.x
  snapshot[4] = q.y
  snapshot[5] = q.z
  snapshot[6] = q.w
}

/** Сдвинулась ли камера относительно снимка больше, чем на допуск. */
export function cameraPoseChanged(
  camera: CameraPose,
  snapshot: Float64Array | null,
  tolerance = POSE_EPSILON,
): boolean {
  if (!snapshot) return true
  const { position: p, quaternion: q } = camera
  return Math.abs(p.x - snapshot[0]!) > tolerance
    || Math.abs(p.y - snapshot[1]!) > tolerance
    || Math.abs(p.z - snapshot[2]!) > tolerance
    || Math.abs(q.x - snapshot[3]!) > tolerance
    || Math.abs(q.y - snapshot[4]!) > tolerance
    || Math.abs(q.z - snapshot[5]!) > tolerance
    || Math.abs(q.w - snapshot[6]!) > tolerance
}

export interface FrameLimiter {
  /** Пора ли рисовать кадр в момент `now` (performance.now()). */
  shouldRender(now: number): boolean
  /* Сброс после паузы: цикл начинается с нового кадра, а не догоняет
     пропущенные — иначе после возврата на вкладку идёт пачка кадров. */
  reset(now: number): void
}

export function createFrameLimiter(fps: number): FrameLimiter {
  const interval = 1000 / Math.max(1, fps)
  /* -Infinity — «кадров ещё не было»: первый вызов рисует сразу и только
     тогда заводит план. Ноль в качестве начального плана дал бы NaN на
     первом кадре (now - (-Infinity)). */
  let nextAt = Number.NEGATIVE_INFINITY

  return {
    shouldRender(now) {
      if (now < nextAt) return false
      const base = Number.isFinite(nextAt) ? nextAt : now
      /* Плановый момент перескакивает пропущенные слоты целиком: длинная
         пауза не оборачивается очередью кадров. Допуск 1e-3 гасит двоичную
         пыль (ровно 29 интервалов может вычислиться как 28,999999999999996
         и сдвинуть следующий кадр на интервал раньше). */
      const steps = Math.max(1, Math.floor((now - base) / interval + 1e-3) + 1)
      nextAt = base + steps * interval
      return true
    },
    reset(now) {
      nextAt = now
    },
  }
}

export interface PixelRatioInput {
  /** Размер кадра в CSS-пикселях. */
  cssWidth: number
  cssHeight: number
  /** window.devicePixelRatio. */
  dpr: number
  /* Потолок по типу устройства: на телефоне 2× — это уже вчетверо больше
     пикселей, чем нужно модели, которая занимает пол-экрана. */
  cap: number
  /** Потолок физических пикселей кадра. */
  budget: number
  /* Нижняя граница плотности. По умолчанию 0,5; вьюверам нужна единица:
     ниже неё картинка мылится сильнее, чем того стоит экономия. */
  floor?: number
  /* Множитель от регулятора качества (createQualityGovernor): 1 — полная
     плотность. Когда устройство не успевает, он опускает и саму плотность, и
     её нижнюю границу — но не ниже 0,75: дальше модель превращается в кашу. */
  scale?: number
}

/** Доля devicePixelRatio, при которой кадр укладывается в бюджет пикселей. */
export function physicalPixelRatio({ cssWidth, cssHeight, dpr, cap, budget, floor = 0.5, scale = 1 }: PixelRatioInput): number {
  const area = cssWidth * cssHeight
  if (!(area > 0)) return 1
  const byBudget = Math.sqrt(budget / area)
  const ratio = Math.min(dpr, cap, byBudget) * scale
  const low = scale < 1 ? Math.min(floor, Math.max(MIN_DEGRADED_RATIO, floor * scale)) : floor
  /* Округление вниз: бюджет — это потолок, превышать его нельзя ни на один
     процент. */
  return Math.max(low, Math.floor(ratio * 100) / 100)
}

const MIN_DEGRADED_RATIO = 0.75

/*
 * Регулятор качества по времени кадра.
 *
 * Бюджет пикселей фиксированный и рассчитан на обычное железо. Если устройство
 * не успевает рисовать кадр, лучше чуть снизить плотность, чем дёргаться.
 * Трудность в том, что частоту кадров нельзя сравнивать с константой: экран
 * 30 Гц (режим энергосбережения) и перегруженный GPU на 60 Гц дают одинаковые
 * 33 мс, а наивный регулятор снизил бы качество там, где оно не мешало.
 *
 * Поэтому опорой служит сам экран: в окне из `window` интервалов между
 * вызовами rAF берётся нижний дециль — это период обновления, который
 * устройство способно выдерживать. Опоздавшим считается интервал длиннее
 * `lateFactor` периодов. Если опоздавших не меньше `lateShare` в `patience`
 * окнах подряд, плотность опускается на ступень. Обратно не поднимается: на
 * границе регулятор качался бы туда-сюда, и каждая смена размера буфера —
 * заметный рывок.
 *
 * Считаются все вызовы rAF, а не только отрисованные кадры: вьюверы в покое
 * держат 30 кадров из 60, и опаздывает как раз вызов после тяжёлого кадра.
 * Сознательно консервативно: устройство, которое не успевает ни одного кадра,
 * даёт ровные 33 мс и снижения не получит — лучше пропустить слабое место,
 * чем испортить картинку на исправном.
 */
export interface QualityGovernorOptions {
  /** Ступени множителя плотности, от полной к самой низкой. */
  steps?: number[]
  /** Сколько интервалов в окне. */
  window?: number
  lateFactor?: number
  lateShare?: number
  patience?: number
}

export interface QualityGovernor {
  /** Отметить вызов rAF в момент `now`; true — множитель только что сменился. */
  sample(now: number): boolean
  /** Текущий множитель плотности. */
  scale(): number
  /* Разрыв последовательности: цикл остановлен, вкладка скрыта, сменился
     размер буфера. Промежуток не должен посчитаться опозданием. */
  pause(): void
}

/* Интервал длиннее — это не опоздание кадра, а пауза (скрытая вкладка,
   остановленный цикл, модальный диалог). */
const GAP_MS = 250

export function createQualityGovernor(options: QualityGovernorOptions = {}): QualityGovernor {
  const steps = options.steps ?? [1, 0.85, 0.7]
  const size = Math.max(8, options.window ?? 60)
  const lateFactor = options.lateFactor ?? 1.5
  const lateShare = options.lateShare ?? 0.25
  const patience = Math.max(1, options.patience ?? 2)

  const intervals = new Float64Array(size)
  let count = 0
  let last = Number.NaN
  let strikes = 0
  let level = 0

  const pause = () => {
    last = Number.NaN
    count = 0
  }

  return {
    sample(now) {
      const prev = last
      last = now
      if (!Number.isFinite(prev)) return false
      const dt = now - prev
      if (!(dt > 0) || dt > GAP_MS) {
        count = 0
        return false
      }
      intervals[count++] = dt
      if (count < size) return false
      count = 0

      const sorted = Array.from(intervals).sort((a, b) => a - b)
      const period = sorted[Math.floor(size * 0.1)]!
      let late = 0
      for (const value of sorted) if (value > period * lateFactor) late++
      strikes = late >= size * lateShare ? strikes + 1 : 0
      if (strikes < patience || level >= steps.length - 1) return false

      strikes = 0
      level++
      /* Новый размер буфера сам даёт рывок — его в следующее окно не берём. */
      pause()
      return true
    },
    scale: () => steps[level]!,
    pause,
  }
}
