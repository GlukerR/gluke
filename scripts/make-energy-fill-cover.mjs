/**
 * Обложка кейса `energy-fill`.
 *
 * Обложка лежит под виджетом и видна, пока WebGL не запустился, — значит она
 * должна показывать финальное состояние сцены: знак, полностью налитый
 * фирменным жёлтым, и ореол вокруг него. Снять её скриншотом нельзя (канвас
 * рисуется без preserveDrawingBuffer), поэтому она собирается здесь из того
 * же SVG, что грузит движок.
 *
 *   node scripts/make-energy-fill-cover.mjs [--width=1680] [--height=945]
 *
 * Знак — времянка: когда приедет настоящий логотип, кладём его на место
 * `mark.svg` и перезапускаем скрипт.
 */
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const MARK = 'public/media/projects/energy-fill/mark.svg'
const OUT = 'public/media/projects/energy-fill/energy-fill-cover.jpg'

/* Фон тёмной темы сайта — как на обложках соседних виджетов. */
const BG = { r: 8, g: 7, b: 11, alpha: 1 }

const flags = new Map(
  process.argv.slice(2).filter(a => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=')
    return [k, v]
  }),
)
const W = Number(flags.get('width') ?? 1680)
const H = Number(flags.get('height') ?? 945)

/* Знак занимает примерно ту же долю кадра, что и при `markSize: 0.82` с
   полями 18% в движке: 0.82 × (1 − 0.18 × 2) ≈ 0.54 высоты. */
const MARK_H = Math.round(H * 0.54)

const svg = readFileSync(MARK)
const mark = await sharp(svg, { density: 600 })
  .resize({ height: MARK_H, fit: 'inside' })
  .png()
  .toBuffer()

/* Свет вокруг — тот же силуэт, размытый в три радиуса и наложенный по screen:
   ближний даёт плотную кромку, средний и дальний — зарево, которое уходит
   далеко в стороны, как в финале сцены. */
const near = await sharp(mark).blur(18).png().toBuffer()
const mid = await sharp(mark).blur(72).png().toBuffer()
const far = await sharp(mark).blur(190).png().toBuffer()

const meta = await sharp(mark).metadata()
const left = Math.round((W - meta.width) / 2)
const top = Math.round((H - meta.height) / 2)

await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
  .composite([
    { input: far, left, top, blend: 'screen' },
    { input: far, left, top, blend: 'screen' },
    { input: mid, left, top, blend: 'screen' },
    { input: near, left, top, blend: 'screen' },
    { input: mark, left, top },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(OUT)

const out = await sharp(OUT).metadata()
console.log(`${OUT} — ${out.width}×${out.height}`)
