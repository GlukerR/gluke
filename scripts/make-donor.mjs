/**
 * Подготовка картинки-донора для виджета `image-particles`.
 *
 * Виджет читает пиксели донора и делает точку из каждого: яркость пикселя
 * задаёт размер и прозрачность точки, чёрный фон точек не даёт вовсе.
 * Поэтому обычная фотография не годится — нужен контраст, вычищенный фон
 * и небольшой размер. Скрипт делает это одним проходом:
 *
 *   node scripts/make-donor.mjs <вход> [выход] [--width=360] [--contrast=1.6]
 *                                            [--floor=0.06] [--gamma=0.9]
 *                                            [--gray] [--invert]
 *                                            [--crop=x,y,w,h]
 *
 * --width     длинная сторона результата (по умолчанию 360)
 * --contrast  сила S-кривой: 1 — не трогать, 2 — жёстко (по умолчанию 1.6)
 * --floor     чёрная точка: всё темнее этой доли исходника уходит в чистый чёрный
 * --gamma     <1 высветляет средние тона, >1 затемняет
 * --gray      обесцветить (виджет всё равно умеет монохром ползунком)
 * --invert    объект тёмный на светлом фоне (портрет по белому) — переворачиваем,
 *             виджету нужен светлый объект на чёрном
 * --crop      кадр в долях исходника, например --crop=0.1,0.14,0.65,0.44:
 *             левый верхний угол и размер. Виджет и сам обрезает пустой фон,
 *             но композицию (взять голову, а не всю фигуру) выбирает человек
 */
import { readFileSync } from 'node:fs'
import { basename, extname, join, dirname } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const flags = new Map(
  args.filter(a => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=')
    return [k, v === undefined ? true : v]
  }),
)
const positional = args.filter(a => !a.startsWith('--'))
const input = positional[0]

if (!input) {
  console.error('Укажите входной файл: node scripts/make-donor.mjs <картинка> [выход]')
  process.exit(1)
}

const width = Number(flags.get('width') ?? 360)
const contrast = Number(flags.get('contrast') ?? 1.6)
const floor = Number(flags.get('floor') ?? 0.06)
const gamma = Number(flags.get('gamma') ?? 0.9)
const gray = Boolean(flags.get('gray'))
const invert = Boolean(flags.get('invert'))
const crop = typeof flags.get('crop') === 'string'
  ? String(flags.get('crop')).split(',').map(Number)
  : null
const output = positional[1]
  ?? join(dirname(input), `${basename(input, extname(input))}-donor.png`)

/* Порядок здесь важен. Сначала чёрная точка: всё темнее `floor` уходит в ноль,
   остальное растягивается на полный диапазон. Только потом S-кривая
   («выкрутить яркие и выкрутить тёмные») и гамма, поднимающая средние тона.
   Если резать порогом в конце, гамма успевает вытянуть шум фона, и вместо
   объекта на чёрном получается серый прямоугольник — так и было. */
function curve(t) {
  const u = floor >= 1 ? 0 : Math.max(0, (t - floor) / (1 - floor))
  const s = u < 0.5
    ? 0.5 * Math.pow(u * 2, contrast)
    : 1 - 0.5 * Math.pow((1 - u) * 2, contrast)
  return Math.pow(s, gamma)
}

let src = sharp(readFileSync(input)).rotate()
let meta = await src.metadata()

if (crop) {
  if (crop.length !== 4 || crop.some(n => !Number.isFinite(n))) {
    console.error('--crop ждёт четыре числа: x,y,w,h в долях от 0 до 1')
    process.exit(1)
  }
  const box = {
    left: Math.round(crop[0] * (meta.width ?? 1)),
    top: Math.round(crop[1] * (meta.height ?? 1)),
    width: Math.round(crop[2] * (meta.width ?? 1)),
    height: Math.round(crop[3] * (meta.height ?? 1)),
  }
  src = sharp(await src.extract(box).png().toBuffer())
  meta = await src.metadata()
}

const long = Math.max(meta.width ?? 1, meta.height ?? 1)
const scale = width / long

let pipe = src
  .resize({
    width: Math.max(1, Math.round((meta.width ?? 1) * scale)),
    height: Math.max(1, Math.round((meta.height ?? 1) * scale)),
    fit: 'fill',
  })
  .normalise()

if (gray) pipe = pipe.greyscale()

/* Прозрачный фон (PNG с альфой) кладём на чёрный: для виджета «нет объекта»
   и «чёрный пиксель» — одно и то же. */
const { data, info } = await pipe
  .flatten({ background: '#000000' })
  .raw()
  .toBuffer({ resolveWithObject: true })

const px = info.width * info.height
let kept = 0
for (let i = 0; i < px; i++) {
  const o = i * info.channels
  const r = data[o], g = data[o + 1], b = data[o + 2]
  const raw = (r * 0.21 + g * 0.71 + b * 0.07) / 255
  const lum = invert ? 1 - raw : raw
  const target = curve(lum)
  /* Чёрную точку кривая уже применила — здесь только отсекаем нули. */
  if (target <= 0.002) {
    data[o] = 0
    data[o + 1] = 0
    data[o + 2] = 0
    continue
  }
  kept++
  /* Тянем канал к целевой яркости, сохраняя оттенок пикселя. */
  const k = raw > 0.001 ? target / raw : 0
  const v = Math.round(target * 255)
  data[o] = invert ? v : Math.min(255, Math.round(r * k))
  data[o + 1] = invert ? v : Math.min(255, Math.round(g * k))
  data[o + 2] = invert ? v : Math.min(255, Math.round(b * k))
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .png({ compressionLevel: 9 })
  .toFile(output)

/* ASCII-превью: видно сразу, читается объект или расплылся в пятно. */
const cols = 64, rows = 26
const acc = Array.from({ length: rows }, () => new Array(cols).fill(0))
const cnt = Array.from({ length: rows }, () => new Array(cols).fill(0))
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const o = (y * info.width + x) * info.channels
    const lum = data[o] * 0.21 + data[o + 1] * 0.71 + data[o + 2] * 0.07
    const ry = Math.floor(y / info.height * rows)
    const rx = Math.floor(x / info.width * cols)
    acc[ry][rx] += lum
    cnt[ry][rx]++
  }
}
const ramp = ' .:-=+*#%@'
console.log(acc.map((row, i) => row.map((v, j) => {
  const t = v / cnt[i][j] / 255
  return ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]
}).join('')).join('\n'))
console.log(`\n${output} — ${info.width}×${info.height}, точек с сигналом ${kept} из ${px} (${(kept / px * 100).toFixed(0)} %)`)
