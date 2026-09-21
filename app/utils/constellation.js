/*!
 * GLUKE Constellation — интерактивное звёздное поле на чистом WebGL,
 * без зависимостей и сборки.
 *
 * Автор: Александр Глухов (GLUKE, https://gluke.ru, @Gluke_art).
 * © GLUKE, 2026. Свободное использование и доработка допускаются с сохранением
 * этой шапки и ссылки на gluke.ru; перепродажа движка как самостоятельного
 * продукта или выдача его за чужую разработку — без письменного согласия
 * автора. При сомнениях — gluke_art@mail.ru.
 *
 * Звёзды не стоят на месте: каждая летит в свою сторону — медленно и с плавно
 * меняющимся курсом, так что траектории хаотичны, но спокойны. Покинув край,
 * звезда появляется с противоположного, и поле всегда остаётся заполненным.
 * Пары, оказавшиеся ближе порога, соединяются тонкими светящимися нитями;
 * курсор — «тёплая рука»: нити возле него разгораются, а ближние звёзды
 * мягко отступают в сторону.
 *
 * Один кадр — два прохода одной парой шейдеров:
 *   — звёзды рисуются как GL_POINTS с мягким кругом-гало во фрагменте;
 *   — связи собираются на CPU (соседи ищутся по сетке ячеек, см.
 *     collectLinks) и идут как GL_LINES.
 *
 * Координаты: позиции ведутся в CSS-пикселях контейнера, а в буфер уходят
 * в физических пикселях (CSS × масштаб dpr) — шейдер делит позицию на
 * физический размер viewport.
 *
 *   Constellation.create(el, { palette: ['#7dd3fc', '#818cf8', '#e879f9'] })
 */

import { attachRunSources, createRunGate } from './widgetRunGate'

const DEFAULTS = {
  // --- звёзды ---
  /* Плотность: сколько звёзд в среднем на опорный квадрат (по умолчанию
     100×100 CSS px). Число звёзд на экране считается по площади контейнера,
     поэтому поле одинаково «плотное» на телефоне и на десктопе. */
  density: 6, // звёзд на опорный квадрат
  densityTile: 100, // сторона опорного квадрата (CSS px)
  countMult: 1.35, // множитель поверх density: итог — 8 звёзд на опорный квадрат
  size: 2.1, // базовый радиус (px, до dpr)
  sizeSpread: 3.95, // разброс размеров: 0 — все одинаковые, 1 — пыль и крупные
  twinkle: 0.5, // сила мерцания (0 — статичные)

  // --- движение ---
  drift: 0.45, // скорость полёта: 0 — стоят, 1 — неторопливый дрейф
  wander: 2.0, // как быстро звёзды меняют курс (хаотичность траекторий)
  speedSpread: 3.25, // разброс скоростей: 0 — все одинаковые
  edgePad: 0.06, // отступ от края, доля размера

  // --- связи ---
  linkDist: 1.48, // порог связи, в средних расстояниях между звёздами
  linkAlpha: 0.1, // базовая непрозрачность нити (0 — нити выключены)
  linkColor: '#a5b4fc',

  // --- курсор ---
  pointer: true,
  /* Радиус действия «тёплой руки» — зона расталкивания и разогрева нитей.
     Размер самой планеты управляется отдельно (`planetRadius`), эти два
     параметра не спаяны. */
  cursorRadius: 0.32, // радиус действия, доля меньшей стороны
  cursorPull: 0.25, // насколько нити возле курсора разгораются
  cursorRepel: 0.7, // насколько звёзды отступают от курсора
  cursorObject: true, // рисовать курсор-«планету» (false — только расталкивание)
  planetRadius: 0.07, // размер планеты: радиус ауры, доля меньшей стороны

  // --- палитра ---
  palette: ['#7dd3fc', '#818cf8', '#e879f9'],
  /* Цвета курсора-«планеты» вынесены в параметры, чтобы компонент мог
     адаптировать их к теме сайта (тёмная/светлая). Аура — мягкий индиго,
     ядро — почти белое. */
  auraColor: '#818cf8',
  coreColor: '#e0e7ff',

  // --- бюджет ---
  dprCap: 2,
  pixelBudget: 2.2e6,
  pauseOffscreen: true,
  honorReducedMotion: true,
}

function clamp(v, a, b) {
  if (v < a) return a
  return v > b ? b : v
}

/* Плотность, а не фиксированное число: сколько звёзд в среднем приходится
   на опорный квадрат (по умолчанию 100×100 CSS px). Звёзды не привязаны
   к сетке квадратов — просто число точек пропорционально площади, которую
   заполняет поле. */
const MIN_STARS = 30
const MAX_STARS = 2000

/* Гладкая ступенька: 0 ниже e0, 1 выше e1, между ними — плавный переход
   с нулевыми производными на концах (без «щелчков»). */
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/* Разница на торе: |результат| ≤ size/2 — всегда «ближайший путь» между
   точками, даже если они у противоположных краёв поля. */
