/*!
 * GlukePyramid — светящаяся 3D-пирамида на чистом WebGL, без зависимостей.
 * Виджет кейса `pyramid`, не библиотека из npm.
 *
 * Автор: Александр Глухов (GLUKE, https://gluke.ru, @Gluke_art).
 * © GLUKE, 2026. Свободное использование и доработка допускаются с сохранением
 * этой шапки и ссылки на gluke.ru; перепродажа движка как самостоятельного
 * продукта или выдача его за чужую разработку — без письменного согласия
 * автора. При сомнениях — gluke_art@mail.ru.
 *
 * Особенности реализации:
 *   1. Модуль экспортируется как ES-модуль;
 *   2. автозапуск по DOMContentLoaded убран: в SPA он бы сканировал
 *      документ при импорте и создавал контексты в обход жизненного цикла Vue.
 *      Экземпляры создаёт ProjectPyramidDemo.vue и он же их уничтожает;
 *   3. добавлены методы перецепления `detach()`/`reattach()`: виджеты кейсов
 *      кэшируются между перемонтированиями (смена языка), чтобы не создавать
 *      заново WebGL-контекст и не перекачивать логотипы;
 *   4. имена приведены к словарю проекта: параметры (`rise`, `baseSpan`, `zoom`,
 *      `radiance`, `swayX`, `marks`…), юниформы и внутренние функции. Сама
 *      математика не тронута — переименование сверено попиксельно, кадр до и
 *      после совпадает побайтово.
 *
 * Техника: SDF-пирамида, объёмный raymarch (MARCH_STEPS = 100 на пиксель).
 */

