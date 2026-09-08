/*!
 * GlukeMetaballs — лава-лампа из метаболлов на чистом WebGL, без зависимостей.
 * Виджет кейса `metaballs`. Написан по шаблону GlukePyramid (тот же каркас:
 * fullscreen-треугольник, фрагментный шейдер, create/set/detach/reattach),
 * но сцены-коробки у него нет: канвас прозрачный и живёт прямо на фоне темы
 * сайта, цвета подбираются под светлую/тёмную тему.
 *
 * Математика: поле метаболлов — сумма гауссовых «капель»; граница «лавы»
 * получается сглаженным порогом по этому полю (smoothstep), поэтому капли
 * плавно сливаются и разделяются. Курсор добавляет свою каплю (если включён)
 * и тянет остальные к себе — «капли за курсором».
 */

const GlukeMetaballs = (function (global) {
  'use strict'

  var MAX_BLOBS = 14

  var DEFAULTS = {
    // --- капли ---
    count: 6, // число капель (2..14)
    speed: 0.7, // скорость дрейфа
    turbulence: 0.5, // «турбулентность» — шумовое искажение поля

    // --- форма ---
    blobSize: 0.11, // радиус капли в долях высоты блока
    threshold: 0.5, // порог слияния: ниже — капли крупнее и охотнее сливаются

    // --- палитра (один оттенок; светлота задаётся темой) ---
    hue: 0.03, // оттенок (0..1)
    saturation: 1.0, // насыщенность
    glow: 1.1, // ореол по краю
    gloss: 0.55, // сила блика — от неё зависит «объём»
    /* Насколько круто нормаль заваливается к краю капли: 0 — плоский диск,
       ~2 — шар, больше — «капля с бортиком». */
    relief: 2.0,

    // --- курсор ---
    cursorLava: 1, // капли тянутся за курсором + капля-курсор
    cursorPullLava: 0.4, // сила притяжения к курсору
    /* Радиус притяжения в долях высоты блока. За его пределами курсор на
       каплю не действует вовсе: иначе тянет отовсюду и все капли рано или
       поздно слипаются в одну на месте курсора. */
    cursorPullRadius: 0.35,
    cursorSize: 1.3, // размер капли-курсора относительно обычной

    // --- инфраструктура ---
    ratioCap: 2, // потолок devicePixelRatio
    pixelBudget: 2.2e6, // потолок площади буфера
    pauseOffscreen: true, // не жечь GPU вне экрана
    respectReducedMotion: true,
    pointer: true, // реагировать на курсор
    pointerFrom: 'window', // 'window' | 'self'
  }

  var VERT
    = 'attribute vec2 aPos;'
      + 'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'

  /* Поле метаболлов в аспектно-нормированном пространстве: x в [0, aspect],
     y в [0, 1]. Гауссова капля exp(-r2*k); сумма проходит через порог.
     Точки заворачиваются по тору на CPU, здесь этого не видно. */
  /* Поле метаболлов в аспектно-нормированном пространстве: x в [0, aspect],
     y в [0, 1]. Капля — гауссов холм exp(-r2*k); «лава» это сглаженный порог
     по сумме холмов, поэтому близкие капли сливаются непрерывно.

     Форму капле даёт освещение, а не второй цвет: вместе с полем в том же
     цикле копится его градиент, из него строится нормаль воображаемой
     поверхности, и по ней считаются диффуз, блик и френель по краю. Оттенок
     при этом один — смесь двух оттенков давала грязный бурый переход. */
  var FRAG = [
    'precision highp float;',

    'uniform vec2  uViewport;',
    'uniform float uClock;',
    'uniform float uCount;',
    'uniform vec2  uBlobs[' + MAX_BLOBS + '];',
    'uniform float uFalloff;',
    'uniform float uThreshold;',
    'uniform float uTurbulence;',
    'uniform float uHue;',
    'uniform float uSaturation;',
    'uniform float uLightness;',
    'uniform float uGlow;',
    'uniform float uGloss;',
    'uniform float uRelief;',
    'uniform vec2  uCursor;',
    'uniform float uCursorOn;',
    'uniform float uCursorFalloff;',

    // Шум для «турбулентности» поля — обычный value-noise.
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',

    'vec3 hsv2rgb(vec3 c){',
    '  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);',
    '  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uViewport;',
    '  float aspect = uViewport.x / uViewport.y;',
    '  vec2 p = vec2(uv.x * aspect, uv.y);',

    '  float turb = noise(p * 2.5 + vec2(uClock * 0.12, uClock * 0.08));',
    '  p += (turb - 0.5) * uTurbulence * 0.14;',

    '  float field = 0.0;',
    '  vec2 grad = vec2(0.0);',
    '  for (int i = 0; i < ' + MAX_BLOBS + '; i++){',
    '    if (float(i) >= uCount) break;',
    '    vec2 d = p - uBlobs[i];',
    '    float w = exp(-dot(d, d) * uFalloff);',
    '    field += w;',
    '    grad += w * (-2.0 * uFalloff) * d;',
    '  }',

    '  if (uCursorOn > 0.5) {',
    '    vec2 d = p - uCursor;',
    '    float w = exp(-dot(d, d) * uCursorFalloff);',
    '    field += w;',
    '    grad += w * (-2.0 * uCursorFalloff) * d;',
    '  }',

    '  float lava = smoothstep(uThreshold - 0.09, uThreshold + 0.09, field);',
    '  if (lava <= 0.002) { gl_FragColor = vec4(0.0); return; }',

    /* Нормаль берём не из градиента поля напрямую, а из высоты купола над
       порогом: h = sqrt(field - threshold). Голый градиент равен нулю и в
       центре капли, и на её краю, поэтому силуэт не отворачивался от света
       и капля читалась плоским пятном с градиентом. У корня производная на
       краю уходит в бесконечность — нормаль честно доворачивается до
       горизонтали, и появляется край шара.
       Наклон нормируем на размер капли (pitch), чтобы `relief` не зависел
       от blobSize и от разрешения. */
    '  float dome = max(field - uThreshold, 0.0);',
    '  float h = sqrt(dome);',
    '  float pitch = inversesqrt(max(uFalloff, 1.0));',
    '  vec2 slope = grad * pitch / max(2.0 * h, 0.03);',
    '  vec3 n = normalize(vec3(-slope * uRelief, 1.0));',

    '  vec3 viewDir = vec3(0.0, 0.0, 1.0);',
    '  vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.76));',
    '  float diffuse = max(dot(n, lightDir), 0.0);',
    /* Подсвет с противоположной стороны: без него теневая половина уходит в
       плоскую заливку и объём снова пропадает. */
    '  vec3 fillDir = normalize(vec3(0.5, -0.45, 0.5));',
    '  float fill = max(dot(n, fillDir), 0.0);',
    '  vec3 halfDir = normalize(lightDir + viewDir);',
    '  float spec = pow(max(dot(n, halfDir), 0.0), 90.0) * uGloss;',
    '  float fresnel = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);',

    '  vec3 base = hsv2rgb(vec3(uHue, uSaturation, uLightness));',
    '  vec3 col = base * (0.14 + 0.80 * diffuse + 0.28 * fill);',
    '  col += base * fresnel * uGlow * 0.55;',
    '  col += vec3(spec);',

    '  gl_FragColor = vec4(col * lava, lava);',
    '}',
  ].join('\n')

  function camel(name) {
    return name.replace(/-([a-z])/g, function (_, c) {
      return c.toUpperCase()
    })
  }

  function createShader(gl, type, source) {
    var sh = gl.createShader(type)
    gl.shaderSource(sh, source)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('GlukeMetaballs: ' + gl.getShaderInfoLog(sh))
    }
    return sh
  }

  function Widget(el, opts) {
    this.el = el
    this.o = {}
    for (var k in DEFAULTS) this.o[k] = DEFAULTS[k]
    if (opts) for (var p in opts) this.o[camel(p)] = opts[p]

    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'

    var canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    el.appendChild(canvas)
    this.canvas = canvas

    var gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
    if (!gl) {
      el.removeChild(canvas)
      throw new Error('GlukeMetaballs: WebGL недоступен')
    }
    this.gl = gl

    this.prog = gl.createProgram()
    gl.bindAttribLocation(this.prog, 0, 'aPos')
    gl.attachShader(this.prog, createShader(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(this.prog, createShader(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(this.prog)
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw new Error('GlukeMetaballs: ' + gl.getProgramInfoLog(this.prog))
    }

    // Полноэкранный треугольник — вершинный буфер создаётся один раз.
    var buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    var u = (this.u = {})
    u.uViewport = gl.getUniformLocation(this.prog, 'uViewport')
    u.uClock = gl.getUniformLocation(this.prog, 'uClock')
    u.uCount = gl.getUniformLocation(this.prog, 'uCount')
    u.uBlobs = gl.getUniformLocation(this.prog, 'uBlobs')
    u.uThreshold = gl.getUniformLocation(this.prog, 'uThreshold')
    u.uTurbulence = gl.getUniformLocation(this.prog, 'uTurbulence')
    u.uHue = gl.getUniformLocation(this.prog, 'uHue')
    u.uFalloff = gl.getUniformLocation(this.prog, 'uFalloff')
    u.uRelief = gl.getUniformLocation(this.prog, 'uRelief')
    u.uGloss = gl.getUniformLocation(this.prog, 'uGloss')
    u.uSaturation = gl.getUniformLocation(this.prog, 'uSaturation')
    u.uLightness = gl.getUniformLocation(this.prog, 'uLightness')
    u.uGlow = gl.getUniformLocation(this.prog, 'uGlow')
    u.uCursor = gl.getUniformLocation(this.prog, 'uCursor')
    u.uCursorOn = gl.getUniformLocation(this.prog, 'uCursorOn')
    u.uCursorFalloff = gl.getUniformLocation(this.prog, 'uCursorFalloff')

    this._blobPos = new Float32Array(MAX_BLOBS * 2)
    this._blobs = []
    this._aspect = 1
    this._visible = true
    this._running = false
    this._elapsed = 0
    this._hover = { x: 0.5, y: 0.5, inside: false }
    this._initBlobs()

    this.resize()
    this._pushStatic()
    this._bind()
    this.start()
  }

  Widget.prototype._initBlobs = function () {
    var n = Math.max(2, Math.min(MAX_BLOBS, Math.round(this.o.count)))
    var aspect = this._aspect
    var list = []
    for (var i = 0; i < n; i++) {
      list.push({
        x: Math.random() * aspect,
        y: Math.random(),
        // Разброс скоростей капель — как в звёздном поле: каждая дрейфует
        // со своей скоростью и своим курсом.
        s: 0.02 + Math.random() * 0.05,
        a: Math.random() * Math.PI * 2,
      })
    }
    this._blobs = list
  }

  Widget.prototype.resize = function () {
    var el = this.el, gl = this.gl
    var w = Math.max(1, el.clientWidth)
    var h = Math.max(1, el.clientHeight)
    var dpr = Math.min(this.o.ratioCap, global.devicePixelRatio || 1)
    var area = w * h * dpr * dpr
    if (area > this.o.pixelBudget) dpr *= Math.sqrt(this.o.pixelBudget / area)
    var bw = Math.max(1, Math.round(w * dpr))
    var bh = Math.max(1, Math.round(h * dpr))
    if (this.canvas.width !== bw) this.canvas.width = bw
    if (this.canvas.height !== bh) this.canvas.height = bh
    gl.viewport(0, 0, bw, bh)
    var aspect = bw / bh
    /* При смене формы контейнера растягиваем позиции капель по новой оси,
       чтобы лава оставалась равномерной, а не «сбивалась» в угол. */
    if (Math.abs(aspect - this._aspect) > 0.001 && this._blobs.length) {
      var scale = aspect / this._aspect
      for (var i = 0; i < this._blobs.length; i++) this._blobs[i].x *= scale
    }
    this._aspect = aspect
  }

  // Обновляет статичные юниформы, которые не меняются кадр в кадр.
  Widget.prototype._pushStatic = function () {
    var gl = this.gl, u = this.u, o = this.o
    gl.useProgram(this.prog)
    gl.uniform1f(u.uThreshold, o.threshold)
    gl.uniform1f(u.uTurbulence, o.turbulence)
    gl.uniform1f(u.uHue, o.hue)
    /* Жёсткость спада выводим из размера: поле капли падает до 0.5 ровно
       на расстоянии `size`, поэтому при пороге 0.5 радиус капли и есть
       `size`. Иначе «размер» пришлось бы подбирать на глаз. */
    var falloff = Math.log(2) / Math.max(1e-4, o.blobSize * o.blobSize)
    gl.uniform1f(u.uFalloff, falloff)
    gl.uniform1f(u.uGloss, o.gloss)
    gl.uniform1f(u.uRelief, o.relief)
    gl.uniform1f(u.uSaturation, o.saturation)
    gl.uniform1f(u.uLightness, o.lightness === undefined ? (o.theme === 'light' ? 0.38 : 0.62) : o.lightness)
    gl.uniform1f(u.uGlow, o.glow)
    gl.uniform1f(u.uCursorOn, (o.cursorLava && this._hover && this._hover.inside) ? 1 : 0)
    gl.uniform1f(u.uCursorFalloff, Math.log(2) / Math.max(1e-4, Math.pow(o.blobSize * o.cursorSize, 2)))
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

    if (typeof IntersectionObserver !== 'undefined' && this.o.pauseOffscreen) {
      this._io = new IntersectionObserver(function (entries) {
        var visible = entries[0] && entries[0].isIntersecting
        self._setVisible(!!visible)
      })
      this._io.observe(this.el)
    }

    this._onVis = function () {
      self._setVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', this._onVis)

    if (this.o.pointer) {
      this._onMove = function (e) {
        var rect = self.el.getBoundingClientRect()
        var cx = (e.clientX || 0) - rect.left
        var cy = (e.clientY || 0) - rect.top
        self._hover.x = rect.width > 0 ? Math.max(0, Math.min(rect.width, cx)) / rect.width : 0.5
        /* Ось Y в поле направлена снизу вверх (как gl_FragCoord), а `cy`
           считается от верхнего края блока — иначе капля-курсор оказывалась
           зеркально по вертикали, и связь с мышью не читалась. */
        self._hover.y = rect.height > 0 ? 1 - Math.max(0, Math.min(rect.height, cy)) / rect.height : 0.5
        self._hover.inside = true
      }
      var host = this.o.pointerFrom === 'window' ? global : this.el
      host.addEventListener('mousemove', this._onMove)
      if (this.o.pointerFrom === 'self') {
        host.addEventListener('touchmove', this._onMove, { passive: true })
      }
      this._hoverHost = host
    }
  }

  Widget.prototype._setVisible = function (visible) {
    this._visible = visible
    if (visible) this.start()
    else this.stop()
  }

  Widget.prototype._frame = function (now) {
    var self = this
    this._raf = requestAnimationFrame(function (t) {
      self._frame(t)
    })

    var gl = this.gl, u = this.u, o = this.o
    var time = (now - this._t0) * 0.001

    if (this.el.clientWidth !== this._w || this.el.clientHeight !== this._h) {
      this._w = this.el.clientWidth
      this._h = this.el.clientHeight
      this.resize()
    }

    // Дрейф капель: каждая идёт своим курсом, медленно меняя направление.
    var blobs = this._blobs
    var aspect = this._aspect
    var dt = Math.min(1 / 30, 1 / 60)
    var speed = o.speed * dt
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i]
      b.a += (Math.random() - 0.5) * 0.35 * dt * 6

      // Притяжение к курсору, если включено.
      if (o.cursorLava && this._hover.inside) {
        var cx = this._hover.x * aspect
        var cy = this._hover.y
        var dx = cx - b.x
        var dy = cy - b.y
        var dist = Math.sqrt(dx * dx + dy * dy) || 1
        var want = Math.atan2(dy, dx)
        var da = want - b.a
        while (da > Math.PI) da -= Math.PI * 2
        while (da < -Math.PI) da += Math.PI * 2
        /* Спад к границе радиуса, плавный: у самого края притяжение
           сходит в ноль, поэтому капля не дёргается, пересекая границу. */
        var reach = Math.max(1e-3, o.cursorPullRadius)
        var t = Math.max(0, 1 - dist / reach)
        var near = t * t * (3 - 2 * t)
        if (near > 0) b.a += da * Math.min(1, o.cursorPullLava * dt * 14) * near
      }

      b.x += Math.cos(b.a) * b.s * speed * 60 * 0.016
      b.y += Math.sin(b.a) * b.s * speed * 60 * 0.016

      // Тор: улетевшие вправо появляются слева, улетевшие вверх — снизу.
      if (b.x > aspect) b.x -= aspect
      if (b.x < 0) b.x += aspect
      if (b.y > 1) b.y -= 1
      if (b.y < 0) b.y += 1

      this._blobPos[i * 2] = b.x
      this._blobPos[i * 2 + 1] = b.y
    }

    gl.useProgram(this.prog)
    gl.uniform2f(u.uViewport, this.canvas.width, this.canvas.height)
    gl.uniform1f(u.uClock, time)
    gl.uniform1f(u.uCount, blobs.length)
    gl.uniform2fv(u.uBlobs, this._blobPos)
    gl.uniform2f(u.uCursor, this._hover.x * aspect, this._hover.y)
    // Каплю-курсор показываем только когда курсор действительно появился:
    // иначе она висит в центре блока с первого кадра и читается как
    // посторонний яркий шар. Притяжение капель проверяет то же условие.
    gl.uniform1f(u.uCursorOn, (o.cursorLava && this._hover && this._hover.inside) ? 1 : 0)

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  Widget.prototype.start = function () {
    if (this._running || document.hidden || !this._visible) return
    this._running = true
    var self = this
    this._t0 = performance.now() - (this._elapsed || 0) * 1000
    this._raf = requestAnimationFrame(function (t) {
      self._frame(t)
    })
  }

  Widget.prototype.stop = function () {
    if (!this._running) return
    this._running = false
    this._elapsed = (performance.now() - this._t0) * 0.001
    cancelAnimationFrame(this._raf)
  }

  /** Обновить параметры на лету: metaballs.set({ count: 8, speed: 1.2 }) */
  Widget.prototype.set = function (patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) this.o[camel(k)] = patch[k]
    if (typeof patch.count === 'number' && Math.round(patch.count) !== this._blobs.length) {
      this._initBlobs()
    }
    this._pushStatic()
    return this
  }

  Widget.prototype._unbind = function () {
    if (this._ro) this._ro.disconnect()
    else if (this._onResize) global.removeEventListener('resize', this._onResize)
    if (this._io) this._io.disconnect()
    document.removeEventListener('visibilitychange', this._onVis)
    if (this._onMove && this._hoverHost) {
      this._hoverHost.removeEventListener('mousemove', this._onMove)
      this._hoverHost.removeEventListener('touchmove', this._onMove)
    }
    this._ro = null
    this._io = null
    this._onResize = null
    this._onMove = null
    this._hoverHost = null
  }

  Widget.prototype.detach = function () {
    this.stop()
    this._unbind()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    return this
  }

  Widget.prototype.reattach = function (el) {
    var node = typeof el === 'string' ? document.querySelector(el) : el
    if (!node) throw new Error('GlukeMetaballs: контейнер не найден')
    this.stop()
    this._unbind()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
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
    if (this._ro) this._ro.disconnect()
    else global.removeEventListener('resize', this._onResize)
    if (this._io) this._io.disconnect()
    document.removeEventListener('visibilitychange', this._onVis)
    if (this._onMove && this._hoverHost) {
      this._hoverHost.removeEventListener('mousemove', this._onMove)
      this._hoverHost.removeEventListener('touchmove', this._onMove)
    }
    var ext = this.gl.getExtension('WEBGL_lose_context')
    if (ext) ext.loseContext()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
  }

  var API = {
    defaults: DEFAULTS,
    instances: [],
    create: function (el, opts) {
      var w = new Widget(el, opts)
      API.instances.push(w)
      return w
    },
  }

  return API
})(typeof window !== 'undefined' ? window : this)

export default GlukeMetaballs