function wrapDelta(d, size) {
  const m = d % size
  return m > size / 2 ? m - size : m < -size / 2 ? m + size : m
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const int = parseInt(n, 16)
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255]
}

/* Разбор цвета в кадре — только из кэша: нити, аура и ядро планеты берут
   цвет из опций каждый кадр, а строк там считаные единицы. Массив общий,
   менять его нельзя. */
const RGB_CACHE = new Map()
function rgbOf(hex) {
  let rgb = RGB_CACHE.get(hex)
  if (!rgb) {
    rgb = hexToRgb(hex)
    RGB_CACHE.set(hex, rgb)
  }
  return rgb
}

/* Хранилище нитей кадра: плоские типизированные массивы вместо объекта на
   каждую пару. Растёт удвоением и между кадрами не пересоздаётся — раньше
   каждый кадр рождал сотни объектов-связей и отдавал их сборщику мусора. */
export function createLinkStore() {
  return {
    count: 0,
    a: new Int32Array(256),
    b: new Int32Array(256),
    alpha: new Float32Array(256),
    kx: new Int8Array(256),
    ky: new Int8Array(256),
    cellStart: new Int32Array(0),
    cellItems: new Int32Array(0),
    cellOf: new Int32Array(0),
  }
}

function pushLink(store, i, j, alpha, kx, ky) {
  if (store.count === store.a.length) {
    const cap = store.a.length * 2
    const grow = (Arr, from) => {
      const next = new Arr(cap)
      next.set(from)
      return next
    }
    store.a = grow(Int32Array, store.a)
    store.b = grow(Int32Array, store.b)
    store.alpha = grow(Float32Array, store.alpha)
    store.kx = grow(Int8Array, store.kx)
    store.ky = grow(Int8Array, store.ky)
  }
  const k = store.count++
  store.a[k] = i
  store.b[k] = j
  store.alpha[k] = alpha
  store.kx[k] = kx
  store.ky[k] = ky
}

/*
 * Нити поля: пары звёзд ближе `linkR` по тору.
 *
 * Раньше сравнивались все пары: при потолке 2000 звёзд — почти 2 млн проверок
 * на кадр, и цена росла квадратом площади блока. Теперь звёзды раскладываются
 * по сетке ячеек со стороной не меньше `linkR`: сосед ближе порога может
 * лежать только в своей или одной из восьми соседних ячеек (с переходом через
 * края — поле замкнуто). Проверок остаётся порядка 20 на звезду при любом
 * размере поля. Раскладка — сортировка подсчётом по массивам, которые живут
 * в `store` между кадрами.
 *
 * Если ячеек меньше трёх по стороне, соседние ячейки совпали бы через край,
 * и одна пара проверялась бы дважды, — там звёзд мало, и честный перебор
 * дешевле.
 */
export function collectLinks(pts, w, h, linkR, linkAlpha, store) {
  store.count = 0
  const n = pts.length
  /* Нить не ярче `linkAlpha`, а тусклее 0,02 не рисуется: при таком пороге
     связей не будет вовсе, считать их незачем. */
  if (n < 2 || !(linkR > 0) || !(linkAlpha >= 0.02)) return store
  const distSq = linkR * linkR

  const consider = (i, j) => {
    const a = pts[i]
    const b = pts[j]
    /* Ближайший образ второй точки на торе; kx/ky — через какой край
       идёт связь, чтобы отрисовать её двумя сегментами у шва. */
    const dx = wrapDelta(b.x - a.x, w)
    const dy = wrapDelta(b.y - a.y, h)
    const d2 = dx * dx + dy * dy
    if (d2 > distSq) return
    /* Затухание плавное, но щедрое: до 65% радиуса нить светит в полную
       силу, дальше — мягкий smoothstep-спад к нулю у порога. Так связи не
       «щелкают» при расхождении пар и не гаснут на середине дистанции. */
    const alpha = linkAlpha * (1 - smoothstep(0.65, 1, Math.sqrt(d2) / linkR))
    if (alpha < 0.02) return
    pushLink(store, i, j, alpha, Math.round((b.x - a.x) / w), Math.round((b.y - a.y) / h))
  }

  const cols = Math.floor(w / linkR)
  const rows = Math.floor(h / linkR)
  if (cols < 3 || rows < 3) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) consider(i, j)
    }
    return store
  }

  const cells = cols * rows
  if (store.cellStart.length < cells + 1) store.cellStart = new Int32Array(cells + 1)
  else store.cellStart.fill(0, 0, cells + 1)
  if (store.cellOf.length < n) {
    store.cellOf = new Int32Array(n)
    store.cellItems = new Int32Array(n)
  }
  const start = store.cellStart
  const cellOf = store.cellOf
  const items = store.cellItems
  const cellW = w / cols
  const cellH = h / rows

  /* Звезда может стоять чуть за краем (облёт в _step срабатывает с запасом
     6 px), поэтому ячейку берём от координаты, приведённой в [0, w). */
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const cx = Math.min(cols - 1, Math.floor((((p.x % w) + w) % w) / cellW))
    const cy = Math.min(rows - 1, Math.floor((((p.y % h) + h) % h) / cellH))
    const c = cy * cols + cx
    cellOf[i] = c
    start[c + 1]++
  }
  for (let c = 0; c < cells; c++) start[c + 1] += start[c]
  /* Раскладка: start[c] служит курсором записи и после цикла указывает на
     конец ячейки — сдвигаем на одну позицию, и он снова начало. */
  for (let i = 0; i < n; i++) items[start[cellOf[i]]++] = i
  for (let c = cells; c > 0; c--) start[c] = start[c - 1]
  start[0] = 0

  for (let i = 0; i < n; i++) {
    const c = cellOf[i]
    const cx = c % cols
    const cy = (c - cx) / cols
    for (let oy = -1; oy <= 1; oy++) {
      const row = ((cy + oy + rows) % rows) * cols
      for (let ox = -1; ox <= 1; ox++) {
        const nc = row + (cx + ox + cols) % cols
        for (let k = start[nc], end = start[nc + 1]; k < end; k++) {
          const j = items[k]
          /* Каждая пара встречается дважды — берём её у младшей звезды. */
          if (j > i) consider(i, j)
        }
      }
    }
  }
  return store
}