const GlukePyramid = (function (global) {
  'use strict';

  var DEFAULTS = {
    // --- геометрия ---
    rise: 2.0,          // высота пирамиды
    baseSpan: 3.5,       // ширина основания
    zoom: 2.0,           // «зум» камеры (больше — мельче объект)
    offsetX: 0,           // сдвиг в пикселях
    offsetY: 0,

    // --- материал / цвет ---
    radiance: 1.0,            // общая яркость свечения
    flare: 1.0,           // засветка
    vividness: 1.45,     // насыщенность
    hueTurn: 0,          // доворот оттенка, радианы
    hues: [0, 1, 2],     // фазы R/G/B — главный регулятор палитры
    bandRate: 1.0,  // частота радужных полос
    wash: '#ffffff',      // финальный подкрас
    grain: 0.0,           // зерно

    // --- анимация ---
    drift: 0.22,           // скорость собственного вращения
    flowRate: 0.5,       // скорость «переливания» материала
    lean: 0.18,           // базовый наклон вперёд, радианы

    // --- мышь ---
    pointer: true,
    recoil: true,         // обратная зависимость: призма уходит от курсора
    swayX: 0.85,  // сила отклика по горизонтали (радианы на пол-экрана)
    swayY: 0.35, // по вертикали
    easing: 0.055,       // сглаживание (меньше — плавнее и «тяжелее»)
    pointerFrom: 'window',// 'window' | 'self' — откуда ловить курсор

    // --- логотипы на гранях ---
    marks: [],            // до 4 шт: URL / data-URI, по одному на грань
    markSize: 0.44,      // размер лого относительно высоты грани
    markHeight: 0.36,          // положение по грани: 0 — низ, 1 — вершина
    markGlow: 16,         // насколько лого ярче материала (оттенок при этом не меняется)
    markDepth: 0.13,      // толщина «плёнки» лого внутри грани

    // --- прочее ---
    ratioCap: 2,               // потолок devicePixelRatio
    pixelBudget: 2.2e6,     // потолок по площади буфера (защита fps на retina/4K)
    narrowFit: 0.9,        // на узких экранах масштаб считается от ширины
    pauseOffscreen: true, // не жечь GPU, когда блок вне экрана
    respectReducedMotion: true
  };

  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',

    'uniform vec2  uViewport;',
    'uniform vec2  uShift;',
    'uniform float uClock;',
    'uniform mat3  uOrient;',

    'uniform float uBaseInv;',
    'uniform float uRiseInv;',
    'uniform float uThinAxis;',
    'uniform float uUnitPerPx;',
    'uniform float uPivotLift;',

    'uniform float uRadiance;',
    'uniform float uFlare;',
    'uniform float uVivid;',
    'uniform float uHueTurn;',
    'uniform float uBandRate;',
    'uniform float uGrain;',
    'uniform vec3  uWash;',
    'uniform float uMarkGlow;',
    'uniform vec3  uHues;',   // фазы R/G/B в радужной формуле — главный регулятор палитры

    '#ifdef HAS_LOGO',
    'uniform sampler2D uMarkAtlas;',
    'uniform float uSpanHalf;',
    'uniform float uRise;',
    'uniform float uMarkSize;',
    'uniform float uMarkHeight;',
    'uniform float uMarkDepth;',
    'uniform vec4  uMarkOn;',   // включена ли грань 0..3
    'uniform vec3  uMarchDir;',   // направление луча в локальных координатах
    '#endif',

    // tanh для vec4 (в GLSL ES 1.0 его нет)
    'vec4 tanh4(vec4 x){ vec4 e = exp(2.0 * x); return (e - 1.0) / (e + 1.0); }',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }',

    // Анизотропный октаэдр, обрезанный снизу -> пирамида с квадратным
    // основанием (повёрнутым на 45°), вершина в +Y.
    'float sdPyramid(vec3 p){',
    '  vec3 q = vec3(abs(p.x) * uBaseInv, abs(p.y) * uRiseInv, abs(p.z) * uBaseInv);',
    '  float oct = (q.x + q.y + q.z - 1.0) * uThinAxis * 0.57735026;',
    '  return max(oct, -p.y);',
    '}',

    'mat3 hueRot(float a){',
    '  float c = cos(a), s = sin(a);',
    '  mat3 W = mat3(0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114);',
    '  mat3 U = mat3(0.701, -0.587, -0.114, -0.299, 0.413, -0.114, -0.300, -0.588, 0.886);',
    '  mat3 V = mat3(0.168, -0.331, 0.500, 0.328, 0.035, -0.500, -0.497, 0.296, 0.201);',
    '  return W + U * c + V * s;',
    '}',

    '#ifdef HAS_LOGO',
    // Проекция точки на грань пирамиды -> маска логотипа.
    // Грань выбирается знаками x и z: это и есть номер тайла в атласе 2x2.
    'float logoMask(vec3 q){',
    '  float t = clamp(q.y * uRiseInv, 0.0, 1.0);',       // 0 у основания, 1 у вершины
    '  float sx = q.x >= 0.0 ? 1.0 : -1.0;',
    '  float sz = q.z >= 0.0 ? 1.0 : -1.0;',
    '  float face = (sx > 0.0 ? 1.0 : 0.0) + (sz > 0.0 ? 2.0 : 0.0);',
    '  float on = face < 0.5 ? uMarkOn.x : (face < 1.5 ? uMarkOn.y : (face < 2.5 ? uMarkOn.z : uMarkOn.w));',
    '  if (on < 0.5) return 0.0;',
    // только грани, повёрнутые к зрителю — иначе логотип читается зеркально «насквозь»
    '  vec3 n = normalize(vec3(sx * uBaseInv, uRiseInv, sz * uBaseInv));',
    '  float facing = -dot(n, uMarchDir);',
    '  if (facing <= 0.0) return 0.0;',
    // координата вдоль ребра основания
    '  float denom = max(1e-4, (1.0 - t) * uSpanHalf);',
    '  float s = clamp((sz * q.z) / denom, 0.0, 1.0);',
    '  float edge = uSpanHalf * 1.41421356;',                    // длина ребра основания
    '  float slant = sqrt(uSpanHalf * uSpanHalf * 0.5 + uRise * uRise);',
    '  float size = max(1e-4, slant * uMarkSize);',
    // разворот грани наружу: у двух граней из четырёх обход рёбер идёт в обратную сторону
    '  float u = (s - 0.5) * -(sx * sz) * edge * (1.0 - t);', // поперёк грани
    '  float w = (t - uMarkHeight) * slant;',                     // вдоль грани, от центра лого
    '  vec2 uv = vec2(u / size + 0.5, 0.5 - w / size);',
    '  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;',
    // тайл атласа 2x2 с отступом от швов
    '  vec2 tile = vec2(mod(face, 2.0), floor(face * 0.5));',
    '  vec2 auv = (clamp(uv, 0.002, 0.998) + tile) * 0.5;',
    '  return texture2D(uMarkAtlas, auv).a * smoothstep(0.0, 0.35, facing);',
    '}',
    '#endif',

    'void main(){',
    '  vec2 f = (gl_FragCoord.xy - 0.5 * uViewport - uShift) * uUnitPerPx;',

    '  float z = 5.0;',
    '  float d = 0.0;',
    '  vec3 p;',
    '  vec4 o = vec4(0.0);',
    '  float lacc = 0.0;',
    '  float tm = uClock;',

    '  const int MARCH_STEPS = 100;',
    '  for (int i = 0; i < MARCH_STEPS; i++) {',
    '    p = uOrient * vec3(f, z);',
    '    vec3 q = p; q.y += uPivotLift;',
    '    float sd = sdPyramid(q);',
    '    d = 0.1 + 0.2 * abs(sd);',
    '    z -= d;',
    '#ifdef HAS_LOGO',
    // лого — не наклейка: копим его отдельным каналом в тонкой плёнке у поверхности грани,
    // чтобы потом подсветить им тот же материал, не сдвигая оттенок
    '    if (abs(sd) < uMarkDepth) {',
    '      float film = 1.0 - abs(sd) / uMarkDepth;',
    '      lacc += logoMask(q) * film * film / d;',
    '    }',
    '#endif',
    '    vec4 band = (sin((p.y + z) * uBandRate + vec4(uHues, 3.0) + tm * 0.15) + 1.0);',
    '    o += band / d;',
    '  }',

    '  o = tanh4(o * o * (uRadiance * uFlare) / 1e5);',

    '  vec3 col = o.rgb;',
    '  float lf = 1.0 - exp(-lacc * uMarkGlow * 3e-3);',   // 0..1, плотность логотипа
    '  col = col * (1.0 + lf * 1.35) + vec3(lf * 0.10);',  // ярче в том же оттенке + лёгкий подъём
    '  if (uGrain > 0.0) col += (hash(gl_FragCoord.xy + vec2(uClock)) - 0.5) * uGrain;',
    '  col = clamp(col, 0.0, 1.0);',
    '  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = clamp(mix(vec3(L), col, uVivid), 0.0, 1.0);',
    '  if (abs(uHueTurn) > 0.0001) col = clamp(hueRot(uHueTurn) * col, 0.0, 1.0);',
    '  col *= uWash;',
    '  gl_FragColor = vec4(col, clamp(o.a + lf * 0.25, 0.0, 1.0));',
    '}'
  ].join('\n');

  // ---------------------------------------------------------------- утилиты

  function camel(s) {
    return s.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
  }

  function readDataset(el) {
    var out = {};
    for (var key in el.dataset) {
      if (!Object.prototype.hasOwnProperty.call(el.dataset, key)) continue;
      var v = el.dataset[key];
      if (v === 'true') { out[key] = true; continue; }
      if (v === 'false') { out[key] = false; continue; }
      if (v.indexOf(',') > -1) {
        // списки: data-marks="a.svg,b.svg", data-hues="1,4.3,2.2"
        var parts = v.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s.length; });
        var nums = parts.every(function (s) { return /^-?[\d.]+$/.test(s); });
        out[key] = nums ? parts.map(parseFloat) : parts;
        continue;
      }
      var n = parseFloat(v);
      out[key] = (!isNaN(n) && isFinite(n) && /^-?[\d.]+$/.test(v.trim())) ? n : v;
    }
    if (typeof out.marks === 'string') out.marks = [out.marks];
    return out;
  }

  function hexToRgb(c) {
    if (Array.isArray(c)) return c;
    var s = String(c).replace('#', '').trim();
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    if (isNaN(n)) return [1, 1, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('GlukePyramid shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  // Ry(yaw) * Rx(pitch), сразу в column-major для uniformMatrix3fv
  function orientMatrix(out, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cx = Math.cos(pitch), sx = Math.sin(pitch);
    // строки: [cy, sy*sx, sy*cx] [0, cx, -sx] [-sy, cy*sx, cy*cx]
    out[0] = cy;       out[1] = 0;   out[2] = -sy;
    out[3] = sy * sx;  out[4] = cx;  out[5] = cy * sx;
    out[6] = sy * cx;  out[7] = -sx; out[8] = cy * cx;
    return out;
  }

  /**
   * SVG из Illustrator часто идёт без width/height — браузер даёт ему
   * дефолтные 300x150, и логотип уезжает в леттербокс. Достаём viewBox и
   * пересобираем svg с явными размерами. Если fetch не прошёл (CORS/file://) —
   * грузим как есть.
   */
  function sizeSvg(url, cb) {
    if (!/\.svg(\?|#|$)/i.test(url)) return cb(url);
    fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(); }).then(function (txt) {
      var m = txt.match(/viewBox\s*=\s*"([^"]+)"/i);
      if (!m) return cb(url);
      var vb = m[1].trim().split(/[\s,]+/).map(parseFloat);
      var w = vb[2], h = vb[3];
      if (!w || !h) return cb(url);
      var k = 1024 / Math.max(w, h);
      var out = txt
        .replace(/\swidth\s*=\s*"[^"]*"/i, '')
        .replace(/\sheight\s*=\s*"[^"]*"/i, '')
        .replace(/<svg/i, '<svg width="' + Math.round(w * k) + '" height="' + Math.round(h * k) + '"');
      cb('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out));
    }).catch(function () { cb(url); });
  }

  /**
   * Собирает до 4 логотипов в один атлас 2x2 — один сэмпл текстуры на шаг
   * марширования вместо четырёх. Кросс-доменные картинки должны отдаваться
   * с CORS-заголовками, иначе canvas будет «tainted» (data-URI работают всегда).
   */
  function buildMarkAtlas(urls, tileSize, done) {
    var TILE = tileSize || 512;
    var PAD = Math.round(TILE * 0.06);
    var cv = document.createElement('canvas');
    cv.width = cv.height = TILE * 2;
    var ctx = cv.getContext('2d');
    var on = [0, 0, 0, 0];
    var left = 0, fired = false;

    function finish() {
      if (fired) return;
      fired = true;
      done(cv, on);
    }

    urls.slice(0, 4).forEach(function (url, i) {
      if (!url) return;
      left++;
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        var box = TILE - PAD * 2;
        var k = Math.min(box / (img.naturalWidth || img.width), box / (img.naturalHeight || img.height));
        var w = (img.naturalWidth || img.width) * k;
        var h = (img.naturalHeight || img.height) * k;
        var ox = (i % 2) * TILE + (TILE - w) / 2;
        var oy = Math.floor(i / 2) * TILE + (TILE - h) / 2;
        ctx.drawImage(img, ox, oy, w, h);
        on[i] = 1;
        if (--left === 0) finish();
      };
      img.onerror = function () {
        console.warn('GlukePyramid: не загрузился логотип', url);
        if (--left === 0) finish();
      };
      sizeSvg(url, function (src) { img.src = src; });
    });

    if (left === 0) finish();
  }

  // ------------------------------------------------------------------ класс

  function Widget(container, options) {
    if (!(this instanceof Widget)) return new Widget(container, options);
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.el) throw new Error('GlukePyramid: контейнер не найден');

    var o = {};
    var src = [DEFAULTS, readDataset(this.el), options || {}];
    for (var i = 0; i < src.length; i++) {
      for (var k in src[i]) if (Object.prototype.hasOwnProperty.call(src[i], k)) o[camel(k)] = src[i][k];
    }
    this.o = o;

    this._raf = 0;
    this._running = false;
    this._visible = true;
    this._t0 = performance.now();
    this._turn = 0;
    this._lean = o.lean;
    this._wantTurn = 0;
    this._wantLean = o.lean;
    this._rot = new Float32Array(9);
    this._pointer = { x: 0, y: 0 };

    if (o.respectReducedMotion &&
        global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.o.spin = 0;
      this.o.timeScale = 0;
    }

    this._initGL();
    this._bind();
    this.resize();
    this.start();
  }

  Widget.prototype._initGL = function () {
    var o = this.o;
    var cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    if (getComputedStyle(this.el).position === 'static') this.el.style.position = 'relative';
    this.el.appendChild(cv);
    this.canvas = cv;

    var gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' })
          || cv.getContext('experimental-webgl', { alpha: true, antialias: false });
    if (!gl) throw new Error('GlukePyramid: WebGL недоступен');
    this.gl = gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    this._hasMark = !!(o.marks && o.marks.length);
    var frag = (this._hasMark ? '#define HAS_LOGO\n' : '') + FRAG;

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('GlukePyramid link: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    this.prog = prog;

    // полноэкранный треугольник
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(prog, name);
    }
    this.u = u;

    if (this._hasMark) {
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(u.uMarkAtlas, 0);
      gl.uniform4f(u.uMarkOn, 0, 0, 0, 0);
      this.setMarks(o.marks);
    }

    this._pushStatic();
  };

  // Параметры, которые не меняются каждый кадр
  Widget.prototype._pushStatic = function () {
    var gl = this.gl, u = this.u, o = this.o;
    gl.useProgram(this.prog);
    var H = Math.max(0.001, o.rise);
    var half = Math.max(0.001, o.baseSpan) * 0.5;

    gl.uniform1f(u.uBaseInv, 1 / half);
    gl.uniform1f(u.uRiseInv, 1 / H);
    gl.uniform1f(u.uThinAxis, Math.min(half, H));
    gl.uniform1f(u.uPivotLift, H * 0.25);
    gl.uniform1f(u.uRadiance, Math.max(0, o.radiance));
    gl.uniform1f(u.uFlare, Math.max(0, o.flare));
    gl.uniform1f(u.uVivid, o.vividness);
    gl.uniform1f(u.uHueTurn, o.hueTurn);
    gl.uniform1f(u.uBandRate, Math.max(0, o.bandRate));
    gl.uniform1f(u.uGrain, Math.max(0, o.grain));
    var t = hexToRgb(o.wash);
    gl.uniform3f(u.uWash, t[0], t[1], t[2]);
    var ph = o.hues || [0, 1, 2];
    gl.uniform3f(u.uHues, ph[0], ph[1], ph[2]);
    gl.uniform1f(u.uMarkGlow, o.markGlow);

    if (this._hasMark) {
      gl.uniform1f(u.uSpanHalf, half);
      gl.uniform1f(u.uRise, H);
      gl.uniform1f(u.uMarkSize, o.markSize);
      gl.uniform1f(u.uMarkHeight, o.markHeight);
      gl.uniform1f(u.uMarkDepth, Math.max(0.005, o.markDepth));
    }
  };

  Widget.prototype.setMarks = function (urls) {
    var self = this;
    if (!this._hasMark) {
      console.warn('GlukePyramid: создайте виджет с непустым logos, чтобы включить логотипы');
      return;
    }
    buildMarkAtlas(urls, 512, function (cv, on) {
      var gl = self.gl;
      gl.useProgram(self.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, self.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
        gl.uniform4f(self.u.uMarkOn, on[0], on[1], on[2], on[3]);
      } catch (e) {
        // tainted canvas: картинка с другого домена без CORS
        console.warn('GlukePyramid: логотипы не загружены (CORS). Используйте data-URI или свой домен.', e);
      }
    });
  };

  Widget.prototype.resize = function () {
    var gl = this.gl, o = this.o;
    var w = Math.max(1, this.el.clientWidth);
    var h = Math.max(1, this.el.clientHeight);
    this._w = this.el.clientWidth;
    this._h = this.el.clientHeight;

    var dpr = Math.min(o.ratioCap || 2, global.devicePixelRatio || 1);
    // потолок по числу пикселей: шейдер тяжёлый, на retina/4K иначе просядет fps
    var maxPx = o.pixelBudget || 2.2e6;
    if (w * h * dpr * dpr > maxPx) dpr = Math.max(0.75, Math.sqrt(maxPx / (w * h)));

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uViewport, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.uShift, o.offsetX * dpr, o.offsetY * dpr);

    // масштаб считаем от высоты, но на узких экранах — от ширины,
    // иначе на телефоне призма вылезает за края
    var ref = Math.min(this.canvas.height, this.canvas.width / (o.narrowFit || 0.9));
    gl.uniform1f(this.u.uUnitPerPx, 1 / (ref * 0.1 * Math.max(0.001, o.zoom)));
  };

  Widget.prototype._bind = function () {
    var self = this, o = this.o;
    this._onResize = function () { self.resize(); };

    if (global.ResizeObserver) {
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(this.el);
    } else {
      global.addEventListener('resize', this._onResize);
    }

    if (o.pointer) {
      var host = o.pointerFrom === 'self' ? this.el : global;
      this._onMove = function (e) {
        var pt = e.touches && e.touches[0] ? e.touches[0] : e;
        var r = self.el.getBoundingClientRect();
        var nx = ((pt.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
        var ny = ((pt.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
        var s = o.recoil ? -1 : 1;
        self._wantTurn = s * Math.max(-1.6, Math.min(1.6, nx)) * o.swayX;
        self._wantLean = o.lean + s * Math.max(-1.6, Math.min(1.6, ny)) * o.swayY;
      };
      this._hoverHost = host;
      host.addEventListener('mousemove', this._onMove, { passive: true });
      host.addEventListener('touchmove', this._onMove, { passive: true });
    }

    this._onVis = function () {
      if (document.hidden) self.stop(); else self.start();
    };
    document.addEventListener('visibilitychange', this._onVis);

    if (o.pauseOffscreen && global.IntersectionObserver) {
      this._io = new IntersectionObserver(function (entries) {
        self._visible = entries[0].isIntersecting;
        if (self._visible) self.start(); else self.stop();
      }, { threshold: 0 });
      this._io.observe(this.el);
    }
  };

  Widget.prototype._frame = function (now) {
    var self = this;
    this._raf = requestAnimationFrame(function (t) { self._frame(t); });

    var gl = this.gl, u = this.u, o = this.o;
    var time = (now - this._t0) * 0.001;

    // страховка на случай, если контейнер сменил размер без ResizeObserver
    // (табы, аккордеоны, ленивые лейауты на чужих сайтах)
    if (this.el.clientWidth !== this._w || this.el.clientHeight !== this._h) this.resize();

    // собственное вращение + инерционный отклик на курсор
    var k = Math.max(0.001, Math.min(1, o.easing));
    this._turn += (this._wantTurn - this._turn) * k;
    this._lean += (this._wantLean - this._lean) * k;

    var yaw = this._turn + time * o.drift;
    var pitch = this._lean + Math.sin(time * 0.35) * 0.035;

    gl.useProgram(this.prog);
    var m = orientMatrix(this._rot, yaw, pitch);
    gl.uniformMatrix3fv(u.uOrient, false, m);
    // направление марширования в локальных координатах: uOrient * (0,0,-1)
    if (this._hasMark) gl.uniform3f(u.uMarchDir, -m[6], -m[7], -m[8]);
    gl.uniform1f(u.uClock, time * o.flowRate);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  Widget.prototype.start = function () {
    if (this._running || document.hidden || !this._visible) return;
    this._running = true;
    var self = this;
    this._t0 = performance.now() - (this._elapsed || 0) * 1000;
    this._raf = requestAnimationFrame(function (t) { self._frame(t); });
  };

  Widget.prototype.stop = function () {
    if (!this._running) return;
    this._running = false;
    this._elapsed = (performance.now() - this._t0) * 0.001;
    cancelAnimationFrame(this._raf);
  };

  /** Обновить любые параметры на лету: pyramid.set({ hueTurn: 2.0 }) */
  Widget.prototype.set = function (patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) this.o[camel(k)] = patch[k];
    this._pushStatic();
    this.resize();
    if (patch.marks) this.setMarks(patch.marks);
    return this;
  };

  // Отвязывает слушатели и наблюдатели от текущего контейнера — общая часть
  // для detach() и reattach(). Сам канвас и WebGL-ресурсы не трогает.
  Widget.prototype._unbind = function () {
    if (this._ro) this._ro.disconnect();
    else if (this._onResize) global.removeEventListener('resize', this._onResize);
    if (this._io) this._io.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    if (this._onMove && this._hoverHost) {
      this._hoverHost.removeEventListener('mousemove', this._onMove);
      this._hoverHost.removeEventListener('touchmove', this._onMove);
    }
    this._ro = null;
    this._io = null;
    this._onResize = null;
    this._onMove = null;
    this._hoverHost = null;
  };

  // Снимает виджет с контейнера, не уничтожая его: WebGL-контекст, шейдеры
  // и текстура логотипов остаются в инстансе для перецепления (reattach).
  Widget.prototype.detach = function () {
    this.stop();
    this._unbind();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    return this;
  };

  // Перецепляет сохранённый виджет на новый контейнер: тот же контекст,
  // та же текстура логотипов, анимация продолжается без скачка времени
  // (start() учитывает накопленный _elapsed).
  Widget.prototype.reattach = function (el) {
    var node = typeof el === 'string' ? document.querySelector(el) : el;
    if (!node) throw new Error('GlukePyramid: контейнер не найден');
    this.stop();
    this._unbind();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.el = node;
    if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
    node.appendChild(this.canvas);
    this._visible = true;
    this.resize();
    this._bind();
    this.start();
    return this;
  };

  Widget.prototype.destroy = function () {
    this.stop();
    if (this._ro) this._ro.disconnect(); else global.removeEventListener('resize', this._onResize);
    if (this._io) this._io.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    if (this._onMove && this._hoverHost) {
      this._hoverHost.removeEventListener('mousemove', this._onMove);
      this._hoverHost.removeEventListener('touchmove', this._onMove);
    }
    var ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };

  // ------------------------------------------------------------- авто-запуск

  var API = {
    defaults: DEFAULTS,
    instances: [],
    create: function (el, opts) {
      var p = new Widget(el, opts);
      API.instances.push(p);
      return p;
    },
    auto: function (selector) {
      var nodes = document.querySelectorAll(selector || '.gluke-pyramid,[data-gluke-pyramid]');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].__glukePyramid) continue;
        try {
          nodes[i].__glukePyramid = API.create(nodes[i]);
        } catch (e) { console.error(e); }
      }
      return API.instances;
    }
  };

  return API;
})(typeof window !== 'undefined' ? window : this);

export default GlukePyramid
