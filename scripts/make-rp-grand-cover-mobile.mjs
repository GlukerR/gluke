/**
 * Мобильная обложка кейса `rp-grand`.
 *
 * На телефоне карточка узкая: кадр целиком (16:9, машина в левой трети, ряд
 * разделов внизу, монитор справа) сжимается до ~330 px, и в нём не читается ни
 * кузов, ни названия разделов. Поэтому у кейса есть вторая обложка — та же
 * сцена, собранная под телефон: крупный кузов сверху, ряд разделов снизу.
 *
 * Почему это склейка, а не один кроп. В кадре три объекта, разнесённых по
 * углам: кузов (x 360…1440, y 210…790), ряд разделов (x 0…1000, y 800…920) и
 * технический монитор (x 1280…1680, y 795…900). Прямоугольника, который
 * содержит кузов и ряд разделов целиком и при этом не задевает монитор, не
 * существует: монитор стоит ровно под правой частью кузова. Любой одиночный
 * кроп либо режет корму машины, либо оставляет обрубок монитора. Обе полосы
 * взяты из одного кадра и не масштабируются вверх больше чем на 1.14×, поэтому
 * склейка не выглядит вставкой.
 *
 * Исходник — обложка кейса (`rp-grand-cover.jpg`), а не скриншот гаража: она
 * закоммичена, поэтому процедура воспроизводима в любой момент, без файла,
 * которого в репозитории нет. См. `docs/dev-guide.md` §5.
 *
 *   node scripts/make-rp-grand-cover-mobile.mjs [--width=1150] [--quality=86]
 *
 * Окна заданы долями обложки (x, y, ширина, высота) — как в остальных
 * скриптах кропа, чтобы значения читались рядом с измерениями:
 *   кузов — 0.1905, 0.1905, 0.6845, 0.6508  (320, 180, 1150, 615)
 *   ряд   — 0,      0.8413, 0.6012, 0.1376  (0,   795, 1010, 130)
 * Полоса HUD доводится до ширины кузова: ряд разделов на телефоне должен
 * занимать всю карточку, иначе названия снова не читаются.
 */
import sharp from 'sharp'

const args = process.argv.slice(2)
const flags = new Map(
  args.filter(a => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=')
    return [k, v === undefined ? true : Number(v)]
  }),
)

const SRC = 'public/media/projects/rp-grand/rp-grand-cover.jpg'
const OUT = 'public/media/projects/rp-grand/rp-grand-cover-mobile.jpg'
const WIDTH = flags.get('width') ?? 1150
const QUALITY = flags.get('quality') ?? 86

/* Кузов: окно обходит решётку радиатора слева и корму справа с запасом, низ
   обрезан выше ряда разделов (на y 795 начинается панель HUD, её оранжевая
   подчёркнутая вкладка иначе попала бы в полосу кузова). */
const CAR = [0.1905, 0.1905, 0.6845, 0.6508]
/* Ряд разделов: вся панель целиком, до технического монитора справа. */
const HUD = [0, 0.8413, 0.6012, 0.1376]

const source = await sharp(SRC).metadata()
const toRegion = ([x, y, w, h]) => ({
  left: Math.round(x * source.width),
  top: Math.round(y * source.height),
  width: Math.round(w * source.width),
  height: Math.round(h * source.height),
})

const car = toRegion(CAR)
const hud = toRegion(HUD)
const hudHeight = Math.round(hud.height * WIDTH / hud.width)

const carBand = await sharp(SRC).extract(car).resize(WIDTH, null).toBuffer()
const hudBand = await sharp(SRC).extract(hud).resize(WIDTH, hudHeight).toBuffer()

const info = await sharp({
  create: {
    width: WIDTH,
    height: car.height * Math.round(WIDTH / car.width) + hudHeight,
    channels: 3,
    background: '#0b0908',
  },
})
  .composite([
    { input: carBand, top: 0, left: 0 },
    { input: hudBand, top: car.height * Math.round(WIDTH / car.width), left: 0 },
  ])
  .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: '4:2:0' })
  .toFile(OUT)

const kb = Math.round(info.size / 1024)
console.log(`${OUT} — ${info.width}×${info.height}, ${kb} КБ`)
console.log(`  кузов: окно ${car.width}×${car.height} → ${WIDTH}×${car.height * Math.round(WIDTH / car.width)}`)
console.log(`  ряд разделов: окно ${hud.width}×${hud.height} → ${WIDTH}×${hudHeight} (масштаб ${(WIDTH / hud.width).toFixed(2)}×)`)
if (kb > 200) console.warn('Больше 200 КБ — уменьшите --quality.')
