/*!
 * GlukeEnergyFill — наполнение логотипа энергией на чистом WebGL, без зависимостей.
 *
 * Автор: Александр Глухов (GLUKE, https://gluke.ru, @Gluke_art).
 * © GLUKE, 2026. Свободное использование и доработка допускаются с сохранением
 * этой шапки и ссылки на gluke.ru; перепродажа движка как самостоятельного
 * продукта или выдача его за чужую разработку — без письменного согласия
 * автора. При сомнениях — gluke_art@mail.ru.
 * Виджет кейса `energy-fill`. Каркас общий с GlukeMetaballs: полноэкранный
 * треугольник, один фрагментный шейдер, create/set/detach/reattach, прозрачный
 * канвас поверх фона темы сайта. Геометрии нет вовсе — вся сцена считается
 * в пикселях.
 *
 * Суть приёма — в том, откуда берётся «фронт» заливки. Наивный вариант меряет
 * расстояние от точки входа по экрану, и тогда дальний угол буквы загорается
 * раньше соседнего: получается круговая шторка, подрезанная маской. Здесь
 * вместо этого считается геодезическое расстояние ВНУТРИ формы: волна обходит
 * перемычки и контрформы так же, как жидкость обходила бы стенки. Карта
 * расстояний печётся один раз при загрузке знака (чамфер-развёртка по маске)
 * и уезжает в текстуру, поэтому в кадре это один сэмпл, а не поиск пути.
 *
 * Что где живёт по разрешению — это главный компромисс движка:
 *   • контур, кромка и плотный ореол берутся из знакового поля (`grid`), и
 *     край режется по нему аналитически, шириной в экранный пиксель. Поэтому
 *     знак острый при любом размере блока. Раньше кромку и ореол давало
 *     низкое поле — и наружу лезли грани его метрики, теми самыми «лучиками»;
 *   • приход волны — из мелкой сетки (`fieldGrid`): он мягкий, и высокое
 *     разрешение там стоило бы сотни миллисекунд на каждый поворот угла;
 *   • мягкое дальнее зарево — из той же мелкой сетки, но размытой, иначе
 *     грани метрики снова читаются гранями.
 * Обе сетки двигает один ползунок `detail`.
 *
 * Знак задаётся ссылкой (`mark`): любой SVG или PNG с альфой, растеризуется
 * в браузере. Печь ничего заранее не нужно — можно подменить файл и получить
 * корректную заливку по новой форме.
 */

