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
  LineBasicMaterial,
  Matrix4,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

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
  lineTail: 0, // сколько точек линия держит за собой; 0 — не стирать хвост
  lineHueSpread: 0.12, // разлёт оттенков между линиями по цветовому кругу
  lineShimmer: 0.08, // перелив цвета вдоль самой линии, доля цветового круга
  lineDisplace: 0.05, // насколько линия отрывается от поверхности, доля радиуса
  lineOpacity: 0.15, // непрозрачность линий; на светлой теме её убавляет тема

  // --- движение ---
  /* Стартовый поворот модели: прямо на зрителя модель неинформативна
     (особенно олень в профиль), поэтому показываем её в три четверти.
     Угол в радианах — 0.6 это примерно 34 градуса. */
  yaw: 0.6,
  spin: 0.15, // собственное вращение, радиан в секунду
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

const VERT = `
attribute float aShade;
uniform float uSize;
uniform float uRatio;
uniform float uScale;
varying float vShade;
void main() {
  vShade = aShade;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * view;
  /* Точки уменьшаются с удалением — иначе дальняя половина модели
     выглядит такой же плотной, как ближняя, и объём пропадает. Делим на
     размер самой модели: модели приходят в разных единицах (двигатель — сотни,
     олень — единицы), и без этого на мелкой точки слипались в силуэт. */
  gl_PointSize = uSize * uRatio * (uScale / max(0.0001, -view.z));
}`

