/*!
 * GlukeParticles — модель, пересобранная в облако точек по её поверхности.
 * Виджет кейса `particles`. Единственный из наших виджетов, которому нужен
 * движок: точки раскидывает `MeshSurfaceSampler` из three.js (examples/jsm),
 * он же честно распределяет их по площади граней.
 *
 * Автор: Александр Глухов (GLUKE, https://gluke.ru, @Gluke_art).
 * © GLUKE, 2026. Свободное использование и доработка допускаются с сохранением
 * этой шапки и ссылки на gluke.ru; перепродажа движка как самостоятельного
 * продукта или выдача его за чужую разработку — без письменного согласия
 * автора. При сомнениях — gluke_art@mail.ru.
 *
 * Каркас тот же, что у пирамиды, звёздного поля и лавы: create/set/detach/
 * reattach/destroy, прозрачный канвас без собственной подложки, потолки dpr
 * и площади буфера, пауза вне экрана, уважение «уменьшить движение».
 *
 * Модель разбита на независимые детали (у пневмодвигателя их 58 в сцене при
 * 29 уникальных мешах), поэтому бюджет точек делится между ними по площади:
 * иначе мелкий болт получил бы столько же точек, сколько корпус. Сам сэмплер
 * кешируется по геометрии — инстансам одного меша своя таблица не нужна.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  NormalBlending,
  Matrix4,
  PerspectiveCamera,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { attachRunSources, createRunGate } from './widgetRunGate'

const DEFAULTS = {
  /** Путь к .glb. Модель обязательна: без неё виджету нечего сэмплировать. */
  model: '',

  // --- облако ---
  points: 30000, // число точек
  pointSize: 1.6, // размер точки в пикселях (до dpr)
  spread: 0, // разброс точек по нормали, в долях размера модели

  // --- цвет ---
  additive: true, // аддитивное свечение; на светлой теме выключаем
  hueShift: 0, // сдвиг оттенка всей палитры, 0..1 — полный оборот круга
  color: '#c084fc', // основной тон
  accent: '#38bdf8', // подмешивается по высоте
  brightness: 1, // общая яркость
  pointOpacity: 1, // непрозрачность точек: позволяет набрать их много, не забив экран

  // --- проявление ---
  revealSpeed: 0.06, // доля облака в секунду; 0 — точки не появляются совсем
  loop: true, // прорисовав, начать заново — иначе пришедший позже увидит статику

  // --- линии по поверхности ---
  paths: 3, // сколько линий ползёт по модели
  pathStep: 0.14, // максимальный шаг линии, в долях радиуса модели
  pathSpeed: 12, // сегментов в секунду (не за кадр: иначе минимум был 60/с)
  lineFade: 0.35, // какая доля видимой линии угасает к хвосту
  lineTail: 0, // сколько точек линия держит за собой; 0 — не стирать, пока линия не вырастет до предела (3000)
  lineHueSpread: 0.12, // разлёт оттенков между линиями по цветовому кругу
  lineShimmer: 0.08, // перелив цвета вдоль самой линии, доля цветового круга
  lineDisplace: 0.05, // насколько линия отрывается от поверхности, доля радиуса
  lineOpacity: 0.15, // непрозрачность линий; на светлой теме её убавляет тема

  // --- жизнь точек ---
  pointJitter: 0, // дрожание точки на месте, доля радиуса модели
  jitterSpeed: 1, // частота дрожания, примерно колебаний в секунду
  pointTravel: 0, // секунд на перелёт обновлённой точки; 0 — гаснет и вспыхивает на новом месте
  pointHop: 2, // дальность перелёта, доля радиуса; 2 — куда угодно, через всё тело
  twinkle: 0, // мерцание: 0 — ровный свет, 1 — точки заметно вспыхивают
  twinkleSpeed: 1, // частота мерцания, примерно вспышек в секунду

  // --- курсор ---
  cursorPush: 0, // сдвиг точек от курсора, доля радиуса; минус — притяжение
  cursorReach: 0.2, // радиус действия курсора, доля высоты канваса

  // --- волна от нажатия ---
  waveStrength: 0, // сила волны; 0 — нажатие ничего не запускает
  waveSpeed: 1.2, // скорость фронта, радиусов модели в секунду
  waveWidth: 0.12, // толщина фронта, доля радиуса

  // --- движение ---
  /* Стартовый поворот модели: прямо на зрителя модель неинформативна
     (особенно олень в профиль), поэтому показываем её в три четверти.
     Угол в радианах — 0.6 это примерно 34 градуса. */
  yaw: 0.6,
  spin: 0.15, // собственное вращение, радиан в секунду
  modelScale: 1, // масштаб модели в кадре; 1 — вписана целиком, больше — крупнее, с обрезкой
  tilt: 0.12, // наклон камеры к модели, радианы

  // --- вращение мышью ---
  drag: true, // вращение перетаскиванием, как у 3D-вьюверов сайта
  dragSensitivity: 0.01, // радиан на пиксель
  tiltLimit: 15, // предел наклона перетаскиванием, градусы

  // --- бюджет ---
  ratioCap: 2,
  pixelBudget: 2.2e6,
  pauseOffscreen: true,
  respectReducedMotion: true,
}

/* Волна от нажатия — общая для точек и линий. До WAVES волн живут разом:
   xyz — точка удара в координатах облака, w — время старта. Фронт идёт
   сферой от точки удара и гаснет, пока проходит модель насквозь. */
const WAVES = 4
/* Не чаще одной волны за столько секунд: частые щелчки в одну точку
   сливались в пересвеченное пятно, в котором фронта не видно. */
const WAVE_COOLDOWN = 0.3
const WAVE_GLSL = `
uniform float uTime;
uniform vec4 uWaves[${WAVES}];
uniform float uWaveSpeed;
uniform float uWaveWidth;
uniform float uWaveStrength;
uniform float uWaveLife;
uniform float uWavePush;
float waveAt(vec3 pos, inout vec3 push) {
  float sum = 0.0;
  for (int i = 0; i < ${WAVES}; i++) {
    float age = uTime - uWaves[i].w;
    if (age < 0.0 || age > uWaveLife) continue;
    vec3 away = pos - uWaves[i].xyz;
    float dist = length(away);
    float off = (dist - age * uWaveSpeed) / uWaveWidth;
    float band = exp(-off * off) * (1.0 - age / uWaveLife);
    sum += band;
    if (dist > 1e-5) push += away / dist * band;
  }
  /* Наложенные волны не складываются выше одной: иначе серия щелчков в одну
     точку пересвечивала место удара и расталкивала точки там всё сильнее. */
  float len = length(push);
  if (len > 1.0) push /= len;
  return min(sum, 1.0) * uWaveStrength;
}`

