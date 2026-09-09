/**
 * Обложка кейса `metaballs`.
 *
 * Обложка лежит под виджетом и видна, пока WebGL не запустился, — значит она
 * должна показывать ровно то, что соберётся через секунду. Снять её
 * скриншотом нельзя: канвас рисуется без preserveDrawingBuffer. Поэтому кадр
 * считается здесь по тем же формулам, что и во фрагментном шейдере
 * (`app/utils/gluke-metaballs.js`): то же поле метаболлов, тот же порог, та же
 * нормаль от высоты купола и та же светотень.
 *
 *   node scripts/make-metaballs-cover.mjs [--width=1680] [--height=945] [--seed=7]
 *
 * Параметры эффекта берутся из пресета кейса (см. `params` в
 * content/projects/*\/metaballs.md) — правьте их там и перезапускайте.
 */
import sharp from 'sharp'

const OUT = 'public/media/projects/metaballs/metaballs-cover.jpg'

/* Пресет кейса. Держим копию здесь, а не парсим markdown: скрипт запускается
   руками после смены настроек, лишняя зависимость ни к чему. */
const P = {
  count: 6,
  blobSize: 0.11,
  threshold: 0.5,
  turbulence: 0.5,
  hue: 0.03,
  saturation: 1,
  glow: 1.1,
  gloss: 0.55,
  relief: 2,
}

/* Светлота тёмной темы — из METABALLS_THEME_LOOK. */
const LIGHTNESS = 0.62
/* Фон тёмной темы сайта, как на обложках соседних виджетов. */
const BG = [8, 7, 11]

const flags = new Map(
  process.argv.slice(2).filter(a => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=')
    return [k, v]
  }),
)
const W = Number(flags.get('width') ?? 1680)
const H = Number(flags.get('height') ?? 945)
const SEED = Number(flags.get('seed') ?? 7)

/* Детерминированный генератор: обложка должна получаться одинаковой при
   каждом запуске, иначе её нельзя перевыпустить один в один. */
function makeRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const aspect = W / H
const random = makeRandom(SEED)

/* Раскладка капель — тот же принцип, что в _seed виджета: случайные точки
   по всему полю. Кадр выбираем зерном, а не временем. */
const blobs = Array.from({ length: P.count }, () => ({
  x: random() * aspect,
  y: random(),
}))

function hash(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123
  return s - Math.floor(s)
}

function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy)
  const b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1)
  const d = hash(ix + 1, iy + 1)
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
}

function hsv2rgb(h, s, v) {
  const f = (n) => {
    const k = ((n / 3 + h) % 1 + 1) % 1
    return Math.abs(k * 6 - 3)
  }
  return [0, 2, 1].map((n) => {
    const p = Math.min(Math.max(f(n) - 1, 0), 1)
    return v * (1 + (p - 1) * s)
  })
}

const falloff = Math.log(2) / Math.max(1e-4, P.blobSize * P.blobSize)
const pitch = 1 / Math.sqrt(Math.max(falloff, 1))
const base = hsv2rgb(P.hue, P.saturation, LIGHTNESS)
const lightDir = normalize([-0.35, 0.55, 0.76])
const fillDir = normalize([0.5, -0.45, 0.5])
const halfDir = normalize([lightDir[0], lightDir[1], lightDir[2] + 1])

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

function smoothstep(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)
  return t * t * (3 - 2 * t)
}

const out = Buffer.alloc(W * H * 3)

for (let py = 0; py < H; py++) {
  for (let px = 0; px < W; px++) {
    /* gl_FragCoord считает снизу вверх — у картинки строки идут сверху. */
    const u = (px + 0.5) / W
    const v = 1 - (py + 0.5) / H

    let x = u * aspect
    let y = v
    const turb = noise(x * 2.5, y * 2.5)
    x += (turb - 0.5) * P.turbulence * 0.14
    y += (turb - 0.5) * P.turbulence * 0.14

    let fieldSum = 0
    let gx = 0
    let gy = 0
    for (const blob of blobs) {
      /* Расстояние до ближайшей копии: поле периодично, как в шейдере. */
      let dx = x - blob.x
      let dy = y - blob.y
      dx -= aspect * Math.floor(dx / aspect + 0.5)
      dy -= Math.floor(dy + 0.5)
      const w = Math.exp(-(dx * dx + dy * dy) * falloff)
      fieldSum += w
      gx += w * (-2 * falloff) * dx
      gy += w * (-2 * falloff) * dy
    }

    const lava = smoothstep(P.threshold - 0.09, P.threshold + 0.09, fieldSum)
    const at = (py * W + px) * 3
    if (lava <= 0.002) {
      out[at] = BG[0]
      out[at + 1] = BG[1]
      out[at + 2] = BG[2]
      continue
    }

    const dome = Math.max(fieldSum - P.threshold, 0)
    const h = Math.sqrt(dome)
    const denom = Math.max(2 * h, 0.03)
    const nx = -(gx * pitch / denom) * P.relief
    const ny = -(gy * pitch / denom) * P.relief
    const n = normalize([nx, ny, 1])

    const diffuse = Math.max(n[0] * lightDir[0] + n[1] * lightDir[1] + n[2] * lightDir[2], 0)
    const fill = Math.max(n[0] * fillDir[0] + n[1] * fillDir[1] + n[2] * fillDir[2], 0)
    const specDot = Math.max(n[0] * halfDir[0] + n[1] * halfDir[1] + n[2] * halfDir[2], 0)
    const spec = Math.pow(specDot, 90) * P.gloss
    const fresnel = Math.pow(1 - Math.min(Math.max(n[2], 0), 1), 3)

    for (let c = 0; c < 3; c++) {
      let value = base[c] * (0.14 + 0.80 * diffuse + 0.28 * fill)
      value += base[c] * fresnel * P.glow * 0.55
      value += spec
      /* Канвас лежит на фоне темы: сводим premultiplied-цвет на тот же фон. */
      const composed = value * lava * 255 + BG[c] * (1 - lava)
      out[at + c] = Math.min(255, Math.max(0, Math.round(composed)))
    }
  }
}

await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(OUT)

console.log(`${OUT} — ${W}×${H}, капель ${P.count}, зерно ${SEED}`)
