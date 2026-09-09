/*!
 * GLUKE Constellation — интерактивное звёздное поле на чистом WebGL,
 * без зависимостей и сборки.
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
 *   — связи собираются на CPU (порог дистанции держит их число в пределах
 *     пары сотен) и идут как GL_LINES.
 *
 * Координаты: позиции ведутся в CSS-пикселях контейнера, а в буфер уходят
 * в физических пикселях (CSS × масштаб dpr) — шейдер делит позицию на
 * физический размер viewport.
 *
 *   Constellation.create(el, { palette: ['#7dd3fc', '#818cf8', '#e879f9'] })
 */

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

class Constellation {
  constructor(container, options) {
    const el = typeof container === 'string' ? document.querySelector(container) : container
    if (!el) throw new Error('Constellation: контейнер не найден')

    this.el = el
    this.opts = { ...DEFAULTS, ...(options || {}) }
    this.paused = true
    this._raf = 0
    this._lastMs = 0
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
    this.links = null

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
    this.links = []
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

    /* Сворачиваем рендер, когда блока нет в окне: поле тихое, считать его
       вне экрана незачем. IntersectionObserver дешевле проверки в кадре. */
    if (typeof IntersectionObserver !== 'undefined' && this.opts.pauseOffscreen) {
      this._observer = new IntersectionObserver((entries) => {
        ctx._visible = entries[0]?.isIntersecting !== false
      }, { threshold: 0 })
      this._observer.observe(this.el)
      this._visible = true
    }
    else {
      this._visible = true
    }

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

    /* Связи: попарно, с порогом в пикселях. O(n²) при n=550 — ~150k проверок,
       на кадр это дёшево даже на телефоне. Расстояние считается по тору:
       пара у левого и правого краёв соединяется так же, как соседи в центре,
       — поле замкнуто, «шва» на границах нет. */
    const links = []
    const distSq = linkR * linkR
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j]
        /* Ближайший образ второй точки на торе; kx/ky — через какой край
           идёт связь, чтобы отрисовать её двумя сегментами у шва. */
        const dx = wrapDelta(b.x - a.x, w)
        const dy = wrapDelta(b.y - a.y, h)
        const d2 = dx * dx + dy * dy
        if (d2 > distSq) continue
        const d = Math.sqrt(d2) /* Затухание плавное, но щедрое: до 65% радиуса нить светит в полную
           силу (как раньше), дальше — мягкий smoothstep-спад к нулю у порога.
           Так связи не «щелкают» при расхождении пар и при этом не гаснут
           на середине дистанции. */
        const alpha = opts.linkAlpha * (1 - smoothstep(0.65, 1, d / linkR))
        if (alpha < 0.02) continue
        /* Разогрев от курсора применяется не здесь, а в _draw — к каждому
           видимому сегменту нити отдельно (см. pushSeg): у нитей через шов
           два сегмента лежат у разных краёв, и греется только тот, что
           рядом с курсором. */
        links.push({
          a, b, alpha,
          kx: Math.round((b.x - a.x) / w),
          ky: Math.round((b.y - a.y) / h),
        })
      }
    }
    this.links = links
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
    const floats = new Float32Array(pts.length * 4 * 7)
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
    gl.bufferData(gl.ARRAY_BUFFER, floats, gl.DYNAMIC_DRAW)
    this._setupAttribs(progP)
    gl.drawArrays(gl.POINTS, 0, count)

    const cursor = this.cursor
    const cursorR = opts.cursorRadius * minSide

    /* Нити. */
    const links = this.links
    if (links.length) {
      const progL = this.progLines
      gl.useProgram(progL)
      gl.uniform2f(this._viewLoc.get(progL), this.bw, this.bh)
      const linkCol = hexToRgb(opts.linkColor)
      /* Каждая нить рисуется одним-двумя сегментами: основной и, если пара
         сидит у разных краёв тора, «продолжение» с той стороны шва. Так
         связи не обрываются на границах поля. */
      const lf = new Float32Array(links.length * 2 * 2 * 7)
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
      for (let i = 0; i < links.length; i++) {
        const l = links[i]
        const a = l.a
        const b = l.b
        /* Ближайший образ второй точки и образ первой у того же шва. */
        pushSeg(a.x, a.y, b.x - l.kx * w, b.y - l.ky * h, l.alpha)
        if (l.kx || l.ky) pushSeg(a.x + l.kx * w, a.y + l.ky * h, b.x, b.y, l.alpha)
      }
      gl.bufferData(gl.ARRAY_BUFFER, lf, gl.DYNAMIC_DRAW)
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
      const orb = new Float32Array(2 * 7)
      const aura = hexToRgb(opts.auraColor || '#818cf8')
      const core = hexToRgb(opts.coreColor || '#e0e7ff')
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

  _setupAttribs(prog) {
    const gl = this.gl
    /* Расположения атрибутов спрашиваем у конкретной программы: WebGL не
       гарантирует, что у двух программ одинаковые индексы. aSize есть только
       у точек — у линий его локация -1, и там он просто пропускается. */
    const attrs = [
      ['aPos', 2, 0],
      ['aColor', 3, 8],
      ['aAlpha', 1, 20],
      ['aSize', 1, 24],
    ]
    for (const [name, size, offset] of attrs) {
      const loc = gl.getAttribLocation(prog, name)
      if (loc < 0) continue
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, offset)
    }
  }

  /* --- жизненный цикл --- */

  _loop = (now) => {
    this._raf = requestAnimationFrame(this._loop)
    if (this.paused) return
    if (this._visible === false) {
      /* Пока блок вне экрана, время не течёт: по возвращении dt не прыгнет
         (страховка в _step всё равно ограничивает скачок). */
      this._lastMs = now
      return
    }
    this._step(now)
    this._draw(now)
  }

  start() {
    if (this._raf) return this
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
    this._observer?.disconnect()
    this._observer = undefined
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
    this._visible = true
    this.resize()
    this._bind()
    this.start()
    return this
  }

  destroy() {
    this.stop()
    this._observer?.disconnect()
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
    this.canvas.remove()
  }
}

export default {
  create(el, options) {
    return new Constellation(el, options)
  },
}