const VERT = `
attribute float aShade;
attribute vec3 aFrom;
attribute float aBorn;
uniform float uSize;
uniform float uRatio;
uniform float uScale;
uniform float uTravel;
uniform float uJitter;
uniform float uJitterSpeed;
uniform float uTwinkle;
uniform float uTwinkleSpeed;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uPush;
uniform float uReach;
uniform float uAspect;
uniform float uFocal;
varying float vShade;
varying float vGlow;
varying float vWave;
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}
${WAVE_GLSL}
void main() {
  vShade = aShade;
  /* Перелёт: обновлённая точка не вспыхивает на новом месте, а плывёт туда
     из старого — сквозь тело модели. Время рождения пишет CPU раз на
     обновление, дальше движение считает шейдер. */
  float k = uTravel > 0.0 ? clamp((uTime - aBorn) / uTravel, 0.0, 1.0) : 1.0;
  vec3 p = mix(aFrom, position, k * k * (3.0 - 2.0 * k));
  /* Дрожание: у каждой точки своя фаза из хеша её координат, поэтому облако
     не качается целиком, а мелко «кипит». Сид берём от цели перелёта — он
     не меняется, пока точка летит. */
  if (uJitter > 0.0) {
    float s = hash(position) * 6.2831;
    float t = uTime * uJitterSpeed * 6.2831;
    p += vec3(sin(t * 1.13 + s), sin(t * 0.97 + s * 1.7 + 1.3), sin(t * 1.29 + s * 2.3 + 2.1)) * uJitter;
  }
  /* Мерцание: яркость пульсирует со своей частотой и фазой у каждой точки.
     Куб синуса даёт редкие вспышки на ровном фоне, а поправка 0.625 —
     среднее значение куба — держит общую яркость облака прежней. */
  vGlow = 1.0;
  if (uTwinkle > 0.0) {
    float seed = hash(position.zxy + 1.7);
    float blink = 0.5 + 0.5 * sin(uTime * uTwinkleSpeed * (0.6 + seed) * 6.2831 + hash(position) * 6.2831);
    vGlow = max(0.0, 1.0 + uTwinkle * (2.0 * blink * blink * blink - 0.625));
  }
  /* Волна: точки во фронте вспыхивают, крупнеют и чуть отходят от точки
     удара — по телу бежит видимое кольцо. */
  vec3 push = vec3(0.0);
  vWave = uWaveStrength > 0.0 ? waveAt(p, push) : 0.0;
  p += push * uWavePush;
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  /* Курсор сдвигает точки в плоскости экрана: считаем расстояние до него
     в координатах кадра, а двигаем в пространстве камеры — так пятно
     круглое на любом канвасе. Притяжение ограничено расстоянием до курсора,
     иначе точки проскакивали бы его насквозь. */
  if (uMouseOn > 0.0 && uPush != 0.0) {
    vec4 clip = projectionMatrix * view;
    vec2 d = (clip.xy / clip.w - uMouse) * vec2(uAspect, 1.0);
    float dist = length(d);
    float amount = smoothstep(uReach, 0.0, dist) * uMouseOn * uPush;
    if (amount < 0.0) amount = max(amount, -dist * -view.z * uFocal * 0.8);
    if (dist > 1e-4) view.xy += d / dist * amount;
  }
  gl_Position = projectionMatrix * view;
  /* Точки уменьшаются с удалением — иначе дальняя половина модели
     выглядит такой же плотной, как ближняя, и объём пропадает. Делим на
     размер самой модели: модели приходят в разных единицах (двигатель — сотни,
     олень — единицы), и без этого на мелкой точки слипались в силуэт. */
  gl_PointSize = uSize * uRatio * (uScale / max(0.0001, -view.z)) * (1.0 + vWave * 0.7);
}`

const FRAG = `
precision mediump float;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uBrightness;
uniform float uOpacity;
varying float vShade;
varying float vGlow;
varying float vWave;
void main() {
  /* Круглая точка вместо квадрата — маской по gl_PointCoord, без текстуры. */
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = dot(d, d);
  if (r > 0.25) discard;
  float edge = smoothstep(0.25, 0.05, r);
  vec3 col = mix(uColor, uAccent, vShade) * uBrightness * (1.0 + vWave * 0.6);
  /* Мерцание и волна работают через непрозрачность: на тёмной теме это
     яркость (аддитив), на светлой — плотность точки. Точки по умолчанию
     почти прозрачные, поэтому волне нужен большой множитель. */
  gl_FragColor = vec4(col, min(1.0, edge * uOpacity * vGlow * (1.0 + vWave * 5.0)));
  /* Свои цвета three держит в линейном пространстве, а на ShaderMaterial
     перевод в sRGB сам не навешивает — без этой строки облако выходит
     заметно темнее, чем задумано. */
  #include <colorspace_fragment>
}`

/* Линия со своим шейдером, а не LineBasicMaterial: затухание хвоста считается
   по номеру вершины (gl_VertexID) на GPU. Раньше цвет всего видимого хвоста
   пересчитывался и заливался заново каждый кадр — при десятках линий с
   длинными хвостами это сотни тысяч вершин за кадр. Теперь CPU пишет только
   новые сегменты. */
const LINE_VERT = `
attribute vec3 aTint;
uniform float uFrom;
uniform float uFadeSpan;
varying vec3 vTint;
varying float vFade;
${WAVE_GLSL}
void main() {
  vec3 push = vec3(0.0);
  float wave = uWaveStrength > 0.0 ? waveAt(position, push) : 0.0;
  vTint = aTint * (1.0 + wave * 1.5);
  float i = float(gl_VertexID) - uFrom;
  vFade = uFadeSpan > 0.0 ? clamp(i / uFadeSpan, 0.0, 1.0) : 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const LINE_FRAG = `
