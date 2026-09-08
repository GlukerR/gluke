/**
 * Обложка кейса `image-particles`.
 *
 * Обложка лежит под виджетом и видна, пока WebGL не запустился, — значит она
 * должна показывать ровно то, что соберётся через секунду, иначе блок мигает
 * чужой картинкой. Снять её скриншотом нельзя: канвас рисуется без
 * preserveDrawingBuffer. Поэтому кадр считается здесь по тем же правилам,
 * что и в шейдере (`app/utils/gluke-image-particles.js`): тот же авто-кроп,
 * та же кривая, тот же размер точки от шага сэмплирования.
 *
 *   node scripts/make-particles-cover.mjs [--width=1680] [--height=945]
 *
 * Параметры эффекта берутся из пресета кейса (см. `params` в
 * content/projects/*\/image-particles.md) — правьте их там и перезапускайте.
 */
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const DONOR = 'public/media/projects/image-particles/donor.png'
const OUT = 'public/media/projects/image-particles/image-particles-cover.jpg'

/* Пресет кейса. Держим здесь копию, а не парсим markdown: скрипт запускается
   руками после смены донора или настроек, лишняя зависимость ни к чему. */
const P = {
  dotSize: 1.6,
  scatter: 0.02,
  depth: 0.04,
  colorSat: 0.3,
  contrast: 1.35,
  floor: 0.28,
  shadowFill: 0.08,
  minGrey: 0.03,
  lightness: 1,
}

/* Фон тёмной темы сайта — как на обложках соседних виджетов. */
const BG = [8, 7, 11]
const MARGIN = 0.92
const POINT_PITCH = 1.2
const EMPTY_LEVEL = 8 / 255

const flags = new Map(
  process.argv.slice(2).filter(a => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=')
    return [k, v]
  }),
)
const W = Number(flags.get('width') ?? 1680)
const H = Number(flags.get('height') ?? 945)

