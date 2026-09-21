/* Пережимает текстуры внутри GLB: у окружений (гараж) вся масса — это WebP-карты,
 * геометрия же после draco весит десятки килобайт. Скрипт проходит по чанкам,
 * декодирует каждую карту через sharp, пережимает её (и при необходимости
 * уменьшает) и собирает BIN обратно, поправив смещения всех bufferView.
 *
 * Запуск:
 *   node scripts/squeeze-glb-textures.mjs in.glb out.glb [--quality=82] [--max-size=1024]
 *   node scripts/squeeze-glb-textures.mjs in.glb --dry-run [--quality=82] [--max-size=1024]
 *
 * Без --dry-run пишет результат в out.glb (исходник не трогает).
 * Способ деградации картинки — lossy WebP: сначала смотрим замер, потом решаем.
 */
import fs from 'node:fs'
import sharp from 'sharp'
import { CHUNK_BIN, CHUNK_JSON, readGlb } from './glb.mjs'

const DEFAULT_QUALITY = 82
const DEFAULT_MAX_SIZE = 1024

const args = process.argv.slice(2)
const files = args.filter(arg => !arg.startsWith('--'))
const flags = Object.fromEntries(
  args.filter(arg => arg.startsWith('--')).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value ?? true]
  }),
)

const input = files[0]
const output = files[1]
const dryRun = flags['dry-run'] === true || !output
const quality = Number(flags.quality ?? DEFAULT_QUALITY)
const maxSize = Number(flags['max-size'] ?? DEFAULT_MAX_SIZE)

if (!input) {
  console.error('usage: node scripts/squeeze-glb-textures.mjs in.glb [out.glb] [--quality=82] [--max-size=1024] [--dry-run]')
  process.exit(1)
}

/** Разбирает GLB на JSON и BIN (нет BIN — пустой буфер). */
function readGlbParts(file) {
  const { json, bin } = readGlb(file)
  return { json, bin: bin ?? Buffer.alloc(0) }
}

/** Собирает GLB обратно: JSON дополняется пробелами, BIN — нулями до кратности 4. */
function writeGlb(json, bin, file) {
  const pad = (data, fill) => {
    const rest = data.length % 4
    return rest === 0 ? data : Buffer.concat([data, Buffer.alloc(4 - rest, fill)])
  }
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20)
  const binChunk = pad(bin, 0)
  const header = Buffer.alloc(12)
  header.write('glTF', 0, 'ascii')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonChunk.length, 0)
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4)
  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binChunk.length, 0)
  binHeader.writeUInt32LE(CHUNK_BIN, 4)
  fs.writeFileSync(file, Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]))
}

const viewData = view => bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)

const { json, bin } = readGlbParts(input)
const images = json.images ?? []
if (images.length === 0) {
  console.error('в файле нет карт — нечего сжимать')
  process.exit(0)
}

const replaced = new Map()
let bytesBefore = 0
let bytesAfter = 0
const rows = []

for (const [index, image] of images.entries()) {
  if (image.bufferView == null) continue
  const view = json.bufferViews[image.bufferView]
  const data = viewData(view)
  const meta = await sharp(data).metadata()
  const needResize = Math.max(meta.width ?? 0, meta.height ?? 0) > maxSize
  let pipeline = sharp(data)
  if (needResize) pipeline = pipeline.resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
  const encoded = await pipeline.webp({ quality, effort: 6 }).toBuffer()
  /* Пережатие не обязано быть выигрышем: мелкие карты от повторного WebP
     иногда растут, тогда оставляем исходные байты. */
  const next = encoded.length < data.length ? encoded : data
  if (next !== data) replaced.set(image.bufferView, next)
  bytesBefore += data.length
  bytesAfter += next.length
  rows.push({
    name: image.name ?? `image_${index}`,
    px: `${meta.width}×${meta.height}${needResize ? ` → ≤${maxSize}` : ''}`,
    before: data.length,
    after: next.length,
  })
}

const kb = n => `${(n / 1024).toFixed(1)} KB`.padStart(9)
console.log(`файл: ${input}${dryRun ? '  (замер, без записи)' : ''}`)
console.log(`настройки: webp q${quality}, предел размера ${maxSize}\n`)
console.log('image              pixels           было       стало    экономия')
for (const row of rows) {
  const saved = row.before > 0 ? (1 - row.after / row.before) * 100 : 0
  console.log(
    row.name.padEnd(18),
    row.px.padEnd(16),
    kb(row.before),
    kb(row.after),
    row.after < row.before ? `${saved.toFixed(0)}%`.padStart(8) : '        —',
  )
}
console.log(
  `\nкарты: ${(bytesBefore / 1048576).toFixed(2)} MB → ${(bytesAfter / 1048576).toFixed(2)} MB`,
)

if (dryRun) process.exit(0)

/* BIN пересобирается целиком: bufferView идут в исходном порядке, поэтому
   достаточно пересчитать смещения — на них завязаны и доступоры геометрии. */
const parts = []
let offset = 0
for (const [index, view] of json.bufferViews.entries()) {
  const rest = offset % 4
  if (rest !== 0) {
    parts.push(Buffer.alloc(4 - rest))
    offset += 4 - rest
  }
  const data = replaced.get(index) ?? viewData(view)
  view.byteOffset = offset
  view.byteLength = data.length
  parts.push(data)
  offset += data.length
}
const newBin = Buffer.concat(parts)
json.buffers[0].byteLength = newBin.length

writeGlb(json, newBin, output)
const size = fs.statSync(output).size
console.log(`\nзаписано: ${output} — ${(size / 1048576).toFixed(2)} MB`)