precision mediump float;
uniform float uOpacity;
varying vec3 vTint;
varying float vFade;
void main() {
  gl_FragColor = vec4(vTint * vFade, uOpacity);
  #include <colorspace_fragment>
}`

/* Запас буфера линии сверх хвоста: линия растёт в него между уплотнениями. */
const LINE_SLACK = 1200
/* Без хвоста линия видна целиком, и её длину ограничивает только буфер. */
const LINE_MIN_CAPACITY = 4200
/* Самая длинная линия при хвосте 0 («не стирать»). Дальше она живёт окном
   этой длины: старый конец плавно уходит в затухание. Раньше при заполнении
   буфера линия разом теряла 30% длины, а градиент затухания перетягивался
   по оставшейся — каждые несколько секунд линии резко моргали. */
const LINE_FREE_TAIL = LINE_MIN_CAPACITY - LINE_SLACK
/* Сколько точек поверхности заготавливается под линии на всю модель. */
const LINE_POOL = 24000

/* Ключ ячейки сетки. Коллизии хеша безвредны: лишний кандидат просто не
   пройдёт проверку расстояния. */
function cellKey(x, y, z) {
  return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0
}

function toRgb(value) {
  return new Color(value)
}

/** Суммарная площадь треугольников меша — по ней делим бюджет точек. */
function surfaceArea(geometry) {
  const position = geometry.getAttribute('position')
  if (!position) return 0
  const index = geometry.getIndex()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const ab = new Vector3()
  const ac = new Vector3()
  const count = index ? index.count : position.count
  let total = 0
  for (let i = 0; i < count; i += 3) {
    const i0 = index ? index.getX(i) : i
    const i1 = index ? index.getX(i + 1) : i + 1
    const i2 = index ? index.getX(i + 2) : i + 2
    a.fromBufferAttribute(position, i0)
    b.fromBufferAttribute(position, i1)
    c.fromBufferAttribute(position, i2)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    total += ab.cross(ac).length() * 0.5
  }
  return total
}

class Widget {
  constructor(el, options) {
    const host = typeof el === 'string' ? document.querySelector(el) : el
    if (!host) throw new Error('GlukeParticles: контейнер не найден')

    this.el = host
    this.o = Object.assign({}, DEFAULTS, options || {})
    this.ready = false
    this.raf = null
    /* Сторож кадров живёт вместе с виджетом (переживает detach/reattach),
       а источники и подписка создаются в bindRunSources(). */
    this.gate = null
    this.gateOff = null
    this.sources = null
    /* Поворот складывается из двух слагаемых: накопленного автоповорота
       и того, что пользователь накрутил перетаскиванием. На время драга
       автоповорот ставится на паузу — как у вьюверов моделей на сайте. */
    this.turn = 0
    this.spinAngle = 0
    this.leanOffset = 0
    this.dragging = false
    this.startedAt = performance.now()
    this.lastFrame = this.startedAt
    this.frozen = this.o.respectReducedMotion
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.canvas = this.renderer.domElement
    this.canvas.style.cssText = 'display:block;width:100%;height:100%'
    host.appendChild(this.canvas)
    host.__glukeParticles = this

    this.scene = new Scene()
    this.camera = new PerspectiveCamera(38, 1, 0.1, 200)
    this.group = new Group()
    this.scene.add(this.group)

    /* Базовые цвета держим отдельно: `hueShift` крутит от них, а не от уже
       сдвинутого значения, иначе ползунок «уползал» бы при каждом движении. */
    this.baseColor = toRgb(this.o.color)
    this.baseAccent = toRgb(this.o.accent)

    /* Часы и волны — общие объекты-юниформы для точек и всех линий: волна
       должна пройти по ним синхронно, а обновлять их хочется в одном месте. */
    this.fx = {
      uTime: { value: 0 },
      uWaves: { value: Array.from({ length: WAVES }, () => new Vector4(0, 0, 0, -1e6)) },
      uWaveSpeed: { value: 1 },
      uWaveWidth: { value: 1 },
      uWaveStrength: { value: 0 },
      uWaveLife: { value: 1 },
      uWavePush: { value: 0 },
    }
    this.lastStrike = -Infinity
    this.inverse = new Matrix4()
    this.mouse = new Vector2()
    this.mouseTarget = 0

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: this.o.additive ? AdditiveBlending : NormalBlending,
      uniforms: {
        uSize: { value: this.o.pointSize },
        uRatio: { value: 1 },
        uScale: { value: 1 },
        uColor: { value: this.baseColor.clone() },
        uAccent: { value: this.baseAccent.clone() },
        uBrightness: { value: this.o.brightness },
        uOpacity: { value: this.o.pointOpacity },
        uTravel: { value: this.o.pointTravel },
        uJitter: { value: 0 },
        uJitterSpeed: { value: this.o.jitterSpeed },
        uTwinkle: { value: 0 },
        uTwinkleSpeed: { value: 1 },
        uMouse: { value: this.mouse },
        uMouseOn: { value: 0 },
        uPush: { value: 0 },
        uReach: { value: 0.4 },
        uAspect: { value: 1 },
        uFocal: { value: Math.tan((this.camera.fov * Math.PI) / 360) },
        ...this.fx,
      },
    })
    /* Собственные часы облака: идут только пока виджет анимирует, поэтому
       после паузы вне экрана перелёты не «проскакивают» разом. */
    this.time = 0

    this.paths = []
    this.revealed = 0
    this.applyPalette()

    this.resize()
    this.bind()
    if (this.o.model) this.load(this.o.model)
  }

  /* Крутит оттенок всей палитры одним числом: цвет точек, подмешиваемый
     акцент и линии сдвигаются вместе, поэтому сочетание не разъезжается. */
  applyPalette() {
    const shift = this.o.hueShift || 0
    this.material.uniforms.uColor.value.copy(this.baseColor).offsetHSL(shift, 0, 0)
    this.material.uniforms.uAccent.value.copy(this.baseAccent).offsetHSL(shift, 0, 0)

    /* Линии разводятся по оттенку симметрично вокруг основного тона: при
       трёх линиях получаются «основной минус», «основной» и «основной плюс».
       Одна линия остаётся ровно в тоне — разводить нечего. */
    /* Цвет линий живёт в вершинах, поэтому при смене палитры перекрашиваем
       уже нарисованное: иначе хвост остался бы в старом тоне. Буфер короткий,
       пересчёт незаметен. */
    const tint = new Color()
    for (const path of this.paths) {
      for (let i = 0; i < path.count; i++) {
        this.lineTint(path, tint, path.walked - (path.count - 1 - i))
        const at = i * 3
        path.tints[at] = tint.r
        path.tints[at + 1] = tint.g
        path.tints[at + 2] = tint.b
      }
      path.dirtyFrom = 0
    }
  }

  /** Загружает модель и собирает по ней облако. */
  load(url) {
    /* Модели студии сжаты Draco, поэтому загрузчику нужен декодер. Путь не
       задаём: three сам эмитит wasm через `new URL(..., import.meta.url)`,
       и Vite кладёт его в свой бандл — как в GlukeLogo3D и вьювере моделей. */
    const draco = new DRACOLoader()
    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)

    loader.load(url, (gltf) => {
      draco.dispose()
      if (!this.renderer) return
      this.parts = []
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse((node) => {
        if (!node.isMesh || !node.geometry) return
        const area = surfaceArea(node.geometry)
        if (area > 0) this.parts.push({ mesh: node, area })
      })
      this.frame(gltf.scene)
      this.rebuild()
      this.ready = true
      this.start()
    }, undefined, (error) => {
      draco.dispose()
      console.error('[particles] модель не загрузилась', error)
    })
  }

  /* Ставим модель в центр и подбираем дистанцию камеры по описанной сфере:
     виджет должен одинаково работать и с двигателем, и с чем угодно ещё. */
  frame(root) {
    const sphere = new Sphere()
    const positions = []
    root.updateMatrixWorld(true)
    root.traverse((node) => {
      if (!node.isMesh || !node.geometry) return
      node.geometry.computeBoundingSphere()
      const s = node.geometry.boundingSphere.clone().applyMatrix4(node.matrixWorld)
      positions.push(s)
    })
    if (!positions.length) return
    sphere.copy(positions[0])
    for (const s of positions) sphere.union(s)
    this.center = sphere.center.clone()
    this.radius = Math.max(0.001, sphere.radius)
    /* Базовая дистанция вписывает модель целиком; масштаб из настроек
       подводит камеру ближе — крупнее, ценой обрезки краёв. */
    this.baseDistance = this.radius * 2.8
    this.applyScale()
    /* Плоскости отсечения считаем от модели, а не фиксируем: модели приходят
       в разных единицах — двигатель радиусом 49, волк 301, и с постоянным
       far = 200 второй целиком уезжал за дальнюю плоскость. */
    /* Опорный масштаб для размера точки: 5 радиусов даёт примерно те же
       точки, что подбирались на модели радиусом 300. */
    this.material.uniforms.uScale.value = this.radius * 5
    this.syncJitter()
    this.syncFx()
    this.camera.near = Math.max(0.0001, this.radius * 0.05)
    this.camera.far = this.radius * 12
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(0, 0, 0)
  }

  /* Сэмплер строится по геометрии, а не по узлу сцены: у пневмодвигателя
     58 деталей, но уникальных мешей 29 — остальные инстансы тех же геометрий,
     и строить для них таблицу площадей заново незачем. */
  samplerFor(mesh) {
    if (!this.samplers) this.samplers = new Map()
    const key = mesh.geometry.uuid
    let sampler = this.samplers.get(key)
    if (!sampler) {
      sampler = new MeshSurfaceSampler(mesh).build()
      this.samplers.set(key, sampler)
    }
    return sampler
  }

  /* Цвет очередной вершины линии: собственный тон линии плюс медленный
     перелив по её длине. Возвращает тот же объект, чтобы не сорить. */
  lineTint(path, target, walked) {
    const shift = this.o.hueShift || 0
    const spread = this.o.lineHueSpread || 0
    const count = Math.max(1, this.paths.length)
    const own = count > 1 ? (path.index / (count - 1) - 0.5) * spread : 0
    const step = walked === undefined ? path.walked : walked
    const drift = Math.sin(step * 0.03) * (this.o.lineShimmer || 0)
    return target.copy(this.baseAccent).offsetHSL(shift + own + drift, 0, 0)
  }

  /* Одна точка на поверхности выбранной детали, уже в координатах сцены и
     со сдвигом по нормали. Вынесено отдельно, потому что точки берутся и при
     первой сборке облака, и потом бесконечно — при обновлении по кругу. */
  samplePoint(part, point, normal) {
    const sampler = this.samplerFor(part.mesh)
    sampler.sample(point, normal)
    point.applyMatrix4(part.mesh.matrixWorld)
    if (this.o.spread) {
      normal.transformDirection(part.mesh.matrixWorld)
      point.addScaledVector(normal, (Math.random() - 0.5) * this.o.spread * this.radius)
    }
    point.sub(this.center)
    return point
  }

  /* Деталь выбирается пропорционально площади — так плотность облака
     остаётся ровной и при обновлении, а не только при первой сборке. */
  pickPart() {
    const roll = Math.random() * this.areaTotal
    let sum = 0
    for (const part of this.parts) {
      sum += part.area
      if (roll <= sum) return part
    }
    return this.parts[this.parts.length - 1]
  }

  /* Бесконечная перерисовка вместо сброса. Облако уже полное, поэтому вместо
     обнуления мы по кругу заменяем самые старые точки свежими: сзади стирается,
     впереди появляется. Память не растёт — буфер тот же, переписываются слоты.
     Пишем подряд и обновляем ровно тронутый кусок, а не весь атрибут. */
  refreshPoints(count) {
    if (!this.points || !this.written || count <= 0) return
    const geometry = this.points.geometry
    const position = geometry.getAttribute('position')
    const shade = geometry.getAttribute('aShade')
    const from = geometry.getAttribute('aFrom')
    const born = geometry.getAttribute('aBorn')
    const point = new Vector3()
    const normal = new Vector3()
    const here = new Vector3()
    const best = new Vector3()

    const start = this.refreshCursor % this.written
    const span = Math.min(count, this.written - start)
    const travel = Math.max(0, this.o.pointTravel || 0)
    /* Дальность в два радиуса и больше — вся модель, искать соседа незачем. */
    const hop = Math.max(0, this.o.pointHop ?? 2) * this.radius
    const local = travel > 0 && hop < this.radius * 2

    for (let i = 0; i < span; i++) {
      const slot = start + i
      /* Старт перелёта — там, где точка видна прямо сейчас, даже если она
         прошлый раз ещё не долетела: иначе она дёрнулась бы назад. */
      let k = travel > 0 ? Math.min(1, Math.max(0, (this.time - born.getX(slot)) / travel)) : 1
      k = k * k * (3 - 2 * k)
      const fx = from.getX(slot)
      const fy = from.getY(slot)
      const fz = from.getZ(slot)
      here.set(
        fx + (position.getX(slot) - fx) * k,
        fy + (position.getY(slot) - fy) * k,
        fz + (position.getZ(slot) - fz) * k,
      )

      if (local) {
        /* Короткий перелёт: первая случайная точка в радиусе, а не нашлось —
           ближайшая из попыток. Попыток мало и число их ограничено:
           обновляются тысячи точек в секунду. */
        let bestDist = Infinity
        for (let tries = 0; tries < 12; tries++) {
          this.samplePoint(this.pickPart(), point, normal)
          const dist = point.distanceTo(here)
          if (dist < bestDist) {
            bestDist = dist
            best.copy(point)
          }
          if (dist < hop) break
        }
        point.copy(best)
      }
      else {
        this.samplePoint(this.pickPart(), point, normal)
      }

      from.setXYZ(slot, here.x, here.y, here.z)
      born.setX(slot, this.time)
      position.setXYZ(slot, point.x, point.y, point.z)
      shade.setX(slot, Math.min(1, Math.max(0, point.y / (this.radius * 2) + 0.5)))
    }

    for (const [attribute, size] of [[position, 3], [from, 3], [shade, 1], [born, 1]]) {
      attribute.addUpdateRange(start * size, span * size)
      attribute.needsUpdate = true
    }
    this.refreshCursor = (start + span) % this.written
  }

  /** Пересобирает облако: бюджет точек делится по площади деталей. */
  rebuild() {
    if (!this.parts || !this.parts.length) return
    const total = this.parts.reduce((sum, p) => sum + p.area, 0)
    this.areaTotal = total
    const wanted = Math.max(0, Math.round(this.o.points))

    const positions = new Float32Array(wanted * 3)
    const shades = new Float32Array(wanted)
    const point = new Vector3()
    const normal = new Vector3()
    let written = 0

    for (const part of this.parts) {
      const share = written >= wanted
        ? 0
        : Math.min(wanted - written, Math.round(wanted * (part.area / total)))
      if (share <= 0) continue
      for (let i = 0; i < share; i++) {
        this.samplePoint(part, point, normal)
        const at = written * 3
        positions[at] = point.x
        positions[at + 1] = point.y
        positions[at + 2] = point.z
        /* Оттенок по высоте: даёт объём без второго источника света. */
        shades[written] = Math.min(1, Math.max(0, point.y / (this.radius * 2) + 0.5))
        written++
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions.subarray(0, written * 3), 3))
    geometry.setAttribute('aShade', new Float32BufferAttribute(shades.subarray(0, written), 1))
    /* До первого обновления точке лететь неоткуда: старт совпадает с целью. */
    geometry.setAttribute('aFrom', new Float32BufferAttribute(positions.slice(0, written * 3), 3))
    geometry.setAttribute('aBorn', new Float32BufferAttribute(new Float32Array(written).fill(-1e6), 1))

    if (this.points) {
      this.group.remove(this.points)
      this.points.geometry.dispose()
    }
    this.points = new Points(geometry, this.material)
    /* Точки уже посчитаны все, но показываем их постепенно: диапазон отрисовки
       растёт кадр за кадром. Дописывать буфер каждый кадр, как в исходном
       примере, незачем — это пересоздание атрибута на каждом кадре. */
    geometry.setDrawRange(0, 0)
    this.group.add(this.points)
    this.written = written
    this.revealed = 0
    this.refreshCursor = 0
    this.buildPaths()
  }

  /* Линии ползут по поверхности: следующая точка берётся случайно и
     принимается, только если она недалеко от предыдущей. Каждая линия живёт
     на своей детали — иначе она прыгала бы через всю модель. */
  buildPaths() {
    for (const path of this.paths) {
      this.group.remove(path.line)
      path.line.geometry.dispose()
      path.material.dispose()
    }
    this.paths = []
    if (!this.parts || !this.parts.length) return

    const wanted = Math.max(0, Math.round(this.o.paths))
    const byArea = [...this.parts].sort((a, b) => b.area - a.area)

    for (let i = 0; i < wanted; i++) {
      const part = byArea[i % Math.min(byArea.length, 8)]
      /* У каждой линии свой материал: окно затухания у каждой своё. Оттенок
         живёт в вершинах — вдоль линии он плывёт, а сами линии расходятся
         по кругу вокруг основного тона: рядом с фиолетовым синий и малиновый.
         Светят тем же, что и точки: аддитивно, без глубины. */
      const material = new ShaderMaterial({
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: this.o.additive ? AdditiveBlending : NormalBlending,
        uniforms: {
          uFrom: { value: 0 },
          uFadeSpan: { value: 0 },
          uOpacity: { value: this.o.lineOpacity },
          ...this.fx,
        },
      })
      const line = new Line(new BufferGeometry(), material)
      line.frustumCulled = false
      this.group.add(line)
      const path = { part, buffer: null, tints: null, line, material, index: i, count: 0, previous: null, walked: 0, dirtyFrom: 0 }
      this.ensureCapacity(path)
      this.paths.push(path)
    }
    this.applyPalette()
  }

  /* Буфер линии растёт под хвост: длинный хвост из лаборатории не должен
     заранее съедать память у всех линий. Геометрию при росте заменяем
     целиком — подмена атрибута оставила бы старый GL-буфер висеть до
     dispose(). */
  ensureCapacity(path) {
    const tail = Math.max(0, Math.round(this.o.lineTail))
    const need = Math.max(LINE_MIN_CAPACITY, tail + LINE_SLACK)
    if (path.buffer && path.buffer.length / 3 >= need) return
    const buffer = new Float32Array(need * 3)
    const tints = new Float32Array(need * 3)
    if (path.buffer) {
      buffer.set(path.buffer.subarray(0, path.count * 3))
      tints.set(path.tints.subarray(0, path.count * 3))
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(buffer, 3))
    geometry.setAttribute('aTint', new BufferAttribute(tints, 3))
    geometry.setDrawRange(0, 0)
    path.line.geometry.dispose()
    path.line.geometry = geometry
    path.geometry = geometry
    path.buffer = buffer
    path.tints = tints
    path.dirtyFrom = 0
  }

  /* Заготовка точек поверхности под линии, уже в координатах сцены и с
     нормалями. Раньше каждый шаг линии искал соседа перебором свежих
     случайных точек: при малом шаге подходила одна из десятков, и больше
     ~70 шагов в секунду на линию не выходило, сколько ни проси. Из
     заготовки сосед берётся через сетку — за считанные проверки. */
  poolFor(part) {
    if (part.pool) return part.pool
    const n = Math.max(500, Math.round(LINE_POOL * part.area / this.areaTotal))
    const pos = new Float32Array(n * 3)
    const nrm = new Float32Array(n * 3)
    const point = new Vector3()
    const normal = new Vector3()
    const sampler = this.samplerFor(part.mesh)
    const matrix = part.mesh.matrixWorld
    for (let i = 0; i < n; i++) {
      sampler.sample(point, normal)
      point.applyMatrix4(matrix).sub(this.center)
      normal.transformDirection(matrix)
      point.toArray(pos, i * 3)
      normal.toArray(nrm, i * 3)
    }
    part.pool = { pos, nrm, n, cell: 0, grid: null }
    return part.pool
  }

  /* Сетка с ячейкой в длину шага: соседи точки лежат в 27 ячейках вокруг
     неё. Меняется шаг — сетка пересобирается, это доли миллисекунды. */
  gridFor(pool, cell) {
    if (pool.cell === cell && pool.grid) return
    const grid = new Map()
    for (let i = 0; i < pool.n; i++) {
      const key = cellKey(
        Math.floor(pool.pos[i * 3] / cell),
        Math.floor(pool.pos[i * 3 + 1] / cell),
        Math.floor(pool.pos[i * 3 + 2] / cell),
      )
      const bucket = grid.get(key)
      if (bucket) bucket.push(i)
      else grid.set(key, [i])
    }
    pool.cell = cell
    pool.grid = grid
  }

  /* Следующая точка линии — случайный сосед предыдущей ближе шага. Первая
     точка линии — любая. Прыгать в случайное место линии нельзя никогда:
     отрезок прочертил бы яркую прямую через всю модель. Раньше так и было —
     после 24 неудачных попыток при малом шаге (0.4% шагов). */
  nextPoolPoint(pool, previous, limit) {
    if (previous === null) return Math.floor(Math.random() * pool.n)
    const pos = pool.pos
    const px = pos[previous * 3]
    const py = pos[previous * 3 + 1]
    const pz = pos[previous * 3 + 2]
    const cx = Math.floor(px / pool.cell)
    const cy = Math.floor(py / pool.cell)
    const cz = Math.floor(pz / pool.cell)
    /* Ячейки вокруг — ссылками, без склейки в один массив: при крупном шаге
       в них тысячи точек, а копировать их на каждый шаг незачем. */
    const buckets = this.nearBuckets || (this.nearBuckets = [])
    buckets.length = 0
    let total = 0
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = pool.grid.get(cellKey(cx + dx, cy + dy, cz + dz))
          if (bucket) {
            buckets.push(bucket)
            total += bucket.length
          }
        }
      }
    }
    const limit2 = limit * limit
    const dist2 = (j) => {
      const dx = pos[j * 3] - px
      const dy = pos[j * 3 + 1] - py
      const dz = pos[j * 3 + 2] - pz
      return dx * dx + dy * dy + dz * dz
    }

    /* Обычный путь: несколько случайных кандидатов из ячеек вокруг —
       равномерно, и почти всегда хватает пары попыток. */
    for (let tries = 0; tries < 24; tries++) {
      let r = Math.floor(Math.random() * total)
      let b = 0
      while (r >= buckets[b].length) r -= buckets[b++].length
      const j = buckets[b][r]
      if (j !== previous && dist2(j) < limit2) return j
    }

    /* Не повезло: просматриваем ячейки целиком с случайного места — первый
       же сосед в пределах шага. Нет такого — ближайший из просмотренных. */
    let nearest = -1
    let nearestD = Infinity
    const offset = Math.floor(Math.random() * buckets.length)
    for (let k = 0; k < buckets.length; k++) {
      const bucket = buckets[(k + offset) % buckets.length]
      const shift = Math.floor(Math.random() * bucket.length)
      for (let i = 0; i < bucket.length; i++) {
        const j = bucket[(i + shift) % bucket.length]
        if (j === previous) continue
        const d = dist2(j)
        if (d < limit2) return j
        if (d < nearestD) {
          nearestD = d
          nearest = j
        }
      }
    }
    if (nearest >= 0) return nearest

    /* Одинокая точка без соседей в своих ячейках — ближайшая по всей
       заготовке. Случается на тонких краях детали, и то редко. */
    for (let j = 0; j < pool.n; j++) {
      if (j === previous) continue
      const d = dist2(j)
      if (d < nearestD) {
        nearestD = d
        nearest = j
      }
    }
    return nearest >= 0 ? nearest : previous
  }

  /* Один шаг всех линий. */
  stepPaths(dt) {
    if (!this.paths.length) return
    const limit = this.o.pathStep * this.radius
    const point = new Vector3()
    const normal = new Vector3()
    const tint = new Color()
    const tail = Math.max(0, Math.round(this.o.lineTail))
    /* Видимое окно линии: хвост из настроек, а без него — предельная длина. */
    const reach = tail > 0 ? tail : LINE_FREE_TAIL
    const fade = Math.max(0, this.o.lineFade || 0)
    /* Частота волны смещения на сегмент: подобрана так, чтобы линия успевала
       нырнуть и вынырнуть за десяток шагов, а не дрожала попиксельно. */
    const WAVE_RATE = 0.11

    for (const path of this.paths) {
      const pool = this.poolFor(path.part)
      this.gridFor(pool, limit)
      /* Копим дробные шаги: скорость задана в сегментах в секунду, и при
         малых значениях линия делает шаг раз в несколько кадров. Прежний
         расчёт «на кадр» не давал опуститься ниже 60 сегментов в секунду. */
      path.accum = (path.accum || 0) + Math.max(0, this.o.pathSpeed) * dt
      const steps = Math.floor(path.accum)

      const capacity = path.buffer.length / 3

      for (let s = 0; s < steps; s++) {
        if (path.count >= capacity) {
          /* Буфер кончился — линия не останавливается, а переносит последние
             точки в начало и пишет дальше. Сохраняем ровно видимое окно,
             поэтому перенос на экране незаметен. Копия случается раз в сотни
             сегментов и на кадр не влияет. */
          const keep = Math.min(reach, capacity - 1)
          path.buffer.copyWithin(0, (path.count - keep) * 3, path.count * 3)
          path.tints.copyWithin(0, (path.count - keep) * 3, path.count * 3)
          path.count = keep
          path.dirtyFrom = 0
        }
        const next = this.nextPoolPoint(pool, path.previous, limit)
        path.accum -= 1
        path.previous = next
        point.fromArray(pool.pos, next * 3)
        normal.fromArray(pool.nrm, next * 3)

        /* Близость проверяем по точке на поверхности, а смещаем уже при
           записи: иначе линия «убегала» бы сама от себя и рвалась. */
        path.walked++

        if (this.o.lineDisplace) {
          const wave = Math.sin(path.walked * WAVE_RATE + path.index * 1.7)
          point.addScaledVector(normal, wave * this.o.lineDisplace * this.radius)
        }

        const at = path.count * 3
        path.buffer[at] = point.x
        path.buffer[at + 1] = point.y
        path.buffer[at + 2] = point.z

        /* Перелив вдоль линии: оттенок медленно плывёт от её собственного
           тона и возвращается обратно. */
        this.lineTint(path, tint)
        path.tints[at] = tint.r
        path.tints[at + 1] = tint.g
        path.tints[at + 2] = tint.b
        path.dirtyFrom = Math.min(path.dirtyFrom, path.count)
        path.count++
      }
      /* Хвост стираем не удалением данных, а сдвигом окна отрисовки:
         показываем последние `tail` точек, начало линии уходит само. */
      const shown = Math.min(reach, path.count)
      const from = path.count - shown
      path.geometry.setDrawRange(from, shown)

      /* Затухание хвоста — в шейдере, по номеру вершины от начала окна.
         Больше единицы — рампа длиннее видимого окна: линия не успевает
         выйти на полную яркость и гаснет мягче по всей длине. */
      path.material.uniforms.uFrom.value = from
      path.material.uniforms.uFadeSpan.value = fade > 0 ? Math.max(1, Math.floor(shown * fade)) : 0

      /* На GPU уходит только дописанное с прошлого кадра. */
      if (path.dirtyFrom < path.count) {
        const at = path.dirtyFrom * 3
        const size = (path.count - path.dirtyFrom) * 3
        for (const name of ['position', 'aTint']) {
          const attribute = path.geometry.attributes[name]
          attribute.addUpdateRange(at, size)
          attribute.needsUpdate = true
        }
      }
      path.dirtyFrom = Infinity
    }
  }

  resize() {
    const width = Math.max(1, this.el.clientWidth)
    const height = Math.max(1, this.el.clientHeight)
    let ratio = Math.min(window.devicePixelRatio || 1, this.o.ratioCap)
    if (width * height * ratio * ratio > this.o.pixelBudget) {
      ratio = Math.sqrt(this.o.pixelBudget / (width * height))
    }
    this.cssW = width
    this.cssH = height
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.material.uniforms.uAspect.value = width / height
    this.camera.updateProjectionMatrix()
    /* Размер точки привязан к высоте буфера, а не к devicePixelRatio:
       иначе на большом канвасе облако выглядит разреженным, а на мелком
       слипается. 420 — опорная высота, при ней множитель равен единице. */
    this.material.uniforms.uRatio.value = (height * ratio) / 420
  }

  bind() {
    this.onResize = () => this.resize()
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(this.onResize)
      this.ro.observe(this.el)
    }
    else {
      window.addEventListener('resize', this.onResize)
    }

    if (this.o.drag) {
      /* Тач: вертикальный свайп должен скроллить страницу, а не крутить
         модель. Ось жеста фиксируем один раз по первой доминирующей
         компоненте движения — тот же приём, что в вьювере на главной. */
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const LOCK_PX = 6
      let axis = null
      let startX = 0
      let startY = 0
      let lastX = 0
      let lastY = 0

      this.onPointerDown = (event) => {
        this.dragging = true
        axis = null
        startX = lastX = event.clientX
        startY = lastY = event.clientY
        if (!coarse) {
          try {
            this.canvas.setPointerCapture(event.pointerId)
          }
          catch {
            /* Синтетические события без активного указателя: захват
               не обязателен, перетаскивание работает и без него. */
          }
        }
      }

      this.onPointerMove = (event) => {
        if (!this.dragging) return
        const dx = event.clientX - lastX
        const dy = event.clientY - lastY
        lastX = event.clientX
        lastY = event.clientY

        if (coarse) {
          if (axis === null) {
            const adx = Math.abs(event.clientX - startX)
            const ady = Math.abs(event.clientY - startY)
            if (adx < LOCK_PX && ady < LOCK_PX) return
            axis = adx >= ady ? 'x' : 'y'
          }
          if (axis === 'y') return
        }

        this.turn += dx * this.o.dragSensitivity
        if (!coarse) {
          const limit = (this.o.tiltLimit * Math.PI) / 180
          this.leanOffset = Math.min(limit, Math.max(-limit, this.leanOffset + dy * this.o.dragSensitivity))
        }
      }

      this.onPointerUp = (event) => {
        this.dragging = false
        axis = null
        if (this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(event.pointerId)) {
          this.canvas.releasePointerCapture(event.pointerId)
        }
      }

      this.canvas.addEventListener('pointerdown', this.onPointerDown)
      this.canvas.addEventListener('pointermove', this.onPointerMove)
      this.canvas.addEventListener('pointerup', this.onPointerUp)
      this.canvas.addEventListener('pointercancel', this.onPointerUp)
      this.canvas.style.touchAction = 'pan-y'
      this.canvas.style.cursor = 'grab'
    }

    /* Курсор и волна слушают канвас отдельно от вращения: они работают и
       без драга, а нажатие одновременно и крутит модель, и бьёт волну. */
    this.onHover = (event) => {
      this.pointerToNdc(event, this.mouse)
      this.mouseTarget = 1
    }
    this.onHoverEnd = (event) => {
      /* Палец, в отличие от мыши, после касания исчезает — гасим и на отпускании. */
      if (event.type === 'pointerleave' || event.pointerType !== 'mouse') this.mouseTarget = 0
    }
    this.onStrike = (event) => {
      this.pointerToNdc(event, this.mouse)
      this.mouseTarget = 1
      if (event.button === 0) this.strike(this.mouse)
    }
    this.canvas.addEventListener('pointermove', this.onHover)
    this.canvas.addEventListener('pointerdown', this.onStrike)
    this.canvas.addEventListener('pointerleave', this.onHoverEnd)
    this.canvas.addEventListener('pointerup', this.onHoverEnd)
    this.canvas.addEventListener('pointercancel', this.onHoverEnd)

    this.bindRunSources()
  }

  pointerToNdc(event, target) {
    const rect = this.canvas.getBoundingClientRect()
    return target.set(
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    )
  }

  /* Точка удара — ближайшая к камере точка поверхности, мимо которой
     проходит луч из-под курсора. Вместо рейкаста по треугольникам берём
     заготовку точек линий (24 тысячи): проверка — доли миллисекунды, а
     точнее для волны и не нужно. Промах мимо модели волну не запускает. */
  strike(ndc) {
    if (!this.ready || !this.parts || this.frozen || !(this.o.waveStrength > 0)) return
    if (this.time - this.lastStrike < WAVE_COOLDOWN) return
    /* Новая волна — только в свободный слот. Раньше пятый щелчок подряд
       занимал слот самой старой волны, и та обрывалась посреди модели.
       Слотов четыре, волна живёт ~1,8 с — не больше четырёх волн за это время,
       лишние щелчки просто не срабатывают. */
    const waves = this.fx.uWaves.value
    const slot = waves.findIndex(wave => this.time - wave.w >= this.fx.uWaveLife.value)
    if (slot < 0) return
    this.group.updateMatrixWorld()
    const ray = this.ray || (this.ray = new Raycaster())
    ray.setFromCamera(ndc, this.camera)
    const local = ray.ray.clone().applyMatrix4(this.inverse.copy(this.group.matrixWorld).invert())
    const ox = local.origin.x
    const oy = local.origin.y
    const oz = local.origin.z
    const { x: dx, y: dy, z: dz } = local.direction
    const hit2 = (this.radius * 0.05) ** 2
    let best = Infinity
    let bx = 0
    let by = 0
    let bz = 0
    for (const part of this.parts) {
      const { pos, n } = this.poolFor(part)
      for (let i = 0; i < n; i++) {
        const vx = pos[i * 3] - ox
        const vy = pos[i * 3 + 1] - oy
        const vz = pos[i * 3 + 2] - oz
        const t = vx * dx + vy * dy + vz * dz
        if (t <= 0 || t >= best) continue
        if (vx * vx + vy * vy + vz * vz - t * t > hit2) continue
        best = t
        bx = pos[i * 3]
        by = pos[i * 3 + 1]
        bz = pos[i * 3 + 2]
      }
    }
    if (best === Infinity) return
    waves[slot].set(bx, by, bz, this.time)
    this.lastStrike = this.time
  }

  /* Источники кадров: активность вкладки и пересечение с вьюпортом — два
     независимых признака (utils/widgetRunGate). Раньше оба писали в один
     this.visible, а detach() его не сбрасывал: кэшированный виджет после
     снятия канваса оживал по возвращении на вкладку и рисовал в никуда. */
  bindRunSources() {
    if (!this.gate) this.gate = createRunGate({ pauseOffscreen: this.o.pauseOffscreen })
    this.gateOff = this.gate.subscribe((run) => {
      if (run) this.start()
      else this.stop()
    })
    this.sources = attachRunSources(this.el, this.gate, {
      pauseOffscreen: this.o.pauseOffscreen,
    })
  }

  unbindRunSources() {
    if (this.sources) this.sources.disconnect()
    this.sources = null
    if (this.gateOff) this.gateOff()
    this.gateOff = null
  }

  set(patch) {
    /* Лаборатория, смена темы и перецепление из кэша присылают весь набор
       параметров разом, даже когда сдвинут один ползунок. Берём только то,
       что действительно поменялось: иначе любое касание пересобирало облако
       и линии с нуля — модель жёстко сбрасывалась и прорисовывалась заново. */
    const next = {}
    for (const [key, value] of Object.entries(patch || {})) {
      if (value !== this.o[key]) next[key] = value
    }
    const needsRebuild = next.points !== undefined || next.spread !== undefined
    Object.assign(this.o, next)
    if (next.color !== undefined) this.baseColor = toRgb(this.o.color)
    if (next.accent !== undefined) this.baseAccent = toRgb(this.o.accent)
    if (next.color !== undefined || next.accent !== undefined || next.hueShift !== undefined
      || next.lineHueSpread !== undefined) {
      this.applyPalette()
    }
    if (next.brightness !== undefined) this.material.uniforms.uBrightness.value = this.o.brightness
    if (next.pointOpacity !== undefined) this.material.uniforms.uOpacity.value = this.o.pointOpacity
    if (next.pointSize !== undefined) this.material.uniforms.uSize.value = this.o.pointSize
    if (next.pointTravel !== undefined) this.material.uniforms.uTravel.value = Math.max(0, this.o.pointTravel)
    if (next.jitterSpeed !== undefined) this.material.uniforms.uJitterSpeed.value = this.o.jitterSpeed
    if (next.pointJitter !== undefined) this.syncJitter()
    if (next.modelScale !== undefined) this.applyScale()
    this.syncFx()
    if (next.paths !== undefined && this.ready) this.buildPaths()
    else if (next.lineTail !== undefined) for (const path of this.paths) this.ensureCapacity(path)
    if (next.lineOpacity !== undefined) {
      /* Материал у каждой линии свой, поэтому прозрачность разносим по всем:
         на светлой теме линии должны уходить в полутон, а не спорить с фоном. */
      for (const path of this.paths) path.material.uniforms.uOpacity.value = this.o.lineOpacity
    }
    if (next.additive !== undefined) {
      for (const path of this.paths) {
        path.material.blending = this.o.additive ? AdditiveBlending : NormalBlending
        path.material.needsUpdate = true
      }
      /* На светлом фоне аддитив уводит облако в белое, поэтому тема
         переключает режим смешивания вместе с цветом. */
      this.material.blending = this.o.additive ? AdditiveBlending : NormalBlending
      this.material.needsUpdate = true
    }
    if (needsRebuild && this.ready) this.rebuild()
    if (!this.raf) this.draw(performance.now())
    return this
  }

  /* Курсор, мерцание и волна: параметры в долях радиуса и кадра, шейдеру
     нужны единицы модели. Дёшево, поэтому гоняется на каждый set(). */
  syncFx() {
    const u = this.material.uniforms
    const radius = this.radius || 1
    u.uTwinkle.value = Math.max(0, this.o.twinkle || 0)
    u.uTwinkleSpeed.value = Math.max(0, this.o.twinkleSpeed || 0)
    u.uPush.value = (this.o.cursorPush || 0) * radius
    /* Доля высоты канваса → единицы NDC, где высота равна двум. */
    u.uReach.value = Math.max(0.001, (this.o.cursorReach || 0) * 2)
    const speed = Math.max(0.05, this.o.waveSpeed || 0) * radius
    this.fx.uWaveSpeed.value = speed
    this.fx.uWaveWidth.value = Math.max(0.01, this.o.waveWidth || 0) * radius
    this.fx.uWaveStrength.value = Math.max(0, this.o.waveStrength || 0)
    /* Волна живёт, пока фронт не пересечёт модель насквозь. */
    this.fx.uWaveLife.value = (radius * 2.2) / speed
    this.fx.uWavePush.value = radius * 0.04
  }

  applyScale() {
    if (!this.baseDistance) return
    this.camera.position.set(0, 0, this.baseDistance / Math.max(0.1, this.o.modelScale || 1))
  }

  /* Дрожание задано в долях радиуса, а шейдеру нужны единицы модели. */
  syncJitter() {
    this.material.uniforms.uJitter.value = Math.max(0, this.o.pointJitter || 0) * (this.radius || 0)
  }

  draw(now) {
    if (this.el.clientWidth !== this.cssW || this.el.clientHeight !== this.cssH) this.resize()

    /* Шаг времени, а не «на кадр»: на 120-герцовом экране прежний расчёт
       проявлял облако вдвое быстрее заявленного, и сброс наступал через
       восемь секунд вместо шестнадцати. */
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) * 0.001))
    this.lastFrame = now

    if (!this.frozen) this.time += dt
    this.fx.uTime.value = this.time
    /* Курсор включается и гаснет плавно: точки не отпрыгивают рывком,
       когда мышь заходит на канвас или уходит с него. */
    const on = this.material.uniforms.uMouseOn
    on.value += (this.mouseTarget - on.value) * Math.min(1, dt * 8)
    if (on.value < 0.001) on.value = 0

    if (this.points && !this.frozen) {
      /* Проявление: за `reveal` секунд диапазон отрисовки доходит до конца.
         Ноль — показать сразу. */
      const total = this.written || 0
      const rate = Math.max(0, this.o.revealSpeed)
      if (rate <= 0) {
        /* Ноль — точки не проявляются: остаются только линии. */
        this.revealed = 0
      }
      else if (total <= 0) {
        /* Облака нет вовсе — иначе условие «прорисовалось» срабатывало бы
           каждый кадр и пересобирало линии, не давая им вырасти. */
        this.revealed = 0
      }
      else if (this.revealed < total) {
        this.revealed = Math.min(total, this.revealed + total * rate * dt)
      }
      else if (this.o.loop) {
        /* Облако прорисовалось — дальше не сбрасываем, а обновляем по кругу
           с той же скоростью: точки продолжают появляться бесконечно. */
        this.refreshPoints(Math.ceil(total * rate * dt))
      }
      this.points.geometry.setDrawRange(0, Math.floor(this.revealed))
      /* Размер 0 — точек не видно совсем. Полагаться на `gl_PointSize = 0`
         нельзя: часть драйверов всё равно рисует пиксель, поэтому просто
         снимаем объект с отрисовки. */
      this.points.visible = this.o.pointSize > 0
      this.stepPaths(dt)
    }
    else if (this.points) {
      this.points.geometry.setDrawRange(0, this.written || 0)
    }

    /* Автоповорот копим сами, а не считаем от абсолютного времени: иначе
       после паузы на перетаскивании модель прыгнула бы на угол, накрученный
       за время простоя. */
    if (!this.frozen && !this.dragging) this.spinAngle += dt * this.o.spin

    this.group.rotation.y = this.o.yaw + this.spinAngle + this.turn
    this.group.rotation.x = this.o.tilt + this.leanOffset
    this.renderer.render(this.scene, this.camera)
  }

  loop(now) {
    this.raf = requestAnimationFrame(t => this.loop(t))
    this.draw(now)
  }

  start() {
    if (this.raf || !this.gate || !this.gate.shouldRun() || !this.ready) return
    this.raf = requestAnimationFrame(t => this.loop(t))
  }

  stop() {
    if (!this.raf) return
    cancelAnimationFrame(this.raf)
    this.raf = null
  }

  /** Снять канвас, сохранив сцену и облако для перецепления. */
  detach() {
    this.stop()
    if (this.ro) this.ro.disconnect()
    /* Снятый виджет обязан отписать источники: иначе слушатель вкладки
       переживёт свой канвас и снова запустит цикл. */
    this.unbindRunSources()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    if (this.el.__glukeParticles === this) delete this.el.__glukeParticles
  }

  reattach(el) {
    this.el = el
    el.appendChild(this.canvas)
    el.__glukeParticles = this
    if (this.ro) this.ro.observe(el)
    this.bindRunSources()
    this.resize()
    this.start()
  }

  destroy() {
    this.detach()
    if (this.onPointerDown) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown)
      this.canvas.removeEventListener('pointermove', this.onPointerMove)
      this.canvas.removeEventListener('pointerup', this.onPointerUp)
      this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    }
    this.canvas.removeEventListener('pointermove', this.onHover)
    this.canvas.removeEventListener('pointerdown', this.onStrike)
    this.canvas.removeEventListener('pointerleave', this.onHoverEnd)
    this.canvas.removeEventListener('pointerup', this.onHoverEnd)
    this.canvas.removeEventListener('pointercancel', this.onHoverEnd)
    if (!this.ro) window.removeEventListener('resize', this.onResize)
    if (this.points) this.points.geometry.dispose()
    for (const path of this.paths) {
      path.geometry.dispose()
      path.material.dispose()
    }
    this.material.dispose()
    this.renderer.dispose()
    /* dispose() отпускает ресурсы three, но не сам контекст: его отпускаем
       сразу, как и остальные виджеты, — живых контекстов у браузера немного. */
    this.renderer.forceContextLoss()
    this.renderer = null
    /* Реестр не должен держать уничтоженный инстанс: вытеснение из кэша
       виджетов зовёт destroy(), и без этого массив рос бы всю сессию. */
    const at = GlukeParticles.instances.indexOf(this)
    if (at > -1) GlukeParticles.instances.splice(at, 1)
  }
}

const GlukeParticles = {
  defaults: DEFAULTS,
  instances: [],
  create(el, options) {
    const widget = new Widget(el, options)
    GlukeParticles.instances.push(widget)
    return widget
  },
}

export default GlukeParticles