function scurve(t, k) {
  return t < 0.5 ? 0.5 * Math.pow(t * 2, k) : 1 - 0.5 * Math.pow((1 - t) * 2, k)
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/* Детерминированный шум вместо hash/vnoise из шейдера: обложка должна быть
   одинаковой при каждом запуске, а глазу разницы нет. */
function rand(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453123
  return x - Math.floor(x)
}

function trimEdge(sums, budget, dir) {
  let i = dir > 0 ? 0 : sums.length - 1
  let acc = 0
  while (i >= 0 && i < sums.length) {
    acc += sums[i]
    if (acc > budget) return i
    i += dir
  }
  return dir > 0 ? 0 : sums.length - 1
}

const { data, info } = await sharp(readFileSync(DONOR)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const dw = info.width, dh = info.height, C = info.channels
const lum = (x, y) => {
  const o = (y * dw + x) * C
  return (data[o] * 0.21 + data[o + 1] * 0.71 + data[o + 2] * 0.07) / 255
}

/* Авто-кроп по массе яркости — копия логики виджета. */
const colSums = new Float64Array(dw)
const rowSums = new Float64Array(dh)
let mass = 0
for (let y = 0; y < dh; y++) {
  for (let x = 0; x < dw; x++) {
    const l = lum(x, y)
    if (l <= EMPTY_LEVEL) continue
    colSums[x] += l
    rowSums[y] += l
    mass += l
  }
}
const edge = mass * 0.004
let minX = trimEdge(colSums, edge, 1)
let maxX = trimEdge(colSums, edge, -1)
let minY = trimEdge(rowSums, edge, 1)
let maxY = trimEdge(rowSums, edge, -1)
const padX = Math.round((maxX - minX + 1) * 0.05)
const padY = Math.round((maxY - minY + 1) * 0.05)
minX = Math.max(0, minX - padX)
minY = Math.max(0, minY - padY)
maxX = Math.min(dw - 1, maxX + padX)
maxY = Math.min(dh - 1, maxY + padY)
const cw = maxX - minX + 1
const ch = maxY - minY + 1

/* Картинка вписывается в кадр по своим пропорциям (contain). */
const aspect = W / H
const imgAspect = cw / ch
const fit = imgAspect > aspect
  ? [MARGIN, MARGIN * aspect / imgAspect]
  : [MARGIN * imgAspect / aspect, MARGIN]

const drawnW = fit[0] * W
const stride = Math.max(1, Math.ceil(cw / Math.max(1, drawnW / POINT_PITCH)))
const pointScale = Math.max(1.2, drawnW / Math.max(1, cw / stride))

const buf = new Float64Array(W * H * 3)
let drawn = 0

for (let y = minY; y <= maxY; y += stride) {
  for (let x = minX; x <= maxX; x += stride) {
    const raw = lum(x, y)
    if (raw < EMPTY_LEVEL) continue

    let grey = scurve(raw, P.contrast)
    grey *= smoothstep(P.floor, P.floor + 0.08, grey)
    const fill = (P.shadowFill + (1 - P.shadowFill) * grey) * smoothstep(0.002, 0.03, grey)
    if (fill <= 0.004) continue

    const o = (y * dw + x) * C
    const k = raw > 0.001 ? grey / raw : 0
    const tone = [
      grey + (data[o] / 255 * k - grey) * P.colorSat,
      grey + (data[o + 1] / 255 * k - grey) * P.colorSat,
      grey + (data[o + 2] / 255 * k - grey) * P.colorSat,
    ]

    const idx = drawn
    const r1 = rand(idx + 1)
    const r2 = rand(idx * 1.713 + 7)
    const rndz = rand(idx * 0.37 + 3)

    /* Позиция в NDC: как в вершинном шейдере, с переворотом Y. */
    let nx = ((x - minX + 0.5) / cw - 0.5) * 2 * fit[0]
    let ny = (1 - (y - minY + 0.5) / ch - 0.5) * 2 * fit[1]
    nx += (r1 - 0.5) * 2 * P.scatter * fit[0]
    ny += (r2 - 0.5) * 2 * P.scatter * fit[1]
    const zz = (rndz - 0.5) * P.depth
    nx *= 1 + zz * 1.4
    ny *= 1 + zz * 1.4

    const px = (nx * 0.5 + 0.5) * W
    const py = (0.5 - ny * 0.5) * H
    const breathe = 0.5 + (rand(idx * 0.91 + 11) - 0.5) * 0.6
    const size = Math.max(1, (breathe + 1.5) * 0.5 * (P.minGrey + fill) * P.dotSize * pointScale)
    drawn++

    /* Мягкий круг: та же маска по gl_PointCoord, аддитивно поверх фона. */
    const r = size * 0.5
    const x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(W - 1, Math.ceil(px + r))
    const y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(H - 1, Math.ceil(py + r))
    for (let sy = y0; sy <= y1; sy++) {
      for (let sx = x0; sx <= x1; sx++) {
        const dx = (sx + 0.5 - px) / size
        const dy = (sy + 0.5 - py) / size
        const dd = Math.sqrt(dx * dx + dy * dy)
        const t = smoothstep(0.5, 0.16, dd)
        if (t <= 0.003) continue
        const a = t * fill
        const b = (sy * W + sx) * 3
        buf[b] += tone[0] * a * P.lightness * 255
        buf[b + 1] += tone[1] * a * P.lightness * 255
        buf[b + 2] += tone[2] * a * P.lightness * 255
      }
    }
  }
}

const out = Buffer.alloc(W * H * 3)
for (let i = 0; i < W * H; i++) {
  out[i * 3] = Math.min(255, Math.round(BG[0] + buf[i * 3]))
  out[i * 3 + 1] = Math.min(255, Math.round(BG[1] + buf[i * 3 + 1]))
  out[i * 3 + 2] = Math.min(255, Math.round(BG[2] + buf[i * 3 + 2]))
}

await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(OUT)

console.log(`${OUT} — ${W}×${H}, точек ${drawn}, шаг ${stride}, размер точки ×${pointScale.toFixed(2)}`)