const GlukeEnergyFill = (function (global) {
  'use strict'

  var PAD = 0.18 // поля вокруг знака в карте: в них живёт ореол

  var DEFAULTS = {
    /* Служебная подпись: в рендере не участвует и в UI не выводится —
       метка для тех, кто взял код (видна в дефолтах и в профайлере). */
    glukeCredit: 'GLUKE — gluke.ru, @Gluke_art (Александр Глухов)',

    // --- знак ---
    mark: '', // URL знака (SVG или PNG с альфой)
    /* Общий множитель разрешения обеих карт. 1 — знаковое поле 1024²,
       поле прихода 256². Пересчёт разовый, но на 2 он заметен: карты
       перепекаются целиком. */
    detail: 1,
    markSize: 0.82, // высота знака в долях высоты блока
    /* Раскладка кадра для полноэкранной шапки, где слева лежит текст кейса.
       `markShift` уводит знак вправо (доли ширины блока, 0 — по центру),
       `markFit` держит его в отведённой полосе: потолок ширины знака в долях
       ширины блока, 0 — потолка нет. Оба считаются в шейдере от текущего
       соотношения сторон, поэтому переживают ресайз без пересчёта на CPU. */
    markShift: 0,
    markFit: 0,

    // --- поток ---
    entryAngle: 30, // откуда приходит поток, градусы (0 — справа, против часовой)
    beamReach: 1.1, // длина потока в долях размера знака
    beamWidth: 0.05, // толщина у самого знака
    beamNoise: 0.8, // рыскание потока
    beamGlow: 1.6, // яркость потока

    // --- заливка ---
    frontWidth: 0.06, // ширина фронта: меньше — резкая граница, больше — размытая
    frontGlow: 1.4, // яркость самого фронта
    fillNoise: 0.16, // плавная рваность фронта
    noiseScale: 7, // размер клякс шума
    frontFlow: 0.5, // скорость движения шума вдоль фронта
    /* Захват кусками: шум режется на ступени, и форма загорается не сплошным
       фронтом, а отдельными участками — одни убегают вперёд, другие отстают. */
    grain: 0.22, // насколько далеко участки убегают друг от друга
    grainScale: 14, // размер участка
    grainSteps: 7, // на сколько ступеней режется шум: меньше — крупнее куски

    // --- жизнь внутри знака до удара ---
    idle: 0.5, // яркость
    idleSpeed: 0.35, // скорость
    idleTight: 1.5, // сколько волн в форме одновременно
    /* Рисунок: 0 — волны по форме, 1 — редкие импульсы, 2 — разряды-нити.
       Значение непрерывное, промежуточные дают смесь. */
    idleShape: 0,

    // --- материал знака ---
    rim: 0.9, // подсветка кромки
    rimWidth: 0.25, // толщина кромки в долях знакового поля

    // --- свет вокруг ---
    halo: 1, // плотный ореол по контуру
    haloWidth: 0.18, // спад плотного ореола
    soft: 0.7, // мягкое свечение, повторяющее форму
    softWidth: 0.35, // его спад
    bloom: 0.9, // широкое зарево вокруг знака
    bloomWidth: 0.45, // как далеко оно уходит
    shock: 1.6, // импульс, расходящийся кольцом
    shockWidth: 0.22, // толщина кольца
    /* Всполохи: свечение дышит неровно, языками, а не ровным нимбом. */
    burst: 0.8, // глубина всполохов
    burstScale: 3.5, // насколько они мелкие
    burstSpeed: 0.5, // как быстро ходят

    // --- палитра (#FFE417 в HSV) ---
    hue: 0.147,
    saturation: 0.91,
    lightness: 1,
    dormant: 0.3, // яркость исходного, ещё не зажжённого состояния

    // --- тайминг, секунды ---
    charge: 0.7, // подлёт потока
    fillTime: 1, // наполнение
    flash: 0.35, // импульс после насыщения
    hold: 1.4, // пауза перед повтором
    ambient: 1, // амплитуда еле заметного дыхания в финале
    loop: 1, // повторять сцену (в лаборатории — да, в hero — нет)
    freeze: 0, // остановить время и встать на `scrub`
    scrub: 0.55, // положение внутри цикла при freeze

    // --- инфраструктура ---
    ratioCap: 2,
    pixelBudget: 2.2e6,
    pauseOffscreen: true,
    respectReducedMotion: true,
  }

  var VERT
    = 'attribute vec2 aPos;'
      + 'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'

  /* Текстура: R — знаковое расстояние до контура (0.5 ровно на контуре),
     G — приход волны (0 в точке входа, 1 в самой дальней точке формы),
     B — размытое расстояние изнутри, A — размытое расстояние снаружи.
     Один сэмпл на пиксель даёт и силуэт, и заливку, и кромку, и свечение.

     `#extension` обязан стоять до первого не-препроцессорного токена, иначе
     шейдер не компилируется, — поэтому он первой строкой. */
  var FRAG = [
    '#extension GL_OES_standard_derivatives : enable',
    'precision highp float;',

    'uniform vec2  uViewport;',
    'uniform sampler2D uTex;',
    'uniform float uClock;',
    'uniform float uMarkSize;',
    'uniform float uMarkShift;',
    'uniform float uMarkFit;',
    'uniform vec2  uCentre;',
    'uniform float uEdgeSoft;',

    'uniform float uHue;',
    'uniform float uSaturation;',
    'uniform float uLightness;',
    'uniform float uDormant;',

    'uniform float uProgress;',
    'uniform float uFrontWidth;',
    'uniform float uFrontGlow;',
    'uniform float uFillNoise;',
    'uniform float uNoiseScale;',
    'uniform float uFrontFlow;',
    'uniform float uGrain;',
    'uniform float uGrainScale;',
    'uniform float uGrainSteps;',

    'uniform float uIdle;',
    'uniform float uIdleSpeed;',
    'uniform float uIdleTight;',
    'uniform float uIdleShape;',

    'uniform float uRim;',
    'uniform float uRimWidth;',
    'uniform float uHalo;',
    'uniform float uHaloWidth;',
    'uniform float uSoft;',
    'uniform float uSoftWidth;',
    'uniform float uBloom;',
    'uniform float uBloomWidth;',
    'uniform float uShock;',
    'uniform float uShockR;',
    'uniform float uShockWidth;',
    'uniform float uBurst;',
    'uniform float uBurstScale;',
    'uniform float uBurstSpeed;',

    'uniform vec2  uEntry;',
    'uniform vec2  uEntryDir;',
    'uniform float uBeam;',
    'uniform float uBeamHead;',
    'uniform float uBeamReach;',
    'uniform float uBeamWidth;',
    'uniform float uBeamNoise;',
    'uniform float uBeamGlow;',

    'uniform float uFlash;',
    'uniform float uAmbient;',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }',
    'float hash1(float p){ return fract(sin(p * 127.1) * 43758.5453123); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'float fbm(vec2 p){ return vnoise(p) * 0.62 + vnoise(p * 2.13 + 7.1) * 0.38; }',
    // Хребтовый шум: тонкие светлые нити вместо круглых пятен — из него разряды.
    'float ridged(vec2 p){ return 1.0 - abs(fbm(p) * 2.0 - 1.0); }',

    'vec3 hsv2rgb(vec3 c){',
    '  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);',
    '  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);',
    '}',

    'float lum(vec3 c){ return max(max(c.r, c.g), c.b); }',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uViewport;',
    '  float aspect = uViewport.x / uViewport.y;',
    /* Пространство знака: изотропное, квадрат [0,1] по обеим осям. Поток и все
       расстояния считаются в нём, поэтому не зависят от формы блока. */
    '  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) - vec2(uMarkShift * aspect, 0.0);',
    /* Размер задан по высоте блока; потолок `uMarkFit` задан по ширине —
       переводим его в те же единицы (доля ширины × aspect) и берём меньшее.
       Так знак не вылезает из отведённой полосы на широком экране. */
    '  float fit = uMarkFit > 0.0 ? min(uMarkSize, uMarkFit * aspect) : uMarkSize;',
    '  vec2 m = p / max(fit, 0.05) + 0.5;',

    /* За пределами карты сэмпл берёт краевые значения (CLAMP_TO_EDGE): там
       заведомо пусто — знак растеризован с полями. Проверка границ не нужна. */
    '  vec4 s = texture2D(uTex, m);',
    '  float sd = s.r - 0.5;', // >0 внутри знака, <0 снаружи
    '  float arrival = s.g;',
    '  float softIn = s.b;',
    '  float softOut = s.a;',

    /* Силуэт режется по знаковому расстоянию шириной в экранный пиксель:
       край остаётся острым, как у вектора, независимо от размера карты.
       Без расширения derivatives ширину считает CPU и присылает готовой. */
    '#ifdef GL_OES_standard_derivatives',
    '  float aa = max(fwidth(sd), 1e-5);',
    '#else',
    '  float aa = max(uEdgeSoft, 1e-5);',
    '#endif',
    '  float cov = smoothstep(-aa, aa, sd);',

    '  vec3 brand = hsv2rgb(vec3(uHue, uSaturation, uLightness));',
    '  float breathe = 1.0 + uAmbient * 0.07 * sin(uClock * 1.7);',

    '  vec3 rgb = vec3(0.0);',
    '  float alpha = 0.0;',

    /* Тело знака считаем только там, где оно есть: почти весь кадр — фон, а
       внутри живут четыре шума. Без этой отсечки они считались бы везде. */
    '  if (cov > 0.002) {',
    /* Фронт складывается из двух слоёв. Плавный шум даёт рваную границу;
       ступенчатый режет форму на участки, которые загораются каждый в свой
       момент — одни убегают вперёд, другие отстают. Отсюда ощущение, что
       заливка захватывает форму кусками, а не ползёт линией. */
    '    float n = fbm(m * uNoiseScale + vec2(0.0, -uClock * uFrontFlow));',
    '    float cells = fbm(m * uGrainScale + 31.7);',
    '    float steps = max(uGrainSteps, 1.0);',
    '    float patch = floor(cells * steps) / steps;',
    '    float wave = arrival + (n - 0.5) * uFillNoise + (patch - 0.5) * uGrain;',
    '    float w = max(uFrontWidth, 0.004);',
    /* Ход фронта берём с запасом за оба конца. Иначе при progress = 0 порог
       стоит ровно на нуле — там, где волна рождается, — и точка входа тлеет
       ещё до удара, выдавая, куда прилетит поток. */
    '    float span = w + (uFillNoise + uGrain) * 0.5;',
    '    float P = mix(-span, 1.0 + span, uProgress);',
    '    float fill = smoothstep(P + w, P - w, wave);',
    /* Яркая кромка самой волны. Гасим её в начале и в конце: в статике
       светящаяся линия поперёк знака выглядит как дефект. */
    '    float live = smoothstep(0.0, 0.06, uProgress) * (1.0 - smoothstep(0.94, 1.0, uProgress));',
    '    float band = exp(-pow((wave - P) / w, 2.0) * 1.6) * live;',

    '    vec3 dull = vec3(dot(brand, vec3(0.30, 0.59, 0.11))) * uDormant;',
    '    vec3 body = mix(dull, brand * breathe, fill);',
    '    body += brand * band * uFrontGlow;',

    /* До удара по знаку ходит свет — вдоль той же геодезической координаты,
       что и будущая заливка. Знак читается заряженным, а не выключенным, и
       при этом не подсказывает точку входа. Рисунок выбирается ползунком:
       волны, редкие импульсы или разряды-нити; промежуточные значения дают
       смесь, поэтому веса считаются треугольником, а не ступенькой. */
    '    if (uIdle > 0.001) {',
    '      float lane = arrival * uIdleTight - uClock * uIdleSpeed;',
    '      float ph = fract(lane);',
    '      float waves = exp(-pow((ph - 0.5) / 0.17, 2.0));',
    /* Импульс — тот же бег, но коротким всплеском и не в каждом такте:
       номер такта решает хеш, поэтому вспышки идут вразнобой. */
    '      float beat = step(0.55, hash1(floor(lane) * 1.37));',
    '      float pulses = pow(max(0.0, 1.0 - abs(ph - 0.5) * 5.0), 4.0) * beat;',
    /* Разряд — хребтовый шум, вытянутый вдоль формы и мерцающий тактами. */
    '      float fil = ridged(vec2(arrival * 9.0, 0.0) + m * uNoiseScale * 1.4 + vec2(0.0, -uClock * uIdleSpeed * 2.2));',
    '      float bolts = pow(clamp(fil, 0.0, 1.0), 7.0) * (0.35 + 0.65 * beat);',
    '      float w0 = max(0.0, 1.0 - abs(uIdleShape));',
    '      float w1 = max(0.0, 1.0 - abs(uIdleShape - 1.0));',
    '      float w2 = max(0.0, 1.0 - abs(uIdleShape - 2.0));',
    '      float pattern = (waves * w0 + pulses * w1 + bolts * w2) / max(w0 + w1 + w2, 0.001);',
    '      float grainy = fbm(m * uNoiseScale * 1.7 + vec2(uClock * 0.25, uClock * 0.18));',
    '      body += brand * pattern * (0.35 + 0.65 * grainy) * uIdle * (1.0 - fill);',
    '    }',

    /* Кромка — из знакового поля, а не из мелкой сетки: она идёт ровно по
       контуру и не повторяет грани его метрики. */
    '    float edge = 1.0 - smoothstep(0.0, max(uRimWidth, 0.01), sd);',
    '    body += brand * edge * uRim * (0.15 + 0.85 * fill);',
    '    body += brand * uFlash * 0.9;',

    '    rgb += body * cov;',
    '    alpha += cov;',
    '  }',

    /* Свет вокруг знака — четыре слоя, каждый со своим источником точности.
       Плотный ореол берётся из знакового поля (высокое разрешение, ровно по
       контуру), мягкий — из размытой карты (повторяет форму, но без граней),
       зарево и ударное кольцо считаются от центра и полем не ограничены,
       поэтому уходят далеко за края карты.
       Всё это модулируется всполохами: свечение дышит языками, а не ровным
       нимбом — ровный нимб и читается как «нарисованный». */
    '  float outD = max(-sd, 0.0);',
    '  float halo = exp(-outD / max(uHaloWidth, 0.002));',
    '  float soft = exp(-softOut / max(uSoftWidth, 0.01));',
    '  float r = length(m - uCentre);',
    '  float bloom = exp(-r / max(uBloomWidth, 0.01));',
    '  float ring = exp(-pow((r - uShockR) / max(uShockWidth, 0.01), 2.0)) * uShock;',
    '  vec2 dir = (m - uCentre) / max(r, 1e-4);',
    '  float burst = 1.0 + uBurst * (fbm(dir * uBurstScale * 2.0 + vec2(r * uBurstScale, uClock * uBurstSpeed)) - 0.5) * 2.0;',
    '  float glowAmt = (halo * uHalo + soft * uSoft + bloom * uBloom) * (0.12 + 0.88 * uProgress);',
    '  vec3 glow = brand * (glowAmt * max(burst, 0.0) + ring) * (1.0 + uFlash * 2.5) * (1.0 - cov);',
    '  rgb += glow;',
    '  alpha += lum(glow);',

    /* Поток: клин вдоль направления входа, сужающийся к знаку. Голова идёт
       от `uBeamReach` к нулю, хвост тянется за ней. */
    '  if (uBeam > 0.001) {',
    '    vec2 q = m - uEntry;',
    '    float along = dot(q, -uEntryDir);',
    '    float across = q.x * (-uEntryDir.y) + q.y * uEntryDir.x;',
    '    float reach = max(uBeamReach, 0.05);',
    '    float seg = smoothstep(uBeamHead - 0.02, uBeamHead + 0.06, along) * smoothstep(reach, reach * 0.55, along);',
    '    float bw = max(uBeamWidth, 0.002) * (0.3 + 0.7 * clamp(along / reach, 0.0, 1.0));',
    '    float wob = (fbm(vec2(along * 9.0, uClock * 2.0)) - 0.5) * uBeamNoise * 0.09;',
    '    float prof = exp(-pow((across + wob) / bw, 2.0) * 1.7);',
    '    vec3 beamCol = brand * prof * seg * uBeamGlow * uBeam * (1.0 - cov);',
    '    rgb += beamCol;',
    '    alpha += lum(beamCol);',
    '  }',

    '  gl_FragColor = vec4(rgb, clamp(alpha, 0.0, 1.0));',
    '}',
  ].join('\n')

  function camel(name) {
    return name.replace(/-([a-z])/g, function (_, c) {
      return c.toUpperCase()
    })
  }

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v)
  }

  function smooth01(v) {
    var t = clamp01(v)
    return t * t * (3 - 2 * t)
  }

  function createShader(gl, type, source) {
    var sh = gl.createShader(type)
    gl.shaderSource(sh, source)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('GlukeEnergyFill: ' + gl.getShaderInfoLog(sh))
    }
    return sh
  }

  /* SVG без width/height растеризуется браузером в 150×150 — по такой маске
     ни край, ни поля не собрать. Достаём размер из viewBox и просим нужный.
     Тот же приём, что в GlukePyramid. */
  function sizeSvg(url, cb) {
    if (!/\.svg(\?|#|$)/i.test(url)) return cb(url)
    fetch(url).then(function (r) {
      return r.ok ? r.text() : Promise.reject(new Error('http'))
    }).then(function (txt) {
      var m = txt.match(/viewBox\s*=\s*"([^"]+)"/i)
      if (!m) return cb(url)
      var vb = m[1].trim().split(/[\s,]+/).map(parseFloat)
      var w = vb[2], h = vb[3]
      if (!w || !h) return cb(url)
      var k = 2048 / Math.max(w, h)
      var out = txt
        .replace(/\swidth\s*=\s*"[^"]*"/i, '')
        .replace(/\sheight\s*=\s*"[^"]*"/i, '')
        .replace(/<svg/i, '<svg width="' + Math.round(w * k) + '" height="' + Math.round(h * k) + '"')
      cb('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out))
    }).catch(function () {
      cb(url)
    })
  }

  /* Альфа знака, вписанного в квадрат `size` с полями. Поля обязательны:
     в них живёт ореол, и по ним же считается расстояние снаружи. Ряды
     переворачиваются сразу — ось Y текстуры смотрит вверх, как gl_FragCoord,
     иначе знак встаёт вверх ногами. */
  function rasterize(img, size, padFrac) {
    var cv = document.createElement('canvas')
    cv.width = cv.height = size
    var ctx = cv.getContext('2d')
    var box = size * (1 - padFrac * 2)
    var iw = img.naturalWidth || img.width
    var ih = img.naturalHeight || img.height
    var k = Math.min(box / iw, box / ih)
    ctx.drawImage(img, (size - iw * k) / 2, (size - ih * k) / 2, iw * k, ih * k)
    var src = ctx.getImageData(0, 0, size, size).data
    var out = new Float32Array(size * size)
    for (var y = 0; y < size; y++) {
      var from = (size - 1 - y) * size
      var to = y * size
      for (var x = 0; x < size; x++) out[to + x] = src[(from + x) * 4 + 3] / 255
    }
    return out
  }

  /* Развёртка расстояний по сетке. Без `allow` это обычное преобразование
     расстояния — прямой и обратный проход дают ответ сразу. С `allow`
     расстояние геодезическое: волна идёт только по разрешённым клеткам и
     обходит препятствия, поэтому проходов нужно больше, и цикл выходит сам,
     как только карта перестала меняться.

     Веса не 1 и √2, а оптимальная пара 3×3: у наивной ошибка до 4%, и она
     не случайная — накапливается по восьми направлениям, отчего круг
     превращается в восьмиугольник, а свечение вокруг знака расходится
     гранями. С этой парой ошибка около 2% и граней не видно. */
  function chamfer(size, seed, allow) {
    var n = size * size
    var INF = 1e9
    var d = new Float32Array(n)
    for (var i = 0; i < n; i++) d[i] = seed[i] ? 0 : INF
    var A = 0.9619, B = 1.3604
    var passes = allow ? 48 : 1
    for (var pass = 0; pass < passes; pass++) {
      var moved = 0
      var x, y
      for (y = 0; y < size; y++) {
        for (x = 0; x < size; x++) {
          var i1 = y * size + x
          if (allow && !allow[i1]) continue
          var v = d[i1]
          if (x > 0) v = Math.min(v, d[i1 - 1] + A)
          if (y > 0) {
            v = Math.min(v, d[i1 - size] + A)
            if (x > 0) v = Math.min(v, d[i1 - size - 1] + B)
            if (x < size - 1) v = Math.min(v, d[i1 - size + 1] + B)
          }
          if (v < d[i1]) {
            d[i1] = v
            moved++
          }
        }
      }
      for (y = size - 1; y >= 0; y--) {
        for (x = size - 1; x >= 0; x--) {
          var i2 = y * size + x
          if (allow && !allow[i2]) continue
          var u = d[i2]
          if (x < size - 1) u = Math.min(u, d[i2 + 1] + A)
          if (y < size - 1) {
            u = Math.min(u, d[i2 + size] + A)
            if (x < size - 1) u = Math.min(u, d[i2 + size + 1] + B)
            if (x > 0) u = Math.min(u, d[i2 + size - 1] + B)
          }
          if (u < d[i2]) {
            d[i2] = u
            moved++
          }
        }
      }
      if (!moved) break
    }
    return d
  }

  /* Разделимое размытие «коробкой» по бегущей сумме: цена не зависит от
     радиуса. Нужно мягкому свечению — оно единственное берётся с мелкой
     сетки, и без размытия её грани читаются на кадре. */
  function blurField(field, size, radius) {
    if (radius < 1) return field
    var tmp = new Float32Array(size * size)
    var out = new Float32Array(size * size)
    var span = radius * 2 + 1
    var x, y, i, sum
    for (y = 0; y < size; y++) {
      var row = y * size
      sum = field[row] * (radius + 1)
      for (i = 1; i <= radius; i++) sum += field[row + Math.min(size - 1, i)]
      for (x = 0; x < size; x++) {
        tmp[row + x] = sum / span
        sum += field[row + Math.min(size - 1, x + radius + 1)] - field[row + Math.max(0, x - radius)]
      }
    }
    for (x = 0; x < size; x++) {
      sum = tmp[x] * (radius + 1)
      for (i = 1; i <= radius; i++) sum += tmp[Math.min(size - 1, i) * size + x]
      for (y = 0; y < size; y++) {
        out[y * size + x] = sum / span
        sum += tmp[Math.min(size - 1, y + radius + 1) * size + x] - tmp[Math.max(0, y - radius) * size + x]
      }
    }
    return out
  }

  /* Билинейный сэмпл поля: поля считаются на мелкой сетке, а укладываются в
     текстуру знакового расстояния — она крупнее ради точного контура. */
  function sampleField(field, size, u, v) {
    var fx = Math.min(size - 1.001, Math.max(0, u * (size - 1)))
    var fy = Math.min(size - 1.001, Math.max(0, v * (size - 1)))
    var x0 = fx | 0, y0 = fy | 0
    var tx = fx - x0, ty = fy - y0
    var a = field[y0 * size + x0], b = field[y0 * size + x0 + 1]
    var c = field[(y0 + 1) * size + x0], e = field[(y0 + 1) * size + x0 + 1]
    return (a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty
  }

  function Widget(el, opts) {
    this.el = typeof el === 'string' ? document.querySelector(el) : el
    if (!this.el) throw new Error('GlukeEnergyFill: контейнер не найден')
    this.o = {}
    for (var k in DEFAULTS) this.o[k] = DEFAULTS[k]
    if (opts) for (var p in opts) this.o[camel(p)] = opts[p]

    if (getComputedStyle(this.el).position === 'static') this.el.style.position = 'relative'

    var canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    this.el.appendChild(canvas)
    this.canvas = canvas

    var gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
    if (!gl) {
      this.el.removeChild(canvas)
      throw new Error('GlukeEnergyFill: WebGL недоступен')
    }
    this.gl = gl
    /* Расширение нужно запросить до компиляции: без него `fwidth` в шейдере
       не работает и край режется по ширине, посчитанной на CPU. */
    this._derivatives = !!gl.getExtension('OES_standard_derivatives')

    this.prog = gl.createProgram()
    gl.bindAttribLocation(this.prog, 0, 'aPos')
    gl.attachShader(this.prog, createShader(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(this.prog, createShader(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(this.prog)
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw new Error('GlukeEnergyFill: ' + gl.getProgramInfoLog(this.prog))
    }

    var buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    var u = (this.u = {})
    var names = [
      'uViewport', 'uTex', 'uClock', 'uMarkSize', 'uMarkShift', 'uMarkFit', 'uCentre', 'uEdgeSoft',
      'uHue', 'uSaturation', 'uLightness', 'uDormant',
      'uProgress', 'uFrontWidth', 'uFrontGlow', 'uFillNoise', 'uNoiseScale', 'uFrontFlow',
      'uGrain', 'uGrainScale', 'uGrainSteps',
      'uIdle', 'uIdleSpeed', 'uIdleTight', 'uIdleShape',
      'uRim', 'uRimWidth', 'uHalo', 'uHaloWidth', 'uSoft', 'uSoftWidth',
      'uBloom', 'uBloomWidth', 'uShock', 'uShockR', 'uShockWidth',
      'uBurst', 'uBurstScale', 'uBurstSpeed',
      'uEntry', 'uEntryDir', 'uBeam', 'uBeamHead', 'uBeamReach', 'uBeamWidth', 'uBeamNoise', 'uBeamGlow',
      'uFlash', 'uAmbient',
    ]
    for (var i = 0; i < names.length; i++) u[names[i]] = gl.getUniformLocation(this.prog, names[i])

    /* До загрузки знака текстура пустая и «далёкая»: случайный кадр не мигнёт
       залитым пятном (R = 0 — снаружи контура, G = 1 — волна не дошла). */
    this.tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 255, 0, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this._ready = false
    this._dirty = 0 // 0 — ничего, 1 — перепечь поля, 2 — перепечь всё
    this._img = null
    this._sd = null
    this._mask = null
    this._centre = [0.5, 0.5]
    this._entry = [0.5, 0.5]
    this._dir = [1, 0]
    this._visible = true
    this._running = false
    this._elapsed = 0
    this._w = 0
    this._h = 0
    this._applyDetail()

    this._still = !!this.o.respectReducedMotion
      && typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches

    this.resize()
    this._pushStatic()
    this._bind()
    if (this.o.mark) this.setMark(this.o.mark)
    this.start()
  }

  /* Один ползунок двигает обе сетки. Знаковое поле округляем до кратного 64,
     поле прихода — до 16: так соседние значения ползунка реально отличаются,
     а не пересчитывают одно и то же. */
  Widget.prototype._applyDetail = function () {
    var d = Math.max(0.5, Math.min(2, this.o.detail || 1))
    this._grid = Math.max(256, Math.min(2048, Math.round(1024 * d / 64) * 64))
    this._fieldGrid = Math.max(96, Math.min(512, Math.round(256 * d / 16) * 16))
    /* Диапазон знакового поля: ±5% стороны карты. Уже — точнее у контура, но
       кромке не хватает запаса; шире — грубее квантование края. */
    this._sdScale = this._grid * 0.05
  }

  /** Загрузить знак: любой SVG или PNG с альфой. */
  Widget.prototype.setMark = function (url) {
    var self = this
    this.o.mark = url
    var token = (this._markToken = (this._markToken || 0) + 1)
    var img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = function () {
      /* Пока грузился один знак, могли переключить на другой — старый ответ
         молча выбрасываем, иначе он перезапишет новый. */
      if (token !== self._markToken) return
      self._img = img
      self._bake()
      self._ready = true
    }
    img.onerror = function () {
      console.warn('GlukeEnergyFill: не загрузился знак', url)
    }
    sizeSvg(url, function (src) {
      img.src = src
    })
    return this
  }

  /* Полная перепечь: знаковое поле, маска и поля прихода. Зовётся при смене
     знака и при смене разрешения. */
  Widget.prototype._bake = function () {
    if (!this._img) return
    this._buildEdge(rasterize(this._img, this._grid, PAD))
    var fg = this._fieldGrid
    var soft = rasterize(this._img, fg, PAD)
    var mask = new Uint8Array(fg * fg)
    for (var i = 0; i < mask.length; i++) mask[i] = soft[i] > 0.5 ? 1 : 0
    this._mask = mask
    this._buildFields()
  }

  /* Знаковое расстояние до контура на крупной сетке. Считается один раз на
     знак: от угла входа оно не зависит. У краевых пикселей значение берётся
     из сглаженной альфы — тогда контур садится точно между пикселями, а не
     округляется до целого, и не появляется лесенка. */
  Widget.prototype._buildEdge = function (cov) {
    var g = this._grid
    var n = g * g
    var mask = new Uint8Array(n)
    var inv = new Uint8Array(n)
    for (var i = 0; i < n; i++) {
      var on = cov[i] > 0.5 ? 1 : 0
      mask[i] = on
      inv[i] = on ? 0 : 1
    }
    var inside = chamfer(g, inv, null)
    var outside = chamfer(g, mask, null)
    var scale = this._sdScale
    var sd = new Float32Array(n)
    for (i = 0; i < n; i++) {
      var a = cov[i]
      if (a > 0.02 && a < 0.98) sd[i] = (a - 0.5) / scale
      else sd[i] = (mask[i] ? inside[i] - 0.5 : -(outside[i] - 0.5)) / scale
    }
    this._sd = sd
  }

  /* Пересчёт карт под текущий угол входа и заливка их в текстуру. Зовётся при
     перепечи и при смене `entryAngle` — не чаще одного раза за кадр, поэтому
     таскать ползунок угла не больно. */
  Widget.prototype._buildFields = function () {
    var fg = this._fieldGrid
    var mask = this._mask
    if (!mask || !this._sd) return
    var n = fg * fg
    var i, x, y

    var inv = new Uint8Array(n)
    for (i = 0; i < n; i++) inv[i] = mask[i] ? 0 : 1

    /* Мягкое свечение и внутренний подсвет — с размытых карт: без размытия
       на кадре читаются грани метрики. Радиус берём от размера сетки, чтобы
       картинка не менялась при смене разрешения. */
    var blur = Math.max(1, Math.round(fg * 0.02))
    var softOut = blurField(chamfer(fg, mask, null), fg, blur)
    var softIn = blurField(chamfer(fg, inv, null), fg, blur)

    /* Центр тяжести знака — от него считаются зарево и ударное кольцо: они
       не ограничены картой и уходят далеко за её края. */
    var sx = 0, sy = 0, cnt = 0
    for (y = 0; y < fg; y++) {
      for (x = 0; x < fg; x++) {
        if (!mask[y * fg + x]) continue
        sx += x
        sy += y
        cnt++
      }
    }
    if (cnt) this._centre = [sx / cnt / (fg - 1), sy / cnt / (fg - 1)]

    /* Точка входа — самый «верхний по потоку» пиксель знака: тот, который
       поток встретит первым. Ищем крайний в направлении, обратном полёту. */
    var rad = this.o.entryAngle * Math.PI / 180
    var dx = Math.cos(rad), dy = Math.sin(rad)
    var best = -1e9, bx = 0, by = 0
    for (y = 0; y < fg; y++) {
      for (x = 0; x < fg; x++) {
        if (!mask[y * fg + x]) continue
        var proj = -(x * dx + y * dy)
        if (proj > best) {
          best = proj
          bx = x
          by = y
        }
      }
    }
    this._entry = [bx / (fg - 1), by / (fg - 1)]
    this._dir = [dx, dy]

    /* Сеем не пиксель, а пятно: с одной клетки волна расходится ровным
       кругом и первые кадры читаются как точка, а не как удар потока. */
    var seed = new Uint8Array(n)
    var r = Math.max(2, Math.round(fg * 0.025))
    var r2 = r * r
    for (y = Math.max(0, by - r); y < Math.min(fg, by + r + 1); y++) {
      for (x = Math.max(0, bx - r); x < Math.min(fg, bx + r + 1); x++) {
        var j = y * fg + x
        if (mask[j] && (x - bx) * (x - bx) + (y - by) * (y - by) <= r2) seed[j] = 1
      }
    }
    var arrival = chamfer(fg, seed, mask)

    /* Нормировка по самой дальней достижимой точке. Островки, до которых
       волна не дошла (знак из нескольких частей), заливаются последними, а не
       остаются серыми навсегда. */
    var maxArr = 0
    for (i = 0; i < n; i++) {
      if (mask[i] && arrival[i] < 1e8 && arrival[i] > maxArr) maxArr = arrival[i]
    }
    if (maxArr <= 0) maxArr = 1
    for (i = 0; i < n; i++) if (arrival[i] > 1e8) arrival[i] = maxArr

    var softScale = fg * 0.22

    var g = this._grid
    var px = new Uint8Array(g * g * 4)
    for (y = 0; y < g; y++) {
      var v = y / (g - 1)
      for (x = 0; x < g; x++) {
        var uu = x / (g - 1)
        var o4 = (y * g + x) * 4
        px[o4] = Math.round(clamp01(this._sd[y * g + x] * 0.5 + 0.5) * 255)
        px[o4 + 1] = Math.round(clamp01(sampleField(arrival, fg, uu, v) / maxArr) * 255)
        px[o4 + 2] = Math.round(clamp01(sampleField(softIn, fg, uu, v) / softScale) * 255)
        px[o4 + 3] = Math.round(clamp01(sampleField(softOut, fg, uu, v) / softScale) * 255)
      }
    }

    var gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, g, g, 0, gl.RGBA, gl.UNSIGNED_BYTE, px)
    this._dirty = 0
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
    this._w = el.clientWidth
    this._h = el.clientHeight
    /* Запасная ширина сглаживания края, если нет derivatives: один экранный
       пиксель, переведённый в единицы знакового расстояния. */
    var fit = this.o.markFit > 0
      ? Math.min(this.o.markSize, this.o.markFit * (bw / bh))
      : this.o.markSize
    this._edgeSoft = (this._grid / this._sdScale) / Math.max(1, fit * bh)
  }

  // Юниформы, которые не меняются кадр в кадр.
  Widget.prototype._pushStatic = function () {
    var gl = this.gl, u = this.u, o = this.o
    gl.useProgram(this.prog)
    gl.uniform1i(u.uTex, 0)
    gl.uniform1f(u.uMarkSize, o.markSize)
    gl.uniform1f(u.uMarkShift, o.markShift)
    gl.uniform1f(u.uMarkFit, o.markFit)
    gl.uniform1f(u.uEdgeSoft, this._edgeSoft || 0.01)
    gl.uniform1f(u.uHue, o.hue)
    gl.uniform1f(u.uSaturation, o.saturation)
    gl.uniform1f(u.uLightness, o.lightness)
    gl.uniform1f(u.uDormant, o.dormant)
    gl.uniform1f(u.uFrontWidth, o.frontWidth)
    gl.uniform1f(u.uFrontGlow, o.frontGlow)
    gl.uniform1f(u.uFillNoise, o.fillNoise)
    gl.uniform1f(u.uNoiseScale, o.noiseScale)
    gl.uniform1f(u.uFrontFlow, o.frontFlow)
    gl.uniform1f(u.uGrain, o.grain)
    gl.uniform1f(u.uGrainScale, o.grainScale)
    gl.uniform1f(u.uGrainSteps, o.grainSteps)
    gl.uniform1f(u.uIdleSpeed, o.idleSpeed)
    gl.uniform1f(u.uIdleTight, o.idleTight)
    gl.uniform1f(u.uIdleShape, o.idleShape)
    gl.uniform1f(u.uRim, o.rim)
    /* Кромка задаётся в долях знакового поля: ползунок 0..1 — это 0..100%
       его диапазона, то есть до 5% стороны карты. */
    gl.uniform1f(u.uRimWidth, o.rimWidth)
    gl.uniform1f(u.uHalo, o.halo)
    gl.uniform1f(u.uHaloWidth, o.haloWidth)
    gl.uniform1f(u.uSoft, o.soft)
    gl.uniform1f(u.uSoftWidth, o.softWidth)
    gl.uniform1f(u.uBloom, o.bloom)
    gl.uniform1f(u.uBloomWidth, o.bloomWidth)
    gl.uniform1f(u.uShockWidth, o.shockWidth)
    gl.uniform1f(u.uBurst, o.burst)
    gl.uniform1f(u.uBurstScale, o.burstScale)
    gl.uniform1f(u.uBurstSpeed, o.burstSpeed)
    gl.uniform1f(u.uBeamReach, o.beamReach)
    gl.uniform1f(u.uBeamWidth, o.beamWidth)
    gl.uniform1f(u.uBeamNoise, o.beamNoise)
    gl.uniform1f(u.uBeamGlow, o.beamGlow)
    gl.uniform1f(u.uAmbient, o.ambient)
  }

  /* Раскладка сцены по времени. Возвращает то, что меняется кадр в кадр:
     положение головы потока, его яркость, прогресс заливки, импульс,
     ударное кольцо и жизнь внутри знака до удара. */
  Widget.prototype._phase = function (t) {
    var o = this.o
    var charge = Math.max(0.05, o.charge)
    var fillT = Math.max(0.05, o.fillTime)
    var flashT = Math.max(0, o.flash)
    var cycle = charge + fillT + flashT + Math.max(0, o.hold)

    var time
    if (this._still) time = cycle // «уменьшить движение»: сразу финал
    else if (o.freeze) time = clamp01(o.scrub) * cycle
    else if (o.loop) time = t % cycle
    else time = Math.min(t, cycle)

    var beam, head
    if (time <= charge) {
      /* Разгон, а не равномерный полёт: поток входит в знак резко — этого
         просит сценарий, и на глаз разница огромная. */
      var k = time / charge
      head = o.beamReach * (1 - k * k)
      beam = Math.min(1, time / (charge * 0.3))
    }
    else {
      head = 0
      beam = Math.exp(-(time - charge) * 5.5)
    }

    var p = clamp01((time - charge) / fillT)
    var progress = p * p * (3 - 2 * p)

    /* Хождения света живут до удара и гаснут, когда пошла настоящая заливка. */
    var idle = o.idle * (1 - smooth01((time - charge) / (fillT * 0.35)))

    var flash = 0
    var shock = 0
    var shockR = 0
    if (flashT > 0) {
      var since = time - charge - fillT
      if (since >= 0) {
        flash = Math.exp(-since / (flashT * 0.28))
        /* Кольцо уходит наружу и продолжает расходиться после того, как сама
           вспышка погасла: импульс должен читаться «в стороны», а не пятном
           на месте знака. */
        var kk = since / flashT
        shockR = 0.12 + 1.7 * kk
        shock = o.shock * Math.exp(-kk * 1.8)
      }
    }

    return { beam: beam, head: head, progress: progress, idle: idle, flash: flash, shock: shock, shockR: shockR }
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
        self._setVisible(!!(entries[0] && entries[0].isIntersecting))
      })
      this._io.observe(this.el)
    }

    this._onVis = function () {
      self._setVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', this._onVis)
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

    if (this._dirty === 2) this._bake()
    else if (this._dirty === 1) this._buildFields()

    var gl = this.gl, u = this.u
    var time = (now - this._t0) * 0.001

    if (this.el.clientWidth !== this._w || this.el.clientHeight !== this._h) {
      this.resize()
      this._pushStatic()
    }

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!this._ready) return

    var s = this._phase(time)

    gl.useProgram(this.prog)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.uniform2f(u.uViewport, this.canvas.width, this.canvas.height)
    gl.uniform1f(u.uClock, time)
    gl.uniform2f(u.uCentre, this._centre[0], this._centre[1])
    gl.uniform2f(u.uEntry, this._entry[0], this._entry[1])
    gl.uniform2f(u.uEntryDir, this._dir[0], this._dir[1])
    gl.uniform1f(u.uBeam, s.beam)
    gl.uniform1f(u.uBeamHead, s.head)
    gl.uniform1f(u.uProgress, s.progress)
    gl.uniform1f(u.uIdle, s.idle)
    gl.uniform1f(u.uFlash, s.flash)
    gl.uniform1f(u.uShock, s.shock)
    gl.uniform1f(u.uShockR, s.shockR)

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

  /** Проиграть сцену заново с нуля. */
  Widget.prototype.replay = function () {
    this._elapsed = 0
    this._t0 = performance.now()
    return this
  }

  /** Обновить параметры на лету: energy.set({ entryAngle: -40, detail: 1.5 }) */
  Widget.prototype.set = function (patch) {
    var angle = this.o.entryAngle
    var mark = this.o.mark
    var detail = this.o.detail
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) this.o[camel(k)] = patch[k]
    }
    if (this.o.mark !== mark) {
      this.setMark(this.o.mark)
    }
    else if (this.o.detail !== detail) {
      this._applyDetail()
      this.resize()
      /* Перепечь тяжелее пересчёта полей, поэтому обе откладываются до
         ближайшего кадра: ползунок сыплет событиями чаще, чем идёт отрисовка. */
      this._dirty = 2
    }
    else if (this.o.entryAngle !== angle) {
      this._dirty = Math.max(this._dirty, 1)
    }
    if (typeof patch.markSize === 'number' || typeof patch.markFit === 'number') this.resize()
    this._pushStatic()
    return this
  }

  Widget.prototype._unbind = function () {
    if (this._ro) this._ro.disconnect()
    else if (this._onResize) global.removeEventListener('resize', this._onResize)
    if (this._io) this._io.disconnect()
    document.removeEventListener('visibilitychange', this._onVis)
    this._ro = null
    this._io = null
    this._onResize = null
  }

  Widget.prototype.detach = function () {
    this.stop()
    this._unbind()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    return this
  }

  Widget.prototype.reattach = function (el) {
    var node = typeof el === 'string' ? document.querySelector(el) : el
    if (!node) throw new Error('GlukeEnergyFill: контейнер не найден')
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
    this._unbind()
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

export default GlukeEnergyFill