/* Формат вершины: aPos(2) + aColor(3) + aAlpha(1) + aSize(1), 28 байт. */
const VERT = `
  attribute vec2  aPos;     // физические px, y вверх
  attribute vec3  aColor;
  attribute float aAlpha;
  attribute float aSize;
  uniform   vec2  uViewport; // физический размер буфера в px
  varying   vec3  vColor;
  varying   float vAlpha;
  void main() {
    vec2 clip = (aPos / uViewport) * 2.0 - 1.0;
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = aSize;
    vColor = aColor;
    vAlpha = aAlpha;
  }
`

/* Звёзды — мягкий круг: ядро яркое, к краю гасится квадратично, так что
   соседние точки складываются в светящиеся сгустки без резких пиксельных
   границ. Цвет уходит предумноженным на альфу (блендинг ONE, 1−SRC_ALPHA). */
const POINT_FRAG = `
  precision mediump float;
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor * (vAlpha * a), vAlpha * a);
  }
`

/* Нити — GL_LINES: фрагмент один на весь отрезок, прозрачность уже посчитана
   на CPU (зависит от длины и близости к курсору). Цвет предумножен. */
const LINE_FRAG = `
  precision mediump float;
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor * vAlpha, vAlpha);
  }
`

function compile(gl, type, source) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, source)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Constellation shader: ' + gl.getShaderInfoLog(sh))
  }
  return sh
}

function buildProgram(gl, vertSrc, fragSrc) {
  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vertSrc))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragSrc))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Constellation link: ' + gl.getProgramInfoLog(prog))
  }
  return prog
}

const STRIDE = (2 + 3 + 1 + 1) * 4 // 28 байт
/* Раскладка вершины: имя атрибута, число компонент, смещение в байтах. */
const ATTRIBS = [
  ['aPos', 2, 0],
  ['aColor', 3, 8],
  ['aAlpha', 1, 20],
  ['aSize', 1, 24],
]

class Constellation {
  constructor(container, options) {
    const el = typeof container === 'string' ? document.querySelector(container) : container
    if (!el) throw new Error('Constellation: контейнер не найден')

    this.el = el
    this.opts = { ...DEFAULTS, ...(options || {}) }
    this.paused = true
    this._raf = 0
    this._lastMs = 0
    /* Сторож кадров живёт вместе с виджетом (переживает detach/reattach),
       а источники и подписка создаются в _bind(). */
    this._gate = null
    this._gateOff = null
    this._sources = null
    this.cursor = null

    if (this.opts.honorReducedMotion
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      /* Движение отключено: звёзды стоят и тихо мерцают, курсор ничего
         не расталкивает. Само поле остаётся — оно не мешает чтению. */
      this.opts.drift = 0
      this.opts.wander = 0
      this.opts.twinkle = 0.4
      this.opts.cursorRepel = 0
      this.opts.cursorPull = 0
    }

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;'
    el.appendChild(this.canvas)

    const gl = this.canvas.getContext('webgl', {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
    })
    if (!gl) throw new Error('Constellation: WebGL недоступен')
    this.gl = gl

    /* Две программы: у звёзд свой фрагмент с gl_PointCoord. */
    this.progPoints = buildProgram(gl, VERT, POINT_FRAG)
    this.progLines = buildProgram(gl, VERT, LINE_FRAG)

    this._viewLoc = new Map()
    for (const prog of [this.progPoints, this.progLines]) {
      this._viewLoc.set(prog, gl.getUniformLocation(prog, 'uViewport'))
    }

    this.buffer = gl.createBuffer()
    this.points = null
    this._links = createLinkStore()
    /* Буферы кадра переиспользуются: см. _scratch. */
    this._starFloats = null
    this._lineFloats = null
    this._orb = new Float32Array(2 * 7)
    this._attribLoc = new Map()

    this._bind()
    /* Размер нужен до расстановки звёзд: позиции живут в пикселях контейнера. */
    this._resize()
    this._initPoints()
  }