const FRAG = `
precision mediump float;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uBrightness;
uniform float uOpacity;
varying float vShade;
void main() {
  /* Круглая точка вместо квадрата — маской по gl_PointCoord, без текстуры. */
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = dot(d, d);
  if (r > 0.25) discard;
  float edge = smoothstep(0.25, 0.05, r);
  vec3 col = mix(uColor, uAccent, vShade) * uBrightness;
  gl_FragColor = vec4(col, edge * uOpacity);
  /* Свои цвета three держит в линейном пространстве, а на ShaderMaterial
     перевод в sRGB сам не навешивает — без этой строки облако выходит
     заметно темнее, чем задумано. */
  #include <colorspace_fragment>
}`

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
    this.visible = true
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
      },
    })

    /* Линии рисуются тем же светом, что и точки: аддитивно, без глубины. */
    this.lineMaterial = new LineBasicMaterial({
      color: toRgb(this.o.accent),
      transparent: true,
      depthWrite: false,
      blending: this.o.additive ? AdditiveBlending : NormalBlending,
      opacity: this.o.lineOpacity,
    })
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
    if (this.lineMaterial) this.lineMaterial.color.copy(this.baseAccent).offsetHSL(shift, 0, 0)

    /* Линии разводятся по оттенку симметрично вокруг основного тона: при
       трёх линиях получаются «основной минус», «основной» и «основной плюс».
       Одна линия остаётся ровно в тоне — разводить нечего. */
    /* Цвет линий живёт в вершинах, поэтому при смене палитры перекрашиваем
       уже нарисованное: иначе хвост остался бы в старом тоне. Буфер короткий,
       пересчёт незаметен. */
    const tint = new Color()
    for (const path of this.paths) {
      const walked = path.walked
      for (let i = 0; i < path.count; i++) {
        path.walked = walked - (path.count - i)
        this.lineTint(path, tint)
        const at = i * 3
        path.colors[at] = tint.r
        path.colors[at + 1] = tint.g
        path.colors[at + 2] = tint.b
      }
      path.walked = walked
      if (path.geometry.attributes.color) path.geometry.attributes.color.needsUpdate = true
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
    this.camera.position.set(0, 0, this.radius * 2.8)
    /* Плоскости отсечения считаем от модели, а не фиксируем: модели приходят
       в разных единицах — двигатель радиусом 49, волк 301, и с постоянным
       far = 200 второй целиком уезжал за дальнюю плоскость. */
    /* Опорный масштаб для размера точки: 5 радиусов даёт примерно те же
       точки, что подбирались на модели радиусом 300. */
    this.material.uniforms.uScale.value = this.radius * 5
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
    const position = this.points.geometry.getAttribute('position')
    const shade = this.points.geometry.getAttribute('aShade')
    const point = new Vector3()
    const normal = new Vector3()

    const start = this.refreshCursor % this.written
    const span = Math.min(count, this.written - start)

    for (let i = 0; i < span; i++) {
      const slot = start + i
      this.samplePoint(this.pickPart(), point, normal)
      position.setXYZ(slot, point.x, point.y, point.z)
      shade.setX(slot, Math.min(1, Math.max(0, point.y / (this.radius * 2) + 0.5)))
    }

    position.addUpdateRange(start * 3, span * 3)
    shade.addUpdateRange(start, span)
    position.needsUpdate = true
    shade.needsUpdate = true
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
    /* Запас под самый длинный хвост из лаборатории (3600) плюс место,
       чтобы линия успевала расти между уплотнениями буфера. */
    const maxSegments = 4200

    for (let i = 0; i < wanted; i++) {
      const part = byArea[i % Math.min(byArea.length, 8)]
      const buffer = new Float32Array(maxSegments * 3)
      /* Цвет хранится по вершинам: вдоль линии он плывёт, поэтому одного
         цвета материала мало. Сам материал держим белым — весь тон живёт
         в атрибуте. */
      const colors = new Float32Array(maxSegments * 3)
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(buffer, 3))
      geometry.setAttribute('color', new BufferAttribute(colors, 3))
      geometry.setDrawRange(0, 0)
      /* У каждой линии свой материал: они расходятся по оттенку вокруг
         основного тона, поэтому рядом с фиолетовым идут синий и малиновый.
         Один общий материал такого не позволил бы. */
      const material = this.lineMaterial.clone()
      material.vertexColors = true
      material.color.setRGB(1, 1, 1)
      const line = new Line(geometry, material)
      line.frustumCulled = false
      this.group.add(line)
      this.paths.push({ part, buffer, colors, geometry, line, material, index: i, count: 0, previous: null, walked: 0 })
    }
    this.applyPalette()
  }

  /* Один шаг всех линий. Точку ищем перебором: это дёшево, потому что
     кандидат почти всегда находится за несколько попыток. */
  stepPaths(dt) {
    if (!this.paths.length) return
    const limit = this.o.pathStep * this.radius
    const point = new Vector3()
    const normal = new Vector3()
    const matrix = new Matrix4()
    const tint = new Color()
    /* Частота волны смещения на сегмент: подобрана так, чтобы линия успевала
       нырнуть и вынырнуть за десяток шагов, а не дрожала попиксельно. */
    const WAVE_RATE = 0.11

    for (const path of this.paths) {
      const sampler = this.samplerFor(path.part.mesh)
      matrix.copy(path.part.mesh.matrixWorld)
      /* Копим дробные шаги: скорость задана в сегментах в секунду, и при
         малых значениях линия делает шаг раз в несколько кадров. Прежний
         расчёт «на кадр» не давал опуститься ниже 60 сегментов в секунду. */
      path.accum = (path.accum || 0) + Math.max(0, this.o.pathSpeed) * dt
      const steps = Math.floor(path.accum)

      const capacity = path.buffer.length / 3
      const tail = Math.max(0, Math.round(this.o.lineTail))

      for (let s = 0; s < steps; s++) {
        if (path.count >= capacity) {
          /* Буфер кончился — линия не останавливается, а переносит последние
             точки в начало и пишет дальше. С хвостом сохраняем ровно его
             длину, без хвоста — большую часть линии, чтобы стирание сзади
             было редким и незаметным. Копия случается раз в сотни сегментов
             и на кадр не влияет. */
          const keep = tail > 0
            ? Math.min(tail, capacity - 1)
            : Math.floor(capacity * 0.7)
          path.buffer.copyWithin(0, (path.count - keep) * 3, path.count * 3)
          path.count = keep
        }
        let found = false
        for (let tries = 0; tries < 40 && !found; tries++) {
          sampler.sample(point, normal)
          point.applyMatrix4(matrix).sub(this.center)
          if (!path.previous || point.distanceTo(path.previous) < limit) found = true
        }
        /* Неудачную попытку не засчитываем в накопленные шаги: иначе
           заявленная скорость молча падала бы там, где соседнюю точку найти
           трудно. Ждём следующего кадра и пробуем снова. */
        if (!found) break
        path.accum -= 1

        /* Близость проверяем по точке на поверхности, а смещаем уже при
           записи: иначе линия «убегала» бы сама от себя и рвалась. */
        path.previous = path.previous ? path.previous.copy(point) : point.clone()
        path.walked++

        if (this.o.lineDisplace) {
          normal.transformDirection(matrix)
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
        path.colors[at] = tint.r
        path.colors[at + 1] = tint.g
        path.colors[at + 2] = tint.b
        path.count++
      }
      /* Хвост стираем не удалением данных, а сдвигом окна отрисовки:
         показываем последние `tail` точек, начало линии уходит само. */
      const shown = tail > 0 ? Math.min(tail, path.count) : path.count
      const from = path.count - shown
      path.geometry.setDrawRange(from, shown)

      /* Затухание хвоста. Цвет пересчитываем для всего видимого окна каждый
         кадр, а не гасим уже записанное: иначе множитель накапливался бы и
         линия чернела целиком. Оттенок восстанавливается по номеру шага,
         на котором точка была поставлена. */
      /* Больше единицы — рампа длиннее видимого окна: линия не успевает
         выйти на полную яркость и гаснет мягче по всей длине. */
      const fade = Math.max(0, this.o.lineFade || 0)
      const fadeSpan = Math.max(1, Math.floor(shown * fade))
      for (let i = 0; i < shown; i++) {
        const slot = from + i
        path.walkedAt = path.walked - (path.count - slot)
        this.lineTint(path, tint, path.walkedAt)
        const k = fade > 0 ? Math.min(1, i / fadeSpan) : 1
        const at = slot * 3
        path.colors[at] = tint.r * k
        path.colors[at + 1] = tint.g * k
        path.colors[at + 2] = tint.b * k
      }

      path.geometry.attributes.position.needsUpdate = true
      path.geometry.attributes.color.addUpdateRange(from * 3, shown * 3)
      path.geometry.attributes.color.needsUpdate = true
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

    this.onVisibility = () => (document.hidden ? this.stop() : this.start())
    document.addEventListener('visibilitychange', this.onVisibility)

    if (this.o.pauseOffscreen && window.IntersectionObserver) {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries[0].isIntersecting
        if (this.visible) this.start()
        else this.stop()
      }, { threshold: 0 })
      this.io.observe(this.el)
    }
  }

  set(patch) {
    const next = patch || {}
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
    if (next.paths !== undefined && this.ready) this.buildPaths()
    if (next.lineOpacity !== undefined) {
      /* Материал у каждой линии свой, поэтому прозрачность разносим по всем:
         на светлой теме линии должны уходить в полутон, а не спорить с фоном. */
      this.lineMaterial.opacity = this.o.lineOpacity
      for (const path of this.paths) path.material.opacity = this.o.lineOpacity
    }
    if (next.additive !== undefined) {
      this.lineMaterial.blending = this.o.additive ? AdditiveBlending : NormalBlending
      this.lineMaterial.needsUpdate = true
      /* На светлом фоне аддитив уводит облако в белое, поэтому тема
         переключает режим смешивания вместе с цветом. */
      this.material.blending = this.o.additive ? AdditiveBlending : NormalBlending
      this.material.needsUpdate = true
    }
    if (needsRebuild && this.ready) this.rebuild()
    if (!this.raf) this.draw(performance.now())
    return this
  }

  draw(now) {
    if (this.el.clientWidth !== this.cssW || this.el.clientHeight !== this.cssH) this.resize()

    /* Шаг времени, а не «на кадр»: на 120-герцовом экране прежний расчёт
       проявлял облако вдвое быстрее заявленного, и сброс наступал через
       восемь секунд вместо шестнадцати. */
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) * 0.001))
    this.lastFrame = now

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
    if (this.raf || !this.visible || !this.ready || document.hidden) return
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
    if (this.io) this.io.disconnect()
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    if (this.el.__glukeParticles === this) delete this.el.__glukeParticles
  }

  reattach(el) {
    this.el = el
    el.appendChild(this.canvas)
    el.__glukeParticles = this
    if (this.ro) this.ro.observe(el)
    if (this.io) this.io.observe(el)
    this.resize()
    this.start()
  }

  destroy() {
    this.detach()
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.onPointerDown) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown)
      this.canvas.removeEventListener('pointermove', this.onPointerMove)
      this.canvas.removeEventListener('pointerup', this.onPointerUp)
      this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    }
    if (!this.ro) window.removeEventListener('resize', this.onResize)
    if (this.points) this.points.geometry.dispose()
    for (const path of this.paths) {
      path.geometry.dispose()
      path.material.dispose()
    }
    this.lineMaterial.dispose()
    this.material.dispose()
    this.renderer.dispose()
    this.renderer = null
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
