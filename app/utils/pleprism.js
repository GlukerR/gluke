/*!
 * Pleprism — объёмная 3D-призма на чистом WebGL, без зависимостей.
 * Вендорим как есть: это самостоятельный виджет студии, показанный в кейсе
 * `pleprism`, а не библиотека из npm. Правки в алгоритм не вносим — источник
 * D:/Work/WEB/pleprism/prism.js.
 *
 * От оригинала отличается ровно двумя вещами, обе нужны для работы в Nuxt:
 *   1. IIFE присваивается переменной и экспортируется как ES-модуль —
 *      исходный UMD-хвост (`global.Pleprism` + `module.exports`) в ESM-сборке
 *      не годится;
 *   2. убран автозапуск `API.auto()` по DOMContentLoaded: в SPA он бы сканировал
 *      документ при импорте и создавал контексты в обход жизненного цикла Vue.
 *      Экземпляры создаёт ProjectPrismDemo.vue и он же их уничтожает.
 *
 * Техника: SDF-пирамида, объёмный raymarch (STEPS = 100 на пиксель).
 */

const Pleprism = (function (global) {
  'use strict';

  var DEFAULTS = {
    // --- геометрия ---
    height: 2.0,          // высота пирамиды
    baseWidth: 3.5,       // ширина основания
    scale: 2.0,           // «зум» камеры (больше — мельче объект)
    offsetX: 0,           // сдвиг в пикселях
    offsetY: 0,

    // --- материал / цвет ---
    glow: 1.0,            // общая яркость свечения
    bloom: 1.0,           // засветка
    saturation: 1.45,     // насыщенность
    hueShift: 0,          // доворот оттенка, радианы
    phase: [0, 1, 2],     // фазы R/G/B — главный регулятор палитры
    colorFrequency: 1.0,  // частота радужных полос
    tint: '#ffffff',      // финальный подкрас
    noise: 0.0,           // зерно

    // --- анимация ---
    spin: 0.22,           // скорость собственного вращения
    timeScale: 0.5,       // скорость «переливания» материала
    tilt: 0.18,           // базовый наклон вперёд, радианы

    // --- мышь ---
    hover: true,
    invert: true,         // обратная зависимость: призма уходит от курсора
    hoverStrength: 0.85,  // сила отклика по горизонтали (радианы на пол-экрана)
    hoverStrengthY: 0.35, // по вертикали
    inertia: 0.055,       // сглаживание (меньше — плавнее и «тяжелее»)
    hoverTarget: 'window',// 'window' | 'self' — откуда ловить курсор

    // --- логотипы на гранях ---
    logos: [],            // до 4 шт: URL / data-URI, по одному на грань
    logoScale: 0.44,      // размер лого относительно высоты грани
    logoY: 0.36,          // положение по грани: 0 — низ, 1 — вершина
    logoGlow: 16,         // насколько лого ярче материала (оттенок при этом не меняется)
    logoDepth: 0.13,      // толщина «плёнки» лого внутри грани

    // --- прочее ---
    dpr: 2,               // потолок devicePixelRatio
    maxPixels: 2.2e6,     // потолок по площади буфера (защита fps на retina/4K)
    fitWidth: 0.9,        // на узких экранах масштаб считается от ширины
    pauseOffscreen: true, // не жечь GPU, когда блок вне экрана
    respectReducedMotion: true
  };

  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',

    'uniform vec2  uRes;',
    'uniform vec2  uOffset;',
    'uniform float uTime;',
    'uniform mat3  uRot;',

    'uniform float uInvHalf;',
    'uniform float uInvHeight;',
    'uniform float uMinAxis;',
    'uniform float uPxScale;',
    'uniform float uCenterShift;',

    'uniform float uGlow;',
    'uniform float uBloom;',
    'uniform float uSat;',
    'uniform float uHue;',
    'uniform float uColorFreq;',
    'uniform float uNoise;',
    'uniform vec3  uTint;',
    'uniform float uLogoGlow;',
    'uniform vec3  uPhase;',   // фазы R/G/B в радужной формуле — главный регулятор палитры

    '#ifdef HAS_LOGO',
    'uniform sampler2D uAtlas;',
    'uniform float uHalf;',
    'uniform float uHeight;',
    'uniform float uLogoScale;',
    'uniform float uLogoY;',
    'uniform float uLogoDepth;',
    'uniform vec4  uLogoOn;',   // включена ли грань 0..3
    'uniform vec3  uRayDir;',   // направление луча в локальных координатах
    '#endif',

    // tanh для vec4 (в GLSL ES 1.0 его нет)
    'vec4 tanh4(vec4 x){ vec4 e = exp(2.0 * x); return (e - 1.0) / (e + 1.0); }',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }',

    // Анизотропный октаэдр, обрезанный снизу -> пирамида с квадратным
    // основанием (повёрнутым на 45°), вершина в +Y.
    'float sdPyramid(vec3 p){',
    '  vec3 q = vec3(abs(p.x) * uInvHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvHalf);',
    '  float oct = (q.x + q.y + q.z - 1.0) * uMinAxis * 0.57735026;',
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
    '  float t = clamp(q.y * uInvHeight, 0.0, 1.0);',       // 0 у основания, 1 у вершины
    '  float sx = q.x >= 0.0 ? 1.0 : -1.0;',
    '  float sz = q.z >= 0.0 ? 1.0 : -1.0;',
    '  float face = (sx > 0.0 ? 1.0 : 0.0) + (sz > 0.0 ? 2.0 : 0.0);',
    '  float on = face < 0.5 ? uLogoOn.x : (face < 1.5 ? uLogoOn.y : (face < 2.5 ? uLogoOn.z : uLogoOn.w));',
    '  if (on < 0.5) return 0.0;',
    // только грани, повёрнутые к зрителю — иначе логотип читается зеркально «насквозь»
    '  vec3 n = normalize(vec3(sx * uInvHalf, uInvHeight, sz * uInvHalf));',
    '  float facing = -dot(n, uRayDir);',
    '  if (facing <= 0.0) return 0.0;',
    // координата вдоль ребра основания
    '  float denom = max(1e-4, (1.0 - t) * uHalf);',
    '  float s = clamp((sz * q.z) / denom, 0.0, 1.0);',
    '  float edge = uHalf * 1.41421356;',                    // длина ребра основания
    '  float slant = sqrt(uHalf * uHalf * 0.5 + uHeight * uHeight);',
    '  float size = max(1e-4, slant * uLogoScale);',
    // разворот грани наружу: у двух граней из четырёх обход рёбер идёт в обратную сторону
    '  float u = (s - 0.5) * -(sx * sz) * edge * (1.0 - t);', // поперёк грани
    '  float w = (t - uLogoY) * slant;',                     // вдоль грани, от центра лого
    '  vec2 uv = vec2(u / size + 0.5, 0.5 - w / size);',
    '  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;',
    // тайл атласа 2x2 с отступом от швов
    '  vec2 tile = vec2(mod(face, 2.0), floor(face * 0.5));',
    '  vec2 auv = (clamp(uv, 0.002, 0.998) + tile) * 0.5;',
    '  return texture2D(uAtlas, auv).a * smoothstep(0.0, 0.35, facing);',
    '}',
    '#endif',

    'void main(){',
    '  vec2 f = (gl_FragCoord.xy - 0.5 * uRes - uOffset) * uPxScale;',

    '  float z = 5.0;',
    '  float d = 0.0;',
    '  vec3 p;',
    '  vec4 o = vec4(0.0);',
    '  float lacc = 0.0;',
    '  float tm = uTime;',

    '  const int STEPS = 100;',
    '  for (int i = 0; i < STEPS; i++) {',
    '    p = uRot * vec3(f, z);',
    '    vec3 q = p; q.y += uCenterShift;',
    '    float sd = sdPyramid(q);',
    '    d = 0.1 + 0.2 * abs(sd);',
    '    z -= d;',
    '#ifdef HAS_LOGO',
    // лого — не наклейка: копим его отдельным каналом в тонкой плёнке у поверхности грани,
    // чтобы потом подсветить им тот же материал, не сдвигая оттенок
    '    if (abs(sd) < uLogoDepth) {',
    '      float film = 1.0 - abs(sd) / uLogoDepth;',
    '      lacc += logoMask(q) * film * film / d;',
    '    }',
    '#endif',
    '    vec4 band = (sin((p.y + z) * uColorFreq + vec4(uPhase, 3.0) + tm * 0.15) + 1.0);',
    '    o += band / d;',
    '  }',

    '  o = tanh4(o * o * (uGlow * uBloom) / 1e5);',

    '  vec3 col = o.rgb;',
    '  float lf = 1.0 - exp(-lacc * uLogoGlow * 3e-3);',   // 0..1, плотность логотипа
    '  col = col * (1.0 + lf * 1.35) + vec3(lf * 0.10);',  // ярче в том же оттенке + лёгкий подъём
    '  if (uNoise > 0.0) col += (hash(gl_FragCoord.xy + vec2(uTime)) - 0.5) * uNoise;',
    '  col = clamp(col, 0.0, 1.0);',
    '  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = clamp(mix(vec3(L), col, uSat), 0.0, 1.0);',
    '  if (abs(uHue) > 0.0001) col = clamp(hueRot(uHue) * col, 0.0, 1.0);',
    '  col *= uTint;',
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
        // списки: data-logos="a.svg,b.svg", data-phase="1,4.3,2.2"
        var parts = v.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s.length; });
        var nums = parts.every(function (s) { return /^-?[\d.]+$/.test(s); });
        out[key] = nums ? parts.map(parseFloat) : parts;
        continue;
      }
      var n = parseFloat(v);
      out[key] = (!isNaN(n) && isFinite(n) && /^-?[\d.]+$/.test(v.trim())) ? n : v;
    }
    if (typeof out.logos === 'string') out.logos = [out.logos];
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
      throw new Error('Pleprism shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  // Ry(yaw) * Rx(pitch), сразу в column-major для uniformMatrix3fv
  function rotMatrix(out, yaw, pitch) {
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
  function normalizeSvg(url, cb) {
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
  function buildAtlas(urls, tileSize, done) {
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
        console.warn('Pleprism: не загрузился логотип', url);
        if (--left === 0) finish();
      };
      normalizeSvg(url, function (src) { img.src = src; });
    });

    if (left === 0) finish();
  }

  // ------------------------------------------------------------------ класс

  function Prism(container, options) {
    if (!(this instanceof Prism)) return new Prism(container, options);
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.el) throw new Error('Pleprism: контейнер не найден');

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
    this._yaw = 0;
    this._pitch = o.tilt;
    this._targetYaw = 0;
    this._targetPitch = o.tilt;
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

  Prism.prototype._initGL = function () {
    var o = this.o;
    var cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    if (getComputedStyle(this.el).position === 'static') this.el.style.position = 'relative';
    this.el.appendChild(cv);
    this.canvas = cv;

    var gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' })
          || cv.getContext('experimental-webgl', { alpha: true, antialias: false });
    if (!gl) throw new Error('Pleprism: WebGL недоступен');
    this.gl = gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    this._hasLogo = !!(o.logos && o.logos.length);
    var frag = (this._hasLogo ? '#define HAS_LOGO\n' : '') + FRAG;

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Pleprism link: ' + gl.getProgramInfoLog(prog));
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

    if (this._hasLogo) {
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(u.uAtlas, 0);
      gl.uniform4f(u.uLogoOn, 0, 0, 0, 0);
      this.setLogos(o.logos);
    }

    this._pushStatic();
  };

  // Параметры, которые не меняются каждый кадр
  Prism.prototype._pushStatic = function () {
    var gl = this.gl, u = this.u, o = this.o;
    gl.useProgram(this.prog);
    var H = Math.max(0.001, o.height);
    var half = Math.max(0.001, o.baseWidth) * 0.5;

    gl.uniform1f(u.uInvHalf, 1 / half);
    gl.uniform1f(u.uInvHeight, 1 / H);
    gl.uniform1f(u.uMinAxis, Math.min(half, H));
    gl.uniform1f(u.uCenterShift, H * 0.25);
    gl.uniform1f(u.uGlow, Math.max(0, o.glow));
    gl.uniform1f(u.uBloom, Math.max(0, o.bloom));
    gl.uniform1f(u.uSat, o.saturation);
    gl.uniform1f(u.uHue, o.hueShift);
    gl.uniform1f(u.uColorFreq, Math.max(0, o.colorFrequency));
    gl.uniform1f(u.uNoise, Math.max(0, o.noise));
    var t = hexToRgb(o.tint);
    gl.uniform3f(u.uTint, t[0], t[1], t[2]);
    var ph = o.phase || [0, 1, 2];
    gl.uniform3f(u.uPhase, ph[0], ph[1], ph[2]);
    gl.uniform1f(u.uLogoGlow, o.logoGlow);

    if (this._hasLogo) {
      gl.uniform1f(u.uHalf, half);
      gl.uniform1f(u.uHeight, H);
      gl.uniform1f(u.uLogoScale, o.logoScale);
      gl.uniform1f(u.uLogoY, o.logoY);
      gl.uniform1f(u.uLogoDepth, Math.max(0.005, o.logoDepth));
    }
  };

  Prism.prototype.setLogos = function (urls) {
    var self = this;
    if (!this._hasLogo) {
      console.warn('Pleprism: создайте виджет с непустым logos, чтобы включить логотипы');
      return;
    }
    buildAtlas(urls, 512, function (cv, on) {
      var gl = self.gl;
      gl.useProgram(self.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, self.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
        gl.uniform4f(self.u.uLogoOn, on[0], on[1], on[2], on[3]);
      } catch (e) {
        // tainted canvas: картинка с другого домена без CORS
        console.warn('Pleprism: логотипы не загружены (CORS). Используйте data-URI или свой домен.', e);
      }
    });
  };

  Prism.prototype.resize = function () {
    var gl = this.gl, o = this.o;
    var w = Math.max(1, this.el.clientWidth);
    var h = Math.max(1, this.el.clientHeight);
    this._w = this.el.clientWidth;
    this._h = this.el.clientHeight;

    var dpr = Math.min(o.dpr || 2, global.devicePixelRatio || 1);
    // потолок по числу пикселей: шейдер тяжёлый, на retina/4K иначе просядет fps
    var maxPx = o.maxPixels || 2.2e6;
    if (w * h * dpr * dpr > maxPx) dpr = Math.max(0.75, Math.sqrt(maxPx / (w * h)));

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.uOffset, o.offsetX * dpr, o.offsetY * dpr);

    // масштаб считаем от высоты, но на узких экранах — от ширины,
    // иначе на телефоне призма вылезает за края
    var ref = Math.min(this.canvas.height, this.canvas.width / (o.fitWidth || 0.9));
    gl.uniform1f(this.u.uPxScale, 1 / (ref * 0.1 * Math.max(0.001, o.scale)));
  };

  Prism.prototype._bind = function () {
    var self = this, o = this.o;
    this._onResize = function () { self.resize(); };

    if (global.ResizeObserver) {
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(this.el);
    } else {
      global.addEventListener('resize', this._onResize);
    }

    if (o.hover) {
      var host = o.hoverTarget === 'self' ? this.el : global;
      this._onMove = function (e) {
        var pt = e.touches && e.touches[0] ? e.touches[0] : e;
        var r = self.el.getBoundingClientRect();
        var nx = ((pt.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
        var ny = ((pt.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
        var s = o.invert ? -1 : 1;
        self._targetYaw = s * Math.max(-1.6, Math.min(1.6, nx)) * o.hoverStrength;
        self._targetPitch = o.tilt + s * Math.max(-1.6, Math.min(1.6, ny)) * o.hoverStrengthY;
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

  Prism.prototype._frame = function (now) {
    var self = this;
    this._raf = requestAnimationFrame(function (t) { self._frame(t); });

    var gl = this.gl, u = this.u, o = this.o;
    var time = (now - this._t0) * 0.001;

    // страховка на случай, если контейнер сменил размер без ResizeObserver
    // (табы, аккордеоны, ленивые лейауты на чужих сайтах)
    if (this.el.clientWidth !== this._w || this.el.clientHeight !== this._h) this.resize();

    // собственное вращение + инерционный отклик на курсор
    var k = Math.max(0.001, Math.min(1, o.inertia));
    this._yaw += (this._targetYaw - this._yaw) * k;
    this._pitch += (this._targetPitch - this._pitch) * k;

    var yaw = this._yaw + time * o.spin;
    var pitch = this._pitch + Math.sin(time * 0.35) * 0.035;

    gl.useProgram(this.prog);
    var m = rotMatrix(this._rot, yaw, pitch);
    gl.uniformMatrix3fv(u.uRot, false, m);
    // направление марширования в локальных координатах: uRot * (0,0,-1)
    if (this._hasLogo) gl.uniform3f(u.uRayDir, -m[6], -m[7], -m[8]);
    gl.uniform1f(u.uTime, time * o.timeScale);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  Prism.prototype.start = function () {
    if (this._running || document.hidden || !this._visible) return;
    this._running = true;
    var self = this;
    this._t0 = performance.now() - (this._elapsed || 0) * 1000;
    this._raf = requestAnimationFrame(function (t) { self._frame(t); });
  };

  Prism.prototype.stop = function () {
    if (!this._running) return;
    this._running = false;
    this._elapsed = (performance.now() - this._t0) * 0.001;
    cancelAnimationFrame(this._raf);
  };

  /** Обновить любые параметры на лету: prism.set({ hueShift: 2.0 }) */
  Prism.prototype.set = function (patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) this.o[camel(k)] = patch[k];
    this._pushStatic();
    this.resize();
    if (patch.logos) this.setLogos(patch.logos);
    return this;
  };

  Prism.prototype.destroy = function () {
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
      var p = new Prism(el, opts);
      API.instances.push(p);
      return p;
    },
    auto: function (selector) {
      var nodes = document.querySelectorAll(selector || '.pleprism,[data-pleprism]');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].__pleprism) continue;
        try {
          nodes[i].__pleprism = API.create(nodes[i]);
        } catch (e) { console.error(e); }
      }
      return API.instances;
    }
  };

  return API;
})(typeof window !== 'undefined' ? window : this);

export default Pleprism