  /* --- геометрия --- */

  /* Сколько звёзд нужно при текущем размере контейнера: число пропорцио-
     нально заполняемой площади — плотность × площадь ÷ площадь опорного
     квадрата × множитель. Отдельные звёзды по квадратам не раскладываются:
     это только средняя норма на площадь. */
  _desiredCount() {
    const tile = Math.max(1, this.opts.densityTile || 100)
    const perArea = this.opts.density / (tile * tile)
    const mult = this.opts.countMult ?? 1
    return clamp(Math.round(this.w * this.h * perArea * mult), MIN_STARS, MAX_STARS)
  }

  /* Среднее расстояние между соседними звёздами (CSS px) при текущей
     плотности: корень из площади, приходящейся на одну звезду. */
  _starPitch() {
    const tile = Math.max(1, this.opts.densityTile || 100)
    const perArea = (this.opts.density / (tile * tile)) * (this.opts.countMult ?? 1)
    return perArea > 0 ? Math.sqrt(1 / perArea) : tile
  }

  /* Звёзды в пиксельных координатах контейнера (CSS px, y вниз), у каждой —
     курс (heading), своя скорость и свой размер. Курс меняется плавно-хаотично
     (см. _step), поэтому отдельные якоря не нужны: движение накапливается само.
     Позиции занимают весь контейнер от края до края: никакого отступа,
     иначе с первого кадра по периметру видна пустая кромка. Переход через
     края бесшовный (облёт в _step + дубль-копии в _draw).
     У каждой звезды хранится её индекс на палитре (`palT`): recolor() может
     перекрасить поле под новую тему без пересоздания точек. */
  _initPoints() {
    const opts = this.opts
    const n = this._desiredCount()
    const pal = opts.palette.map(hexToRgb)
    const w = this.w
    const h = this.h
    this.points = Array.from({ length: n }, () => {
      const t = Math.random()
      // Цвет из палитры с плавным переходом между соседними индексами.
      const seg = clamp(t, 0, 0.999) * (pal.length - 1)
      const i = Math.floor(seg)
      const k = seg - i
      const c0 = pal[i]
      const c1 = pal[Math.min(i + 1, pal.length - 1)]
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        /* Курс: случайное направление; медленное блуждание курса даёт
           «хаотичный, но спокойный» полёт, а не жёсткие зигзаги. */
        heading: Math.random() * Math.PI * 2,
        /* Разброс скоростей: какие-то звёзды плывут заметно быстрее, какие-то
           почти стоят — поле живёт с разной глубиной, как снег или пыль. */
        speed: 1 - opts.speedSpread / 2 + Math.random() * opts.speedSpread,
        /* Индекс на палитре: при recolor() берём тот же t с новой палитрой,
           и относительное распределение цветов сохраняется. */
        palT: t,
        color: [
          c0[0] + (c1[0] - c0[0]) * k,
          c0[1] + (c1[1] - c0[1]) * k,
          c0[2] + (c1[2] - c0[2]) * k,
        ],
        /* Разброс размеров: мелкая пыль и редкие крупные звёзды дают глубину. */
        size: opts.size * (1 - opts.sizeSpread / 2 + Math.random() * opts.sizeSpread),
      }
    })
    this._links.count = 0
  }

  /* --- слушатели --- */

  _bind() {
    const ctx = this
    /* Раньше здесь стоял гейт `(pointer: fine)`, и на телефоне не вешалось
       ни одного слушателя — поле выглядело неинтерактивной картинкой.
       Pointer Events покрывают и касание, поэтому гейт снят: палец ведёт
       «планету» так же, как курсор. Вертикальный свайп остаётся у страницы —
       канвасу проставляется touch-action: pan-y. */
    if (this.opts.pointer) {
      const move = (e) => {
        const r = ctx.el.getBoundingClientRect()
        ctx.cursor = {
          x: (e.clientX - r.left) / r.width,
          y: (e.clientY - r.top) / r.height,
        }
      }
      const leave = () => {
        ctx.cursor = null
      }
      this.el.addEventListener('pointermove', move, { passive: true })
      this.el.addEventListener('pointerleave', leave)
      /* После отрыва пальца указателя больше нет: без этого «планета»
         осталась бы висеть там, где касание закончилось. */
      this.el.addEventListener('pointerup', leave)
      this.el.addEventListener('pointercancel', leave)
      this._handlers = { move, leave }
    }
    else {
      this.cursor = null
    }

    /* Останавливаем цикл, когда блока нет в окне: поле тихое, считать его вне
       экрана незачем. Раньше цикл продолжал тикать, а _loop сам пропускал
       кадры; теперь пауза и возобновление — одно решение сторожа
       (utils/widgetRunGate), как у остальных движков. */
    if (!this._gate) {
      this._gate = createRunGate({ pauseOffscreen: this.opts.pauseOffscreen })
    }
    this._gateOff = this._gate.subscribe((run) => {
      if (run) this.start()
      else this.stop()
    })
    this._sources = attachRunSources(this.el, this._gate, {
      pauseOffscreen: this.opts.pauseOffscreen,
    })

    /* Блок может менять размер вместе с раскладкой страницы (окно, колонки):
       следим за контейнером и пересчитываем буфер, иначе канвас растянется
       до нового CSS-размера со старым бэкинг-стором и потеряет резкость.
       Пересчёт дорогой, поэтому троттлим через requestAnimationFrame. */
    if (typeof ResizeObserver !== 'undefined') {
      let pending = false
      this._resizeObserver = new ResizeObserver(() => {
        if (pending) return
        pending = true
        requestAnimationFrame(() => {
          pending = false
          ctx.resize()
        })
      })
      this._resizeObserver.observe(this.el)
    }
  }

  /* --- размер --- */

  _resize() {
    const rect = this.el.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.dprCap)
    let bw = Math.round(w * dpr)
    let bh = Math.round(h * dpr)
    if (bw * bh > this.opts.pixelBudget) {
      const k = Math.sqrt(this.opts.pixelBudget / (bw * bh))
      bw = Math.max(1, Math.round(bw * k))
      bh = Math.max(1, Math.round(bh * k))
    }
    this.w = w
    this.h = h
    this.bw = bw
    this.bh = bh
    this.canvas.width = bw
    this.canvas.height = bh

    const gl = this.gl
    gl.viewport(0, 0, bw, bh)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)
  }

  /* --- физика --- */

  _step(now) {
    /* dt от rAF-таймстампов, а не «один кадр = единица времени»: скорость
       тогда не зависит от частоты кадров. Ограничение сверху страхует от
       скачка после паузы/переключения вкладки. */
    if (!this._lastMs) this._lastMs = now
    const dt = clamp((now - this._lastMs) / 1000, 0, 0.05)
    this._lastMs = now

    const opts = this.opts
    const pts = this.points
    const w = this.w
    const h = this.h
    const minSide = Math.min(w, h)
    const cursor = this.cursor
    const cursorR = opts.cursorRadius * minSide
    /* Радиус связи считаем от среднего расстояния между звёздами, а не от
       стороны кадра. Плотность звёзд задана на площадь и одинакова на любом
       размере, а доля стороны — нет: на маленькой карточке каталога радиус
       выходил вдвое меньше, чем на странице кейса, площадь поиска соседей —
       вчетверо, и то же поле выглядело вчетверо реже. Через среднее
       расстояние сетка нитей одинакова и на карточке, и на всю ширину
       экрана, и не взрывается, когда крутят плотность. */
    const linkR = opts.linkDist * this._starPitch()
    /* Базовая скорость: ~1.5–3% меньшей стороны в секунду при drift 1 —
       медленное «дыхание» поля, которое всё же читается как полёт. */
    const baseSpeed = minSide * (0.006 + 0.018 * opts.drift)

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      /* Курс медленно блуждает: знак и величина шага случайны, но шаг мал,
         поэтому траектория плавная, без резких дёрганий. */
      p.heading += (Math.random() - 0.5) * (0.25 + 1.2 * opts.wander) * dt
      const sp = baseSpeed * p.speed
      p.x += Math.cos(p.heading) * sp * dt
      p.y += Math.sin(p.heading) * sp * dt

      /* Облёт края: звезда ушла за границу — появляется с противоположной
         стороны. Так поле не пустеет и не копится у рамок. */
      if (p.x < -6) p.x = w + 6
      else if (p.x > w + 6) p.x = -6
      if (p.y < -6) p.y = h + 6
      else if (p.y > h + 6) p.y = -6
    }

    /* Отталкивание от курсора: звёзды в радиусе «тёплой руки» отходят,
       но без жёсткого толчка — на границе влияние плавно сходит на нет.
       Дистанция считается по тору (как связи и разогрев нитей): планета
       у края расталкивает звёзды и с противоположной стороны шва — иначе
       нити там вспыхивали бы, а звёзды не расступались. Толчок идёт вдоль
       кратчайшего пути, звезда, ушедшая за край, облетает поле в _step. */
    if (cursor && opts.cursorRepel > 0) {
      const force = opts.cursorRepel * 0.12 * minSide
      const cx = cursor.x * w
      const cy = cursor.y * h
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const dx = wrapDelta(p.x - cx, w)
        const dy = wrapDelta(p.y - cy, h)
        const d = Math.hypot(dx, dy)
        if (d < cursorR && d > 0.001) {
          const f = (1 - d / cursorR) * force
          p.x += (dx / d) * f * dt
          p.y += (dy / d) * f * dt
        }
      }
    }

    /* Связи — по сетке ячеек, см. collectLinks. Расстояние считается по
       тору: пара у левого и правого краёв соединяется так же, как соседи в
       центре, — поле замкнуто, «шва» на границах нет. Разогрев от курсора
       применяется не здесь, а в _draw — к каждому видимому сегменту нити
       отдельно (см. pushSeg). */
    collectLinks(pts, w, h, linkR, opts.linkAlpha, this._links)
  }

  /* --- отрисовка --- */

  _draw(now) {
    const gl = this.gl
    const opts = this.opts
    const t = now / 1000
    const pts = this.points
    const w = this.w
    const h = this.h
    /* CSS px → физические px буфера: шейдер делит позицию на физический
       uViewport, и если отдать CSS-координаты, поле сожмётся в угол при
       devicePixelRatio > 1. */
    const sx = this.bw / w
    const sy = this.bh / h
    const minSide = Math.min(w, h)

    gl.clear(gl.COLOR_BUFFER_BIT)

    /* Звёзды. Тор: у краёв звезда не «телепортируется» рывком, а гаснет
       у одного края и одновременно проявляется с противоположного — на
       границе держится дубль-копия, поле выглядит замкнутым без шва. */
    const progP = this.progPoints
    gl.useProgram(progP)
    gl.uniform2f(this._viewLoc.get(progP), this.bw, this.bh)
    const floats = this._scratch('_starFloats', pts.length * 4 * 7)
    let o = 0
    let count = 0
    const edgeM = opts.edgePad * minSide
    const emit = (cx, cy, cw, cr, cg, cb, ca, cs) => {
      floats[o++] = cx * sx
      floats[o++] = (this.h - cy) * sy // WebGL: y вверх
      floats[o++] = cr
      floats[o++] = cg
      floats[o++] = cb
      floats[o++] = ca * cw
      floats[o++] = cs
      count++
    }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const tw = opts.twinkle > 0
        ? 0.55 + 0.45 * Math.sin(t * (1.2 + (i % 5) * 0.23) + p.heading * 2)
        : 1
      const cr = p.color[0]
      const cg = p.color[1]
      const cb = p.color[2]
      const ca = clamp(tw, 0.15, 1)
      /* Пол ниже 1: без него мелкие звёзды схлопывались в один размер, и вся
         «пыль» выглядела одинаковой. Там, где GPU позволяет, они реально
         меньше крупных. */
      const cs = Math.max(0.5, p.size * tw * sy)

      /* Затухание у каждого края: 0 — далеко, 1 — за границей (после
         облёта в _step позиция уже перепрыгнула, вес сохраняется). */
      const gx = p.x < edgeM
        ? clamp(1 - p.x / edgeM, 0, 1)
        : p.x > w - edgeM ? clamp(1 - (w - p.x) / edgeM, 0, 1) : 0
      const gy = p.y < edgeM
        ? clamp(1 - p.y / edgeM, 0, 1)
        : p.y > h - edgeM ? clamp(1 - (h - p.y) / edgeM, 0, 1) : 0

      /* До четырёх образов: основной и дубли, «зашедшие» с других краёв. */
      const w00 = (1 - gx) * (1 - gy)
      if (w00 >= 0.03) emit(p.x, p.y, w00, cr, cg, cb, ca, cs)
      const w10 = gx * (1 - gy)
      if (w10 >= 0.03) emit(p.x + w, p.y, w10, cr, cg, cb, ca, cs)
      const w01 = (1 - gx) * gy
      if (w01 >= 0.03) emit(p.x, p.y + h, w01, cr, cg, cb, ca, cs)
      const w11 = gx * gy
      if (w11 >= 0.03) emit(p.x + w, p.y + h, w11, cr, cg, cb, ca, cs)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, floats.subarray(0, count * 7), gl.DYNAMIC_DRAW)
    this._setupAttribs(progP)
    gl.drawArrays(gl.POINTS, 0, count)

    const cursor = this.cursor
    const cursorR = opts.cursorRadius * minSide

    /* Нити. */
    const links = this._links
    if (links.count) {
      const progL = this.progLines
      gl.useProgram(progL)
      gl.uniform2f(this._viewLoc.get(progL), this.bw, this.bh)
      const linkCol = rgbOf(opts.linkColor)
      /* Каждая нить рисуется одним-двумя сегментами: основной и, если пара
         сидит у разных краёв тора, «продолжение» с той стороны шва. Так
         связи не обрываются на границах поля. */
      const lf = this._scratch('_lineFloats', links.count * 2 * 2 * 7)
      o = 0
      let lv = 0
      /* Разогрев сегмента: середину берём у самого сегмента (в его части
         поля), а дистанцию до курсора — по тору, как и для связей. Без этого
         пара, живущая у шва, имеет сырую середину в центре экрана — и её
         «накал» дублировался бы у краёв, когда планета в середине. */
      const segAlpha = (x1, y1, x2, y2, base) => {
        if (!cursor || !(opts.cursorPull > 0)) return base
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const wx = wrapDelta(mx - cursor.x * w, w)
        const wy = wrapDelta(my - cursor.y * h, h)
        const cd = Math.hypot(wx, wy)
        if (cd >= cursorR) return base
        return Math.min(1, base + (1 - cd / cursorR) * opts.cursorPull)
      }
      const pushSeg = (x1, y1, x2, y2, base) => {
        const alpha = segAlpha(x1, y1, x2, y2, base)
        lf[o++] = x1 * sx
        lf[o++] = (this.h - y1) * sy
        lf[o++] = linkCol[0]
        lf[o++] = linkCol[1]
        lf[o++] = linkCol[2]
        lf[o++] = alpha
        lf[o++] = 1
        lf[o++] = x2 * sx
        lf[o++] = (this.h - y2) * sy
        lf[o++] = linkCol[0]
        lf[o++] = linkCol[1]
        lf[o++] = linkCol[2]
        lf[o++] = alpha
        lf[o++] = 1
        lv += 2
      }
      for (let i = 0; i < links.count; i++) {
        const a = pts[links.a[i]]
        const b = pts[links.b[i]]
        const kx = links.kx[i]
        const ky = links.ky[i]
        const alpha = links.alpha[i]
        /* Ближайший образ второй точки и образ первой у того же шва. */
        pushSeg(a.x, a.y, b.x - kx * w, b.y - ky * h, alpha)
        if (kx || ky) pushSeg(a.x + kx * w, a.y + ky * h, b.x, b.y, alpha)
      }
      gl.bufferData(gl.ARRAY_BUFFER, lf.subarray(0, lv * 7), gl.DYNAMIC_DRAW)
      this._setupAttribs(progL)
      gl.drawArrays(gl.LINES, 0, lv)
    }

    /* Курсор-«планета»: пульсирующий светящийся шар на месте указателя.
       Само расталкивание звёзд делает _step (cursorRepel), здесь — только
       видимый объект: широкая мягкая аура и яркое ядро, аддитивно, той же
       программой точек. При «уменьшении движения» расталкивания нет —
       и шара тоже не рисуем. */
    if (cursor && opts.cursorObject !== false
      && (opts.cursorRepel > 0 || opts.cursorPull > 0)) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.4)
      /* Размер планеты — отдельный параметр, не привязан к радиусу
         действия (cursorRadius отвечает только за расталкивание). */
      const haloR = Math.max(2, opts.planetRadius * minSide) * pulse
      const coreR = haloR * 0.4
      const cx = cursor.x * w
      const cy = cursor.y * h
      /* Аура — мягкий индиго, ядро — почти белое: светящийся «газовый гигант»
         вместо утилитарного курсора. Цвета предумножены (блендинг уже
         ONE, 1−SRC_ALPHA). */
      const orb = this._orb
      const aura = rgbOf(opts.auraColor || '#818cf8')
      const core = rgbOf(opts.coreColor || '#e0e7ff')
      let q = 0
      const putOrb = (px, py, radius, color, alpha) => {
        orb[q++] = px * sx
        orb[q++] = (h - py) * sy
        orb[q++] = color[0]
        orb[q++] = color[1]
        orb[q++] = color[2]
        orb[q++] = alpha
        orb[q++] = radius * 2 * sy
      }
      putOrb(cx, cy, haloR, aura, 0.38 * pulse)
      putOrb(cx, cy, coreR, core, 0.9)
      gl.useProgram(progP)
      gl.uniform2f(this._viewLoc.get(progP), this.bw, this.bh)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
      gl.bufferData(gl.ARRAY_BUFFER, orb, gl.DYNAMIC_DRAW)
      this._setupAttribs(progP)
      gl.drawArrays(gl.POINTS, 0, 2)
    }
  }

  /* Буфер кадра нужного размера: растёт удвоением и живёт между кадрами.
     Раньше Float32Array под звёзды и нити создавался заново каждый кадр —
     при 2000 звёздах это сотни килобайт мусора в секунду. */
  _scratch(name, size) {
    let buf = this[name]
    if (!buf || buf.length < size) {
      buf = new Float32Array(Math.max(size, buf ? buf.length * 2 : 0))
      this[name] = buf
    }
    return buf
  }

  _setupAttribs(prog) {
    const gl = this.gl
    /* Расположения атрибутов спрашиваем у конкретной программы: WebGL не
       гарантирует, что у двух программ одинаковые индексы. aSize есть только
       у точек — у линий его локация -1, и там он просто пропускается.
       Локации не меняются после линковки — запоминаем их. */
    let locs = this._attribLoc.get(prog)
    if (!locs) {
      locs = ATTRIBS.map(([name]) => gl.getAttribLocation(prog, name))
      this._attribLoc.set(prog, locs)
    }
    for (let k = 0; k < ATTRIBS.length; k++) {
      const loc = locs[k]
      if (loc < 0) continue
      const [, size, offset] = ATTRIBS[k]
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, offset)
    }
  }

  /* --- жизненный цикл --- */

  _loop = (now) => {
    this._raf = requestAnimationFrame(this._loop)
    if (this.paused) return
    this._step(now)
    this._draw(now)
  }

  start() {
    if (this._raf) return this
    /* Сторож может запрещать кадры (вкладка скрыта, блок за экраном).
       Явный запуск из виджета не должен его обходить. */
    if (this._gate && !this._gate.shouldRun()) return this
    this.paused = false
    this._lastMs = 0
    this._raf = requestAnimationFrame(this._loop)
    return this
  }

  stop() {
    this.paused = true
    if (this._raf) {
      cancelAnimationFrame(this._raf)
      this._raf = 0
    }
    return this
  }

  set(patch) {
    Object.assign(this.opts, patch)
    // Палитра, размеры и плотность живут в массиве точек — применяем на лету.
    if (patch.palette || patch.size !== undefined || patch.sizeSpread !== undefined
      || patch.density !== undefined || patch.countMult !== undefined) {
      this._initPoints()
    }
    return this
  }

  /* Перекраска без пересоздания: берём сохранённый у каждой звезды индекс
     на палитре (`palT`) и считаем цвет заново — позиции, курсы и размеры
     не трогаем, поле не «перемешивается». Цвет нитей и курсора-планеты
     тоже обновляются. Используется при смене темы сайта. */
  recolor(palette, linkColor, auraColor, coreColor) {
    if (Array.isArray(palette) && palette.length) {
      this.opts.palette = palette
      const pal = palette.map(hexToRgb)
      for (const p of this.points) {
        const seg = clamp(p.palT, 0, 0.999) * (pal.length - 1)
        const i = Math.floor(seg)
        const k = seg - i
        const c0 = pal[i]
        const c1 = pal[Math.min(i + 1, pal.length - 1)]
        p.color = [
          c0[0] + (c1[0] - c0[0]) * k,
          c0[1] + (c1[1] - c0[1]) * k,
          c0[2] + (c1[2] - c0[2]) * k,
        ]
      }
    }
    if (linkColor) this.opts.linkColor = linkColor
    if (auraColor) this.opts.auraColor = auraColor
    if (coreColor) this.opts.coreColor = coreColor
    return this
  }

  resize() {
    /* Размер контейнера меняется редко, а перерасчёт позиций в новый диапазон
       сбросил бы накопленное движение — поэтому звёзды только пережимаются
       в новые границы пропорционально. Но если адаптивная плотность требует
       другого числа звёзд (окно сжали с десктопа до телефона), массив точек
       пересоздаётся целиком — иначе поле останется разреженным или тесным. */
    const prevW = this.w
    const prevH = this.h
    this._resize()
    if (!prevW || !prevH || !this.points) return
    if (this._desiredCount() !== this.points.length) {
      this._initPoints()
      return
    }
    const kx = this.w / prevW
    const ky = this.h / prevH
    for (const p of this.points) {
      p.x *= kx
      p.y *= ky
    }
  }

  /* --- перецепление между инстансами (смена языка) --- */

  /* Отвязывает слушатели и наблюдатели от текущего контейнера — общая часть
     для detach() и reattach(). Канвас и WebGL-ресурсы не трогает. */
  _unbind() {
    /* Снятый виджет обязан отписать источники: иначе слушатель вкладки
       пережил бы свой канвас и снова запустил цикл. */
    this._sources?.disconnect()
    this._sources = null
    this._gateOff?.()
    this._gateOff = null
    this._resizeObserver?.disconnect()
    this._resizeObserver = undefined
    if (this._handlers) {
      this.el.removeEventListener('pointermove', this._handlers.move)
      this.el.removeEventListener('pointerleave', this._handlers.leave)
      this.el.removeEventListener('pointerup', this._handlers.leave)
      this.el.removeEventListener('pointercancel', this._handlers.leave)
      this._handlers = null
    }
  }

  /* Снимает виджет с контейнера, не уничтожая его: WebGL-контекст, шейдеры
     и позиции звёзд остаются в инстансе для перецепления (reattach). */
  detach() {
    this.stop()
    this._unbind()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    return this
  }

  /* Перецепляет сохранённый виджет на новый контейнер: тот же контекст и те
     же звёзды с их позициями и курсами — без пересоздания и без скачка. */
  reattach(el) {
    const node = typeof el === 'string' ? document.querySelector(el) : el
    if (!node) throw new Error('Constellation: контейнер не найден')
    this.stop()
    this._unbind()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    this.el = node
    node.appendChild(this.canvas)
    this.resize()
    this._bind()
    this.start()
    return this
  }

  destroy() {
    this.stop()
    this._sources?.disconnect()
    this._gateOff?.()
    this._resizeObserver?.disconnect()
    if (this._handlers) {
      this.el.removeEventListener('pointermove', this._handlers.move)
      this.el.removeEventListener('pointerleave', this._handlers.leave)
      this.el.removeEventListener('pointerup', this._handlers.leave)
      this.el.removeEventListener('pointercancel', this._handlers.leave)
    }
    const gl = this.gl
    gl.deleteBuffer(this.buffer)
    gl.deleteProgram(this.progPoints)
    gl.deleteProgram(this.progLines)
    /* Контекст отпускаем сразу, как и остальные виджеты: живых контекстов
       браузер держит ограниченное число, а удалённый канвас ждал бы сборки
       мусора. */
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.canvas.remove()
  }
}

export default {
  create(el, options) {
    return new Constellation(el, options)
  },
}
