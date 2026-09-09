/*!
 * GlukeImageParticles — «частицы из картинки» на чистом WebGL, без зависимостей.
 * Виджет кейса `image-particles`.
 *
 * Эффект по мотивам классического демо Bruno Imbrizi / Codrops
 * «Interactive Particles with three.js»
 * (https://tympanus.net/codrops/2019/01/17/interactive-particles-with-three-js/,
 *  https://github.com/brunoimbrizi/interactive-particles).
 * Это самостоятельная реализация на чистом WebGL (без three.js и glslify):
 * та же идея — пиксели картинки-донора становятся точками, которые собираются
 * в изображение и рассыпаются от курсора. Лицензия Codrops разрешает
 * использование и доработку в коммерческих проектах; исходники оригинала
 * остались у автора, код здесь написан с нуля под шаблон виджетов сайта.
 *
 * Техника: gl.POINTS, один draw call; позиции и углы частиц лежат в
 * вершинных буферах, весь расчёт (шум, размер по яркости, разлёт от курсора,
 * глубина) — в вершинном шейдере. Текстура-донор читается в шейдере, как
 * в оригинале. Курсор расталкивает частицы в пространстве изображения
 * (без off-screen текстуры следа — вместо неё сглаженное следование мыши).
 */

const GlukeImageParticles = (function (global) {
  'use strict'

  var DEFAULTS = {
    // --- частицы ---
    density: 1, // шаг сэмплирования пикселей (1 = все, 57 600 шт. при 320×180)
    dotSize: 1.0, // размер точки
    /* Разлёт в долях самой картинки. В собранном состоянии он должен быть
       очень маленьким — уже при 0.1 силуэт перестаёт читаться. Большие
       значения ползунка нужны только как эффект «рассыпать».
       Интро-анимация стартует с INTRO_SCATTER и «слетается». */
    scatter: 0.02,
    depth: 0.2, // разброс по глубине — псевдо-3D
    flow: 1.0, // скорость дрейфа (шумовое «дыхание» точек)
    colorSat: 0, // 0 — монохром (как в оригинале), 1 — полный цвет картинки
    /* Тонкоррекция донора прямо в шейдере: S-кривая разводит светлое и
       тёмное, порог убирает фон. Фотография «как есть» даёт точки почти
       одного размера — объект читается пятном, а не формой. */
    contrast: 1.6, // 1 — как в файле, 3 — жёсткий контраст
    /* Доля размера и плотности у самого тёмного пикселя объекта. 0 — точки
       только на бликах, объект рассыпается; 1 — ровное заполнение без
       светотени. */
    shadowFill: 0.45,
    floor: 0.06, // всё темнее этой яркости точек не даёт

    // --- курсор ---
    radius: 0.6, // радиус действия курсора
    repel: 0.8, // сила расталкивания
    glide: 0.12, // плавность следования курсора (0.02 — тягуче, 0.4 — резко)
    parallax: 1.0, // параллакс камеры за курсором

    // --- тема (передаётся из THEME_LOOK, см. widgetThemeLook.ts) ---
    additive: true, // аддитивное смешивание (тёмная тема)
    invert: false, // «чернила»: тёмные точки по светлому фону
    lightness: 1.0, // яркость точек
    /* Минимальный размер по яркости: почти 0, чтобы чёрный фон донора
       не вылезал точками и читалась сама картинка, а не «заливка». */
    minGrey: 0.03,

    // --- инфраструктура ---
    ratioCap: 2,
    pixelBudget: 2.2e6,
    pauseOffscreen: true,
    respectReducedMotion: true,
    pointer: true,
    pointerFrom: 'window',
    src: null, // путь к картинке-донору (обязательно)
  }

  var VERT = [
    'precision mediump float;',
    'attribute float aIndex;',
    'attribute vec2 aOffset;',
    'attribute float aAngle;',
    'attribute vec3 aColor;',
    'uniform float uTime;',
    'uniform float uScatter;',
    'uniform float uDepth;',
    'uniform float uSize;',
    'uniform vec2 uFit;',
    'uniform float uAspect;',
    'uniform float uPointScale;',
    'uniform float uMinGrey;',
    'uniform float uContrast;',
    'uniform float uFloor;',
    'uniform float uRepel;',
    'uniform float uReach;',
    'uniform vec2 uMouse;',
    'uniform vec2 uCam;',
    'uniform float uShadowFill;',
    'varying float vGrey;',
    'varying float vFill;',
    'varying vec3 vCol;',
    'float hash(float n){ return fract(sin(n) * 43758.5453123); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(dot(i, vec2(127.1, 311.7)));',
    '  float b = hash(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)));',
    '  float c = hash(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)));',
    '  float d = hash(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    /* S-кривая: тёмное темнее, светлое светлее, середина на месте. */
    'float scurve(float t, float k){',
    '  return t < 0.5 ? 0.5 * pow(t * 2.0, k) : 1.0 - 0.5 * pow((1.0 - t) * 2.0, k);',
    '}',
    'void main(){',
    '  float raw = dot(aColor, vec3(0.21, 0.71, 0.07));',
    '  float grey = scurve(raw, uContrast);',
    '  grey *= smoothstep(uFloor, uFloor + 0.08, grey);',
    '  vGrey = grey;',
    '  vCol = raw > 0.001 ? aColor * (grey / raw) : vec3(0.0);',
    /* «Присутствие» пикселя — отдельно от его тона. Тон говорит, какого
       цвета точка; присутствие — есть ли она вообще. Если вязать их вместе,
       тёмные участки не дают точек, объект собирается из одних бликов и
       рассыпается. uShadowFill задаёт, какую долю размера и плотности
       получает самый тёмный пиксель объекта. */
    '  vFill = mix(uShadowFill, 1.0, grey) * smoothstep(0.002, 0.03, grey);',
    /* Базовая позиция сразу в NDC: uFit — половина размера картинки на
       канвасе с учётом её собственных пропорций. Y переворачиваем: в
       ImageData строки идут сверху вниз, в NDC ось смотрит вверх. */
    '  vec2 base = (vec2(aOffset.x, 1.0 - aOffset.y) - 0.5) * 2.0 * uFit;',
    '  float r1 = hash(aIndex);',
    '  float r2 = hash(aIndex * 1.713 + aOffset.x * 217.0);',
    '  float rndz = r1 + vnoise(vec2(aIndex * 0.06, uTime * 0.1 * 1.0));',
    '  rndz = fract(rndz);',
    /* Случайный разлёт — пока uScatter большой, картинка «разобрана».
       Считаем его в долях самой картинки, а не канваса: тогда одно и то же
       значение ползунка выглядит одинаково на любом экране. */
    '  vec2 pos = base + (vec2(r1, r2) - 0.5) * 2.0 * uScatter * uFit;',
    /* Курсор расталкивает частицы. Расстояние меряем в пропорциях экрана
       (NDC растянут по ширине), иначе радиус курсора выходит эллипсом. */
    '  vec2 ar = vec2(uAspect, 1.0);',
    '  vec2 rel = (pos - uMouse) * ar;',
    '  float dist = length(rel);',
    '  float f = smoothstep(uReach, 0.0, dist);',
    '  vec2 dir = dist > 0.0001 ? rel / dist : vec2(0.0);',
    /* Сила расталкивания привязана к глубине частицы: та, что ближе всего
       к зрителю (rndz = 1), уходит от курсора полностью, самая дальняя
       (rndz = 0) не двигается вовсе. Так курсор «раздвигает» только передний
       слой, а задний остаётся стоять и держит форму объекта.
       При нулевой глубине слоёв нет — расталкиваются все одинаково. */
    '  float depthGate = mix(1.0, rndz, step(0.0005, uDepth));',
    '  pos += dir / ar * f * uRepel * depthGate;',
    // глубина + параллакс камеры за курсором
    '  float zz = (rndz - 0.5) * uDepth;',
    '  pos += uCam * zz * 3.0;',
    '  gl_Position = vec4(pos * (1.0 + zz * 1.4), zz, 1.0);',
    /* Размер: шумовое «дыхание» + яркость пикселя. Коэффициент 0.5 держит
       точку средней яркости примерно в половину шага сэмплирования — точки
       читаются раздельно, а не сливаются в заливку. */
    '  float breathe = vnoise(vec2(uTime * 0.35, aIndex * 0.04));',
    '  float ps = (breathe + 1.5) * 0.5 * (uMinGrey + vFill) * uSize * uPointScale;',
    '  gl_PointSize = ps;',
    '}',
  ].join('\n')

  var FRAG = [
    'precision mediump float;',
    'uniform float uSat;',
    'uniform float uLightness;',
    'uniform float uInvert;',
    'varying float vGrey;',
    'varying float vFill;',
    'varying vec3 vCol;',
    'void main(){',
    '  vec2 pc = gl_PointCoord - 0.5;',
    '  float d = length(pc);',
    '  float t = smoothstep(0.5, 0.16, d);',
    /* Плотность берём из «присутствия», а не из тона: фон картинки точек не
       даёт вовсе, а тень объекта даёт — просто более редкие и слабые.
       Через размер это не решить, GL рисует точку не меньше пикселя. */
    '  float a = t * vFill;',
    '  if (a <= 0.004) discard;',
    /* Светлая тема рисует «чернилами»: тон инвертируется, светлый объект
       становится тёмными точками по белому. */
    '  vec3 tone = mix(vec3(vGrey), vCol, uSat);',
    '  vec3 col = mix(tone, vec3(1.0) - tone, uInvert) * uLightness;',
    '  gl_FragColor = vec4(col * a, a);',
    '}',
  ].join('\n')

  /* Потолок числа частиц: 320×180 донор целиком — это 57 600 точек, один
     draw call. Запас втрое на случай картинки покрупнее. */
  var PARTICLE_CAP = 180000

  /* Стартовый разлёт: примерно на размер самой картинки — частицы приходят
     из-за краёв кадра, но не с бесконечности. */
  var INTRO_SCATTER = 1.1

  /* Ниже этой яркости пиксель считается фоном донора и частицей не станет.
     Оригинал Имбрици режет по 34/255 и теряет вместе с фоном всю тень
     объекта; нам тень нужна, поэтому порог на порядок ниже. */
  var EMPTY_LEVEL = 8 / 255

  /* Сколько пикселей канваса приходится на одну точку. Плотнее — точки
     сливаются в заливку, реже — картинка рассыпается в искры. */
  var POINT_PITCH = 1.2

  var CAMEL = /-([a-z])/g
  function camel(s) {
    return s.replace(CAMEL, function (m, c) {
      return c.toUpperCase()
    })
  }

  var PID = 0

  function Widget(el, opts) {
    this.id = 'gluke-image-particles-' + (++PID)
    this.el = el
    this.o = {}
    for (var d in DEFAULTS) this.o[d] = DEFAULTS[d]
    if (opts) {
      for (var k in opts) {
        if (Object.prototype.hasOwnProperty.call(opts, k)) this.o[camel(k)] = opts[k]
      }
    }

    this.gl = null
    this.prog = null
    this.canvas = null
    this.buffers = null
    this.count = 0
    this.tex = null
    /* Цель мыши изначально — далеко за экраном (ty 999): пока курсор ни разу
       не прошёлся по канвасу, расталкивание не должно «висеть» в центре
       и разгонять картинку в кольцо. При mouseleave цель возвращается
       туда же — частицы плавно слетаются обратно в изображение. */
    this._mouse = { x: 0, y: 0, tx: 0, ty: 999 }
    this._visible = true
    this._running = false
    this._elapsed = 0
    this._raf = 0
    this._ro = null
    this._io = null
    this._onVis = null
    this._onMove = null
    this._hoverHost = null
    this._scatterNow = INTRO_SCATTER // частицы «слетаются» в картинку
    this._ready = false
    this._strideUsed = 0 // последний шаг сэмплирования (для пересборки буферов)
    this._areaStride = 0 // шаг, продиктованный площадью канваса

    this._init()
  }

  Widget.prototype._init = function () {
    var el = this.el
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    var cv = document.createElement('canvas')
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    cv.setAttribute('aria-hidden', 'true')
    this.canvas = cv
    el.appendChild(cv)
    this._initGL()
    this._loadDonor()
    this.resize()
    this._bind()
    if (!this.o.respectReducedMotion || !global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.start()
    }
  }

  Widget.prototype._initGL = function () {
    var cv = this.canvas
    var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false })
      || cv.getContext('experimental-webgl', { alpha: true })
    if (!gl) throw new Error('GlukeImageParticles: WebGL недоступен')
    this.gl = gl

    var vs = this._compile(gl.VERTEX_SHADER, VERT)
    var fs = this._compile(gl.FRAGMENT_SHADER, FRAG)
    var prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('GlukeImageParticles: ' + gl.getProgramInfoLog(prog))
    }
    gl.useProgram(prog)
    this.prog = prog

    /* Номера атрибутов спрашиваем у слинкованной программы, а не назначаем
       вслепую: `bindAttribLocation` действует только на следующую линковку,
       а неиспользованные атрибуты компилятор вообще выбрасывает и отдаёт -1.
       Раньше цвет писался в слот 3, а шейдер читал его из слота 2 — туда
       попадал случайный угол, и все точки выходили одинаково белыми. */
    this.attrs = {
      index: gl.getAttribLocation(prog, 'aIndex'),
      offset: gl.getAttribLocation(prog, 'aOffset'),
      angle: gl.getAttribLocation(prog, 'aAngle'),
      color: gl.getAttribLocation(prog, 'aColor'),
    }

    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    this._applyBlend()

    var buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    this._bindAttribs()
    this.buffers = { data: buf, off: null, ang: null }
  }

  /* Раскладка буфера частиц: index, x, y, angle, r, g, b — 7 float, шаг 28
     байт. Выброшенные компилятором атрибуты (-1) пропускаем. */
  Widget.prototype._bindAttribs = function () {
    var gl = this.gl
    var a = this.attrs || {}
    var plan = [
      [a.index, 1, 0],
      [a.offset, 2, 4],
      [a.angle, 1, 12],
      [a.color, 3, 16],
    ]
    for (var i = 0; i < plan.length; i++) {
      var loc = plan[i][0]
      if (loc === undefined || loc < 0) continue
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, plan[i][1], gl.FLOAT, false, 28, plan[i][2])
    }
  }

  Widget.prototype._compile = function (type, src) {
    var gl = this.gl
    var sh = gl.createShader(type)
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('GlukeImageParticles: ' + gl.getShaderInfoLog(sh))
    }
    return sh
  }

  Widget.prototype._applyBlend = function () {
    var gl = this.gl
    if (this.o.additive) {
      gl.blendFunc(gl.ONE, gl.ONE)
    }
    else {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
  }

  /* Шаг сэмплирования с учётом площади канваса: на маленьких экранах 57 К
     частиц превращаются в сплошную кашу, поэтому количество точек
     ограничивается площадью (≈8 % покрытия), а ползунок «плотность» задаёт
     только минимум шага. Так на телефоне и на 4K-мониторе картинка
     собирается одинаково читаемо. */
  Widget.prototype._desiredStride = function () {
    if (!this._texData) return 1
    var crop = this._crop || { minX: 0, minY: 0, maxX: this._texW - 1, maxY: this._texH - 1 }
    var cw = crop.maxX - crop.minX + 1
    var ch = crop.maxY - crop.minY + 1
    var total = cw * ch
    /* Шаг задаёт пользователь (`density`), площадь канваса на него не влияет:
       иначе на маленьком превью донор редел до неузнаваемости, а обещанные
       «каждый пиксель» превращались в каждый третий. Ограничение только
       сверху — потолок числа частиц, чтобы слабый GPU не лёг. */
    var userStride = Math.max(1, this.o.density | 0)
    var budgetStride = Math.max(1, Math.ceil(Math.sqrt(total / PARTICLE_CAP)))
    /* Мельче, чем экран может показать, брать нельзя: точки уходят в
       субпиксель, светлые места слипаются в пятно, а полутона исчезают —
       вместо портрета остаётся шум. Держим POINT_PITCH пикселей на точку. */
    var drawnW = this._fit ? this._fit[0] * (this.canvas ? this.canvas.width : cw) : cw
    var pitchStride = Math.max(1, Math.ceil(cw / Math.max(1, drawnW / POINT_PITCH)))
    this._areaStride = Math.max(budgetStride, pitchStride)
    return Math.max(this._areaStride, userStride)
  }

  /* Отступаем от края проекции, пока не срежем `budget` яркости: так
     граница объекта не зависит от отдельных ярких пикселей шума. */
  function trimEdge(sums, budget, dir) {
    var i = dir > 0 ? 0 : sums.length - 1
    var acc = 0
    while (i >= 0 && i < sums.length) {
      acc += sums[i]
      if (acc > budget) return i
      i += dir
    }
    return dir > 0 ? 0 : sums.length - 1
  }

  /* Загрузка картинки-донора: рисуем в 2D-канвас, читаем пиксели, строим
     буферы частиц (каждый N-й пиксель сетки становится точкой). */
  Widget.prototype._loadDonor = function () {
    var self = this
    var src = this.o.src
    if (!src) return
    var img = new Image()
    img.onload = function () {
      var w = img.naturalWidth || img.width
      var h = img.naturalHeight || img.height
      var c = document.createElement('canvas')
      c.width = w
      c.height = h
      var ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      var data
      /* Донор с другого домена сделал бы канвас «грязным» — тогда пикселей
         не прочитать и виджет просто не запускается. */
      try {
        data = ctx.getImageData(0, 0, w, h).data
      }
      catch {
        return
      }
      /* Авто-кроп: вырезаем яркую часть (сам объект) по границе пикселей
         выше порога, с небольшим запасом. Иначе «пустой» фон донора
         раздувает кадр, а объект собирается мелко и нечитаемо — это работает
         для любой картинки, не только для этого портрета. */
      var cols = new Float64Array(w)
      var rows = new Float64Array(h)
      var mass = 0
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var pi = (y * w + x) * 4
          var lum = (data[pi] * 0.21 + data[pi + 1] * 0.71 + data[pi + 2] * 0.07)
          if (lum <= 8) continue
          cols[x] += lum
          rows[y] += lum
          mass += lum
        }
      }
      /* Границы ищем по массе яркости, а не по «есть хоть один пиксель ярче
         порога»: одно зерно в углу кадра иначе растягивает кроп на весь
         донор, объект собирается мелко и теряется в пустоте. */
      var minX = -1, minY = -1, maxX = -1, maxY = -1
      if (mass > 0) {
        var edge = mass * 0.004
        minX = trimEdge(cols, edge, 1)
        maxX = trimEdge(cols, edge, -1)
        minY = trimEdge(rows, edge, 1)
        maxY = trimEdge(rows, edge, -1)
      }
      if (maxX >= 0) {
        var padX = Math.round((maxX - minX + 1) * 0.05)
        var padY = Math.round((maxY - minY + 1) * 0.05)
        minX = Math.max(0, minX - padX)
        minY = Math.max(0, minY - padY)
        maxX = Math.min(w - 1, maxX + padX)
        maxY = Math.min(h - 1, maxY + padY)
        self._crop = { minX: minX, minY: minY, maxX: maxX, maxY: maxY }
      }
      else {
        self._crop = { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1 }
      }
      self._texW = w
      self._texH = h
      self._texData = data
      self._buildBuffers()
      self._ready = true
      self.resize()
    }
    img.onerror = function () { /* без донора виджет не запускается — остаётся обложка */ }
    img.src = src
  }

  Widget.prototype._buildBuffers = function () {
    var gl = this.gl
    if (!this._texData) return
    var w = this._texW, h = this._texH
    var stride = this._desiredStride()
    /* Буферы уже собраны с таким шагом — не трогаем (ресайз может звать
       пересборку без изменения площади). */
    if (stride === this._strideUsed && this.count > 0) return
    this._strideUsed = stride
    /* Цвет берём из ImageData донора сразу на CPU — шейдеру текстура не
       нужна вовсе (на некоторых GPU вершинная выборка текстуры капризна).
       Формат: index, x, y, angle, r, g, b — 7 float на частицу. */
    var data = this._texData
    var crop = this._crop || { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1 }
    var cw = crop.maxX - crop.minX + 1
    var ch = crop.maxY - crop.minY + 1
    var list = []
    var i = 0
    for (var y = crop.minY; y <= crop.maxY; y += stride) {
      for (var x = crop.minX; x <= crop.maxX; x += stride) {
        var pi = (y * w + x) * 4
        var r = data[pi] / 255
        var g = data[pi + 1] / 255
        var b = data[pi + 2] / 255
        /* Пиксели фона в буфер не кладём вовсе — так же поступает оригинал
           Имбрици. Порог здесь низкий: он отсекает только чистый фон, а не
           тень объекта; за то, сколько видно в тенях, отвечает shadowFill
           в шейдере. */
        if (r * 0.21 + g * 0.71 + b * 0.07 < EMPTY_LEVEL) continue
        list.push(i, (x - crop.minX + 0.5) / cw, (y - crop.minY + 0.5) / ch, Math.random() * Math.PI * 2, r, g, b)
        i++
      }
    }
    this.count = i
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.data)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(list), gl.STATIC_DRAW)
    this._bindAttribs()
  }

  Widget.prototype._pushStatic = function () {
    var gl = this.gl, prog = this.prog
    if (!prog) return
    gl.useProgram(prog)
  }

  Widget.prototype.resize = function () {
    if (!this.gl || !this.canvas) return
    var gl = this.gl
    var rect = this.canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    var dpr = Math.min(this.o.ratioCap || 2, global.devicePixelRatio || 1)
    var w = Math.max(1, Math.round(rect.width * dpr))
    var h = Math.max(1, Math.round(rect.height * dpr))
    var budget = this.o.pixelBudget || 2.2e6
    if (w * h > budget) {
      var k = Math.sqrt(budget / (w * h))
      w = Math.max(1, Math.round(w * k))
      h = Math.max(1, Math.round(h * k))
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    var aspect = rect.width / rect.height
    this._aspect = aspect
    /* Картинка вписывается в канвас по своим пропорциям (contain), а не
       растягивается под него: иначе на широком экране объект расплющивался.
       uFit — половина размера картинки в NDC, с полями по краям. */
    var crop = this._crop
    var imgAspect = crop ? (crop.maxX - crop.minX + 1) / (crop.maxY - crop.minY + 1) : aspect
    var margin = 0.92
    this._fit = imgAspect > aspect
      ? [margin, margin * aspect / imgAspect]
      : [margin * imgAspect / aspect, margin]
    /* Шаг сэмплирования зависит от размера канваса, поэтому пересчитываем
       его на каждом ресайзе. Пересборка буферов дешёвая: `_buildBuffers`
       сразу выходит, если шаг не изменился. */
    this._lastArea = Math.round(rect.width * rect.height)
    if (this._ready) this._buildBuffers()
    /* Размер точки считаем от шага сэмплирования — уже пересчитанного выше.
       Точка должна закрывать ровно ту площадь, которую занимает один взятый
       пиксель донора на экране: иначе картинка либо рассыпается в редкие
       искры, либо слипается в пятно — оба состояния уже были. */
    var samplesX = crop ? (crop.maxX - crop.minX + 1) / (this._strideUsed || 1) : 1
    this._pointScale = Math.max(1.2, this._fit[0] * w / Math.max(1, samplesX))
  }

  Widget.prototype._bind = function () {
    var self = this
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(function () {
        self.resize()
      })
      this._ro.observe(this.el)
    }
    else {
      this._onResize = function () {
        self.resize()
      }
      global.addEventListener('resize', this._onResize)
    }
    if (this.o.pauseOffscreen) {
      if (typeof IntersectionObserver !== 'undefined') {
        this._io = new IntersectionObserver(function (entries) {
          var vis = entries.some(function (e) {
            return e.isIntersecting
          })
          self._visible = vis
          if (vis) self.start()
          else self.stop()
        }, { rootMargin: '120px 0px' })
        this._io.observe(this.canvas)
      }
      this._onVis = function () {
        if (document.hidden) self.stop()
        else self.start()
      }
      document.addEventListener('visibilitychange', this._onVis)
    }
    if (this.o.pointer) {
      var host = this.o.pointerFrom === 'self' ? this.el : global
      this._hoverHost = host
      this._onMove = function (e) {
        var r = self.canvas.getBoundingClientRect()
        var px = (e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : r.left + r.width / 2)) - r.left
        var py = (e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : r.top + r.height / 2)) - r.top
        self._mouse.tx = (px / r.width - 0.5) * 2
        self._mouse.ty = -(py / r.height - 0.5) * 2
      }
      /* Курсор покинул окно — уводим цель за экран: частицы плавно
         возвращаются в собранную картинку, а не остаются разогнанными.
         На сенсоре роль «ухода» играет отрыв пальца: mouseleave там не
         случается никогда, и без этого дыра оставалась бы висеть. */
      this._onLeave = function () {
        self._mouse.tx = 0
        self._mouse.ty = 999
      }
      host.addEventListener('mousemove', this._onMove)
      host.addEventListener('touchmove', this._onMove, { passive: true })
      host.addEventListener('touchend', this._onLeave, { passive: true })
      host.addEventListener('touchcancel', this._onLeave, { passive: true })
      document.addEventListener('mouseleave', this._onLeave)
    }
  }

  Widget.prototype._unbind = function () {
    if (this._ro) this._ro.disconnect()
    else if (this._onResize) global.removeEventListener('resize', this._onResize)
    if (this._io) this._io.disconnect()
    if (this._onVis) document.removeEventListener('visibilitychange', this._onVis)
    if (this._onMove && this._hoverHost) {
      this._hoverHost.removeEventListener('mousemove', this._onMove)
      this._hoverHost.removeEventListener('touchmove', this._onMove)
      if (this._onLeave) {
        this._hoverHost.removeEventListener('touchend', this._onLeave)
        this._hoverHost.removeEventListener('touchcancel', this._onLeave)
      }
    }
    if (this._onLeave) document.removeEventListener('mouseleave', this._onLeave)
    this._ro = null
    this._io = null
    this._onVis = null
    this._onMove = null
    this._onLeave = null
    this._hoverHost = null
  }

  Widget.prototype._frame = function (now) {
    var self = this
    if (!this._running) return
    this._raf = requestAnimationFrame(function (t) {
      self._frame(t)
    })
    if (!this._ready || !this.gl || !this.prog) return
    var gl = this.gl
    var dt = Math.min(0.05, (now - (this._last || now)) / 1000)
    this._last = now
    this._time = (this._time || 0) + dt * this.o.flow

    // курсор плавно следует за целью
    var g = this.o.glide
    var k = 1 - Math.exp(-dt / Math.max(0.02, g))
    this._mouse.x += (this._mouse.tx - this._mouse.x) * k
    this._mouse.y += (this._mouse.ty - this._mouse.y) * k

    // «слёт» частиц в картинку после старта
    this._scatterNow += (this.o.scatter - this._scatterNow) * Math.min(1, dt * 1.1)

    var prog = this.prog
    gl.useProgram(prog)
    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this._time)
    gl.uniform1f(gl.getUniformLocation(prog, 'uScatter'), this._scatterNow)
    gl.uniform1f(gl.getUniformLocation(prog, 'uDepth'), this.o.depth)
    gl.uniform1f(gl.getUniformLocation(prog, 'uSize'), this.o.dotSize)
    var fit = this._fit || [0.9, 0.9]
    gl.uniform2f(gl.getUniformLocation(prog, 'uFit'), fit[0], fit[1])
    gl.uniform1f(gl.getUniformLocation(prog, 'uAspect'), this._aspect || 1)
    gl.uniform1f(gl.getUniformLocation(prog, 'uPointScale'), this._pointScale || 1)
    gl.uniform1f(gl.getUniformLocation(prog, 'uMinGrey'), this.o.minGrey)
    gl.uniform1f(gl.getUniformLocation(prog, 'uContrast'), this.o.contrast)
    gl.uniform1f(gl.getUniformLocation(prog, 'uFloor'), this.o.floor)
    gl.uniform1f(gl.getUniformLocation(prog, 'uShadowFill'), this.o.shadowFill)
    gl.uniform1f(gl.getUniformLocation(prog, 'uRepel'), this.o.repel)
    gl.uniform1f(gl.getUniformLocation(prog, 'uReach'), this.o.radius)
    gl.uniform2f(gl.getUniformLocation(prog, 'uMouse'), this._mouse.x, this._mouse.y)
    /* Параллакс камеры: цель вне экрана не должна наклонять сцену,
       поэтому значения мыши для камеры зажимаем в видимый диапазон. */
    var par = this.o.parallax * 0.09
    var camX = Math.max(-1.6, Math.min(1.6, this._mouse.x)) * par
    var camY = Math.max(-1.6, Math.min(1.6, this._mouse.y)) * par
    gl.uniform2f(gl.getUniformLocation(prog, 'uCam'), camX, camY)
    gl.uniform1f(gl.getUniformLocation(prog, 'uSat'), this.o.colorSat)
    gl.uniform1f(gl.getUniformLocation(prog, 'uLightness'), this.o.lightness)
    gl.uniform1f(gl.getUniformLocation(prog, 'uInvert'), this.o.invert ? 1 : 0)

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.data)
    this._bindAttribs()
    gl.drawArrays(gl.POINTS, 0, this.count)
  }

  Widget.prototype.start = function () {
    if (this._running || document.hidden || !this._visible) return
    this._running = true
    var self = this
    this._last = performance.now()
    this._raf = requestAnimationFrame(function (t) {
      self._frame(t)
    })
  }

  Widget.prototype.stop = function () {
    if (!this._running) return
    this._running = false
    cancelAnimationFrame(this._raf)
  }

  Widget.prototype.set = function (patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) this.o[camel(k)] = patch[k]
    if (patch.density !== undefined) this._buildBuffers()
    if (patch.additive !== undefined) this._applyBlend()
    this.resize()
    return this
  }

  Widget.prototype.detach = function () {
    this.stop()
    this._unbind()
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    return this
  }

  Widget.prototype.reattach = function (el) {
    var node = typeof el === 'string' ? document.querySelector(el) : el
    if (!node) throw new Error('GlukeImageParticles: контейнер не найден')
    this.stop()
    this._unbind()
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    this.el = node
    if (getComputedStyle(node).position === 'static') node.style.position = 'relative'
    node.appendChild(this.canvas)
    this._visible = true
    this.resize()
    this._bind()
    this.start()
    return this
  }

  Widget.prototype.destroy = function () {
    this.stop()
    this._unbind()
    if (this.gl) {
      var ext = this.gl.getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()
    }
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
  }

  var API = {
    defaults: DEFAULTS,
    instances: [],
    create: function (el, opts) {
      var p = new Widget(el, opts)
      API.instances.push(p)
      return p
    },
  }

  return API
})(typeof window !== 'undefined' ? window : this)

export default GlukeImageParticles
