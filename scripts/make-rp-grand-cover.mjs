/**
 * Обложка кейса `rp-grand`.
 *
 * Обложка кейса — не постановочный рендер, а сам гараж: тот же кадр, что видит
 * гость в шапке кейса, только приведённый к формату карточки (16:9, 1680×945,
 * JPEG ≤200 КБ — см. `docs/dev-guide.md`, §5). Так карточка на главной и
 * постер вьювера показывают ровно то, что соберётся через секунду.
 *
 * Исходник — скриншот живого гаража (в репозитории не хранится: это кадр
 * состояния, а не ассет). Снимаем вьюпорт без браузерного хрома и передаём
 * путём:
 *
 *   node scripts/make-rp-grand-cover.mjs <скриншот.png> [--crop=x,y,w,h]
 *                                        [--width=1680] [--height=945]
 *                                        [--quality=86] [--sharpen=0.6]
 *
 * --crop  окно кадра в долях исходника (x, y, ширина, высота) — как в
 *         `make-donor.mjs`. Значения по умолчанию подобраны под кадр
 *         1904×831: окно обходит HUD, а не режет его. Полный кадр в 16:9 не
 *         влезает (исходник шире 16:9), поэтому выбор — что срезать: слева
 *         лежат панели VEHICLES и плеера (в них машина не влезает целиком,
 *         а половина панели читается как брак вёрстки), сверху — строка
 *         контекста GARAGE / VEHICLES / COUPE GT. Окно по умолчанию оставляет
 *         машину с запасом, ряд разделов внизу и технический монитор справа —
 *         все элементы HUD целиком, ни одного обрезанного по краю. Композицию
 *         выбирает человек, поэтому окно и вынесено в аргумент, а не считается
 *         из содержимого.
 */
import sharp from 'sharp'

const args = process.argv.slice(2)
const flags = new Map(
  args.filter(a => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=')
    return [k, v === undefined ? true : Number(v)]
  }),
)
const input = args.find(a => !a.startsWith('--'))

if (!input) {
  console.error('Укажите скриншот: node scripts/make-rp-grand-cover.mjs <скриншот.png>')
  process.exit(1)
}

const OUT = 'public/media/projects/rp-grand/rp-grand-cover.jpg'
/* Формат карточки: 16:9 из гайда. Переопределяется флагами, если конвенция
   поменяется. */
const W = flags.get('width') ?? 1680
const H = flags.get('height') ?? 945
const QUALITY = flags.get('quality') ?? 86
/* Кадр снят в масштабе 1:1, а карточке нужен кадр крупнее — при растяжении
   кромки HUD-текста мылятся, поэтому после ресайза слегка возвращаем контур. */
const SHARPEN = flags.get('sharpen') ?? 0.6
/* Доли окна под кадр 1904×831: 547,92 → 1861,831 — машина, ряд разделов
   и монитор целиком, левые панели и строка контекста за кадром. */
const crop = String(flags.get('crop') ?? '0.2873,0.1107,0.6901,0.8893').split(',').map(Number)

const source = await sharp(input).metadata()
const region = {
  left: Math.round(crop[0] * source.width),
  top: Math.round(crop[1] * source.height),
  width: Math.round(crop[2] * source.width),
  height: Math.round(crop[3] * source.height),
}
/* Окно могло выйти за край исходника (округляли) — подвинуть, а не падать. */
region.left = Math.max(0, Math.min(region.left, source.width - region.width))
region.top = Math.max(0, Math.min(region.top, source.height - region.height))

let image = sharp(input).extract(region).resize(W, H, { fit: 'cover', position: 'center' })
if (SHARPEN > 0) image = image.sharpen({ sigma: SHARPEN })

const info = await image.jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: '4:2:0' }).toFile(OUT)
const kb = Math.round(info.size / 1024)
console.log(`${OUT} — ${info.width}×${info.height}, ${kb} КБ (окно ${region.width}×${region.height} из ${source.width}×${source.height})`)
if (kb > 200) console.warn('Больше 200 КБ — уменьшите --quality.')
