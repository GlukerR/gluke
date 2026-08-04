/**
 * GLUKE media pipeline.
 *
 * Copies explicitly mapped originals from `_incoming/gluke-assets` into
 * `public/media` byte-for-byte, verifies them and regenerates
 * `docs/media-inventory.md`.
 *
 * The script never deletes, moves or re-encodes anything.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const SOURCE_DIR = path.join(ROOT, '_incoming', 'gluke-assets')
const MEDIA_DIR = path.join(ROOT, 'public', 'media')
const INVENTORY_FILE = path.join(ROOT, 'docs', 'media-inventory.md')

const PREVIEW_MARKER = '-__resize__20x__'
const GENERATED_AT_MARKER = '__GENERATED_AT__'
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.tiff'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm'])

/** @type {{ source: string, target: string, kind: 'brand' | 'image' | 'video' }[]} */
const MEDIA_MAP = [
  { source: 'logo-white.svg', target: 'brand/gluke-logo-white.svg', kind: 'brand' },
  { source: 'tild3963-3334-4463-b135-643063653965__group.svg', target: 'brand/gluke-logo-dark.svg', kind: 'brand' },
  { source: 'tild3135-3537-4534-a539-363130666230__frame_39.svg', target: 'brand/gluke-mark-dark.svg', kind: 'brand' },

  { source: 'tild6365-3664-4537-b462-363663356439__4_2.png', target: 'projects/getic/router-collection-hero.png', kind: 'image' },
  { source: 'tild3135-3366-4964-b536-376131346636__photo.png', target: 'projects/getic/mikrotik-router-neon.png', kind: 'image' },
  { source: 'tild3031-3030-4439-b234-306564663332__untitled-13.png', target: 'projects/getic/hex-poe-router.png', kind: 'image' },
  { source: 'tild3863-3732-4562-a166-373634383366__untitled-2.png', target: 'projects/getic/cloud-router-switch.png', kind: 'image' },
  { source: 'tild3931-6632-4062-a162-376632306134__11.jpg', target: 'projects/getic/network-rack.jpg', kind: 'image' },
  { source: 'tild6339-6538-4031-a235-393634303032__2_1_1.png', target: 'projects/getic/network-cabinet-render.png', kind: 'image' },
  { source: 'tild3266-3334-4039-a364-356133613031__734e6fafbf31faaeaab8.jpg', target: 'projects/getic/store-laptop.jpg', kind: 'image' },
  { source: 'tild6533-6637-4163-b332-646132333764__1.png', target: 'projects/getic/router-underside.png', kind: 'image' },
  { source: 'vide3564-3862-4966-a134-306131353831__3anim_1710_1.mp4', target: 'projects/getic/router-animation-01.mp4', kind: 'video' },
  { source: 'vide6233-3365-4965-b336-623735306531__rb5009ug_s_in_produc.mp4', target: 'projects/getic/rb5009-production.mp4', kind: 'video' },
  { source: 'vide6534-3964-4366-a630-323038346561__1anim_1710.mp4', target: 'projects/getic/router-animation-02.mp4', kind: 'video' },

  { source: 'tild3132-3664-4234-a132-666434616433__cbba2c15f6401683a0f3.jpg', target: 'projects/house-guru/dark-bathroom-scene.jpg', kind: 'image' },
  { source: 'tild3237-3731-4830-b933-383961326662__3.jpg', target: 'projects/house-guru/home-utility-scene.jpg', kind: 'image' },
  { source: 'tild3734-6237-4134-b066-346636636134__untitled.png', target: 'projects/house-guru/mop-cutaway.png', kind: 'image' },
  { source: 'tild6363-6337-4537-a331-306330393332__d72ca3054d423bccd2a0.jpg', target: 'projects/house-guru/laundry-room-scene.jpg', kind: 'image' },
  { source: 'tild6431-3262-4162-b365-646261393336__8.png', target: 'projects/house-guru/mop-head-underside.png', kind: 'image' },

  { source: 'tild3338-3262-4765-a665-666132643638__rectangle_5.png', target: 'projects/kiparis/bedroom-interior.png', kind: 'image' },
  { source: 'tild3761-3764-4238-a661-356235393739__2.jpg', target: 'projects/kiparis/yellow-sofa.jpg', kind: 'image' },
  { source: 'tild3934-3865-4338-b036-363465336631__4.jpg', target: 'projects/kiparis/furniture-hardware.jpg', kind: 'image' },
  { source: 'tild3935-3532-4461-a639-356338353032__299f3d7ce6cd6e9961e9.png', target: 'projects/kiparis/store-laptop.png', kind: 'image' },
  { source: 'tild6566-6463-4866-b332-343635353735__1_light_8.jpg', target: 'projects/kiparis/living-room-interior.jpg', kind: 'image' },
  { source: 'tild6636-6564-4530-b236-376664333738__grand_111_2_3.jpg', target: 'projects/kiparis/beige-sofa.jpg', kind: 'image' },

  { source: 'tild3438-3931-4765-a638-663464306139__bdb22c4f0f1c70677be2.jpg', target: 'projects/wiederkraft/service-garage-light.jpg', kind: 'image' },
  { source: 'tild3731-3863-4463-b733-323961636237__1.png', target: 'projects/wiederkraft/two-post-lift.png', kind: 'image' },
  { source: 'tild3966-6562-4136-b465-343563343431__40e5fab543f4cc6b71e5.jpg', target: 'projects/wiederkraft/service-garage-dark.jpg', kind: 'image' },
  { source: 'tild6532-3239-4666-a562-346635663862__untitled-3.png', target: 'projects/wiederkraft/tire-machine-blueprint.png', kind: 'image' },
  { source: 'tild6537-6539-4734-b665-323937373062__3.png', target: 'projects/wiederkraft/car-lift-overlay.png', kind: 'image' },

  { source: 'tild3031-3166-4538-b932-313537313564__photo_18914-05-2025_.jpg', target: 'projects/architecture/winter-aerial.jpg', kind: 'image' },
  { source: 'tild3230-3263-4966-b430-623962303965__photo_16611-05-2025_.jpg', target: 'projects/architecture/dusk-masterplan.jpg', kind: 'image' },
  { source: 'tild6466-6430-4565-b666-663963653430__photo_16211-05-2025_.jpg', target: 'projects/architecture/building-facade.jpg', kind: 'image' },
  { source: 'tild6466-6666-4263-b031-363231303139__photo_14808-05-2025_.jpg', target: 'projects/architecture/aerial-masterplan.jpg', kind: 'image' },

  { source: 'tild3438-3164-4961-b461-666331663230__noroot.png', target: 'projects/experimental/mechanical-keyboard.png', kind: 'image' },
  { source: 'tild6132-3130-4337-b539-336633663131__5ade1427d7d0bf4c2b30.jpg', target: 'projects/experimental/electronics-catalog.jpg', kind: 'image' },
  { source: 'tild6632-6561-4337-a534-623338376239__2.webp', target: 'projects/experimental/engineering-workstation.webp', kind: 'image' },
]

/** @type {Record<string, string>} */
const EXCLUDED_FILES = {
  'lib__icons__button__arw_upright_bold.svg': 'replaceable UI icon',
  'tild3033-3837-4037-a433-303138656535__group_1.png': 'decorative glow recreated in CSS',
  'tild3064-6239-4063-b032-393061333366__vector.svg': 'replaceable UI icon',
  'tild3263-6538-4535-b737-656464356464__group.svg': 'redundant logo',
  'tild6161-6633-4363-a338-656235663663__group.svg': 'redundant logo',
  'tildacopy.png': 'Tilda artifact',
  'tildacopy_black.png': 'Tilda artifact',
  'tildafavicon.ico': 'Tilda artifact',
}

/**
 * `file(1).png` and `file (1).png` are treated as variants of `file.png`.
 * @param {string} fileName
 */
function normalizeName(fileName) {
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  return `${base.replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase()}${ext.toLowerCase()}`
}

/**
 * Locale-independent comparison so the report never depends on OS collation.
 * @param {string} a
 * @param {string} b
 */
function compareStrings(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Normalized, POSIX-style path relative to the source directory.
 * @param {string} file
 */
function sortKey(file) {
  return path.relative(SOURCE_DIR, file).split(path.sep).join('/')
}

/** @param {string[]} files */
function sortFiles(files) {
  return [...files].sort((a, b) => {
    const keyA = sortKey(a)
    const keyB = sortKey(b)
    return compareStrings(keyA.toLowerCase(), keyB.toLowerCase()) || compareStrings(keyA, keyB)
  })
}

/** @param {string} file */
async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex')
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** @param {Buffer} buffer */
function* iterateBoxes(buffer) {
  let offset = 0
  while (offset + 8 <= buffer.length) {
    let size = buffer.readUInt32BE(offset)
    const type = buffer.toString('latin1', offset + 4, offset + 8)
    let headerSize = 8
    if (size === 1) {
      if (offset + 16 > buffer.length) return
      size = Number(buffer.readBigUInt64BE(offset + 8))
      headerSize = 16
    }
    else if (size === 0) {
      size = buffer.length - offset
    }
    if (size < headerSize || offset + size > buffer.length) return
    yield { type, payload: buffer.subarray(offset + headerSize, offset + size) }
    offset += size
  }
}

/**
 * Recursively finds the first box of the requested type.
 * @param {Buffer} buffer
 * @param {string[]} pathTypes
 */
function findBox(buffer, pathTypes) {
  const [head, ...rest] = pathTypes
  for (const box of iterateBoxes(buffer)) {
    if (box.type !== head) continue
    return rest.length === 0 ? box.payload : findBox(box.payload, rest)
  }
  return null
}

/** @param {Buffer} moov */
function readTrackVisuals(moov) {
  for (const box of iterateBoxes(moov)) {
    if (box.type !== 'trak') continue
    const tkhd = findBox(box.payload, ['tkhd'])
    const stsd = findBox(box.payload, ['mdia', 'minf', 'stbl', 'stsd'])
    if (!tkhd) continue
    const version = tkhd.readUInt8(0)
    const dimensionsOffset = version === 1 ? 88 : 76
    if (tkhd.length < dimensionsOffset + 8) continue
    const width = tkhd.readUInt32BE(dimensionsOffset) / 65536
    const height = tkhd.readUInt32BE(dimensionsOffset + 4) / 65536
    if (width < 1 || height < 1) continue
    const codec = stsd && stsd.length >= 16 ? stsd.toString('latin1', 12, 16) : null
    return { width: Math.round(width), height: Math.round(height), codec }
  }
  return null
}

/**
 * Container-level MP4 inspection with plain Node APIs.
 * Detects the `moov atom not found` class of corruption without FFmpeg.
 * @param {string} file
 */
async function inspectMp4Container(file) {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    const topLevel = []
    let offset = 0
    let moovRange = null
    const header = Buffer.alloc(16)
    while (offset + 8 <= size) {
      const { bytesRead } = await handle.read(header, 0, 16, offset)
      if (bytesRead < 8) break
      let boxSize = header.readUInt32BE(0)
      const type = header.toString('latin1', 4, 8)
      let headerSize = 8
      if (boxSize === 1) {
        if (bytesRead < 16) break
        boxSize = Number(header.readBigUInt64BE(8))
        headerSize = 16
      }
      else if (boxSize === 0) {
        boxSize = size - offset
      }
      if (boxSize < headerSize || offset + boxSize > size) {
        topLevel.push(`${type}(truncated)`)
        break
      }
      topLevel.push(type)
      if (type === 'moov') moovRange = { start: offset + headerSize, length: boxSize - headerSize }
      offset += boxSize
    }

    if (!moovRange) {
      return { ok: false, error: 'moov atom not found', topLevel, hasFtyp: topLevel.includes('ftyp') }
    }

    const moov = Buffer.alloc(moovRange.length)
    await handle.read(moov, 0, moovRange.length, moovRange.start)
    const mvhd = findBox(moov, ['mvhd'])
    let duration = null
    if (mvhd) {
      const version = mvhd.readUInt8(0)
      const timescale = version === 1 ? mvhd.readUInt32BE(20) : mvhd.readUInt32BE(12)
      const rawDuration = version === 1 ? Number(mvhd.readBigUInt64BE(24)) : mvhd.readUInt32BE(16)
      if (timescale > 0) duration = rawDuration / timescale
    }
    const visuals = readTrackVisuals(moov)
    return {
      ok: true,
      topLevel,
      hasFtyp: topLevel.includes('ftyp'),
      duration,
      width: visuals?.width ?? null,
      height: visuals?.height ?? null,
      codec: visuals?.codec ?? null,
    }
  }
  finally {
    await handle.close()
  }
}

async function hasFfprobe() {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', ['-version'])
    child.on('error', () => resolve(false))
    child.on('close', code => resolve(code === 0))
  })
}

/** @param {string} file */
async function runFfprobe(file) {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,avg_frame_rate:format=duration',
      '-of', 'json',
      file,
    ])

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => (stdout += chunk))
    child.stderr.on('data', chunk => (stderr += chunk))
    child.on('error', error => resolve({ ok: false, error: error.message }))
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: stderr.trim() || `ffprobe exited with code ${code}` })
        return
      }
      try {
        const parsed = JSON.parse(stdout)
        const stream = parsed.streams?.[0]
        if (!stream) {
          resolve({ ok: false, error: 'no video stream found' })
          return
        }
        const [num, den] = String(stream.avg_frame_rate ?? '0/0').split('/').map(Number)
        resolve({
          ok: true,
          codec: stream.codec_name ?? null,
          width: stream.width ?? null,
          height: stream.height ?? null,
          fps: den ? Number((num / den).toFixed(3)) : null,
          duration: parsed.format?.duration ? Number(parsed.format.duration) : null,
        })
      }
      catch (error) {
        resolve({ ok: false, error: `unreadable ffprobe output: ${error.message}` })
      }
    })
  })
}

/**
 * @param {string} file
 * @param {'brand' | 'image' | 'video'} kind
 * @param {boolean} ffprobeAvailable
 */
async function probe(file, kind, ffprobeAvailable) {
  const ext = path.extname(file).toLowerCase()
  const { size } = await stat(file)

  if (ext === '.svg') {
    const markup = await readFile(file, 'utf8')
    if (!markup.includes('<svg')) {
      return { readable: false, size, error: 'not a valid SVG document' }
    }
    const viewBox = markup.match(/viewBox\s*=\s*['"]([^'"]+)['"]/i)?.[1]?.trim().split(/[\s,]+/).map(Number)
    const width = Number.parseFloat(markup.match(/\bwidth\s*=\s*['"]([\d.]+)/i)?.[1] ?? '') || viewBox?.[2] || null
    const height = Number.parseFloat(markup.match(/\bheight\s*=\s*['"]([\d.]+)/i)?.[1] ?? '') || viewBox?.[3] || null
    return { readable: true, size, format: 'svg', width, height, alpha: true, verified: true }
  }

  if (RASTER_EXTENSIONS.has(ext)) {
    try {
      const metadata = await sharp(file).metadata()
      return {
        readable: true,
        size,
        format: metadata.format ?? null,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        alpha: Boolean(metadata.hasAlpha),
        verified: true,
      }
    }
    catch (error) {
      return { readable: false, size, error: error.message }
    }
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    const format = ext.slice(1)

    // The built-in box parser understands the ISO BMFF layout of MP4 only.
    let container = null
    if (ext === '.mp4') {
      container = await inspectMp4Container(file)
      if (!container.ok) {
        return { readable: false, size, error: container.error, container }
      }
    }

    if (!ffprobeAvailable) {
      if (!container) {
        return {
          readable: false,
          size,
          error: `ffprobe unavailable and the built-in container parser supports MP4 only, so ${format} cannot be verified`,
        }
      }
      return {
        readable: true,
        size,
        format,
        width: container.width,
        height: container.height,
        alpha: false,
        codec: container.codec,
        duration: container.duration,
        fps: null,
        verified: false,
        note: 'ffprobe unavailable — container-level check only',
      }
    }

    const probed = await runFfprobe(file)
    if (!probed.ok) {
      return { readable: false, size, error: probed.error, container }
    }
    return {
      readable: true,
      size,
      format,
      width: probed.width,
      height: probed.height,
      alpha: false,
      codec: probed.codec,
      duration: probed.duration,
      fps: probed.fps,
      verified: true,
    }
  }

  return { readable: true, size, format: ext.replace('.', '') || null, width: null, height: null, alpha: null, verified: false }
}

/** @param {number | null | undefined} seconds */
function formatDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '—'
  return `${seconds.toFixed(2)} s`
}

async function main() {
  let sourceEntries
  try {
    sourceEntries = await readdir(SOURCE_DIR, { withFileTypes: true, recursive: true })
  }
  catch {
    console.error(`[media] Source directory not found: ${path.relative(ROOT, SOURCE_DIR)}`)
    console.error('[media] Put the original Tilda assets there and run `pnpm media:sync` again.')
    process.exitCode = 1
    return
  }

  const files = sortFiles(
    sourceEntries
      .filter(entry => entry.isFile())
      .map(entry => path.join(entry.parentPath ?? SOURCE_DIR, entry.name)),
  )

  if (files.length === 0) {
    console.error(`[media] Source directory is empty: ${path.relative(ROOT, SOURCE_DIR)}`)
    console.error('[media] Put the original Tilda assets there and run `pnpm media:sync` again.')
    process.exitCode = 1
    return
  }

  /** @type {Map<string, string[]>} */
  const candidatesByName = new Map()
  for (const file of files) {
    const key = normalizeName(path.basename(file))
    const bucket = candidatesByName.get(key)
    if (bucket) bucket.push(file)
    else candidatesByName.set(key, [file])
  }

  for (const [key, bucket] of candidatesByName) {
    candidatesByName.set(key, sortFiles(bucket))
  }

  const previews = sortFiles(files.filter(file => path.basename(file).includes(PREVIEW_MARKER)))
  const ffprobeAvailable = await hasFfprobe()

  const rows = []
  const duplicates = []
  const missing = []
  const corrupted = []

  for (const entry of MEDIA_MAP) {
    const key = normalizeName(entry.source)
    const candidates = sortFiles((candidatesByName.get(key) ?? []).filter(file => !path.basename(file).includes(PREVIEW_MARKER)))

    if (candidates.length === 0) {
      missing.push(entry.source)
      rows.push({ ...entry, status: 'BLOCKED', note: 'source file not found' })
      continue
    }

    const inspected = []
    for (const file of candidates) {
      const info = await probe(file, entry.kind, ffprobeAvailable)
      inspected.push({ file, info, hash: await sha256(file) })
    }

    const readable = inspected.filter(item => item.info.readable)
    const rejected = inspected.filter(item => !item.info.readable)

    if (candidates.length > 1) {
      const uniqueHashes = new Set(inspected.map(item => item.hash))
      duplicates.push({
        normalized: key,
        variants: [...inspected].sort((a, b) => compareStrings(sortKey(a.file), sortKey(b.file))).map(item => ({
          name: path.basename(item.file),
          size: item.info.size,
          hash: item.hash,
          readable: item.info.readable,
          error: item.info.error ?? null,
        })),
        identical: uniqueHashes.size === 1,
      })
    }

    if (readable.length === 0) {
      const reasons = rejected.map(item => `${path.basename(item.file)}: ${item.info.error}`).join('; ')
      corrupted.push(`${entry.source} — ${reasons}`)
      rows.push({ ...entry, status: 'BLOCKED', note: reasons, size: rejected[0]?.info.size ?? null })
      console.warn(`[media] BLOCKED ${entry.target} (${reasons})`)
      continue
    }

    const chosen = readable.reduce((best, item) => (item.info.size > best.info.size ? item : best))
    const decision = candidates.length > 1
      ? `${candidates.length} variants, kept ${path.basename(chosen.file)} (largest readable)`
      : null

    const targetPath = path.join(MEDIA_DIR, entry.target)
    await mkdir(path.dirname(targetPath), { recursive: true })

    let action
    let targetHash
    try {
      targetHash = await sha256(targetPath)
    }
    catch {
      targetHash = null
    }

    if (targetHash === chosen.hash) {
      action = 'unchanged'
    }
    else {
      await copyFile(chosen.file, targetPath)
      targetHash = await sha256(targetPath)
      action = targetHash === chosen.hash ? 'copied' : 'mismatch'
    }

    if (targetHash !== chosen.hash) {
      corrupted.push(`${entry.target} — SHA-256 mismatch after copy`)
      rows.push({ ...entry, status: 'BLOCKED', note: 'SHA-256 mismatch after copy', ...chosen.info })
      console.error(`[media] SHA-256 mismatch for ${entry.target}`)
      continue
    }

    const status = chosen.info.verified ? 'READY' : 'UNVERIFIED'
    rows.push({
      ...entry,
      ...chosen.info,
      sourceName: path.basename(chosen.file),
      hash: chosen.hash,
      status,
      action,
      note: decision ?? chosen.info.note ?? null,
    })
  }

  for (const [file, reason] of Object.entries(EXCLUDED_FILES)) {
    if (candidatesByName.has(normalizeName(file))) {
      rows.push({ source: file, target: '—', kind: 'excluded', status: 'SKIPPED', note: reason })
    }
  }

  const mappedNames = new Set(MEDIA_MAP.map(entry => normalizeName(entry.source)))
  const excludedNames = new Set(Object.keys(EXCLUDED_FILES).map(normalizeName))
  const unmapped = [...candidatesByName.keys()]
    .filter(name => !mappedNames.has(name) && !excludedNames.has(name) && !name.includes(PREVIEW_MARKER))
    .sort(compareStrings)

  const template = renderInventory({
    rows,
    duplicates,
    missing,
    corrupted,
    unmapped,
    previews,
    totalSources: files.length,
    ffprobeAvailable,
  }, GENERATED_AT_MARKER)

  await mkdir(path.dirname(INVENTORY_FILE), { recursive: true })
  const inventoryChanged = await writeInventory(template)

  const counts = countStatuses(rows)
  console.log(`[media] sources: ${files.length}, previews skipped: ${previews.length}`)
  console.log(`[media] READY ${counts.READY} | UNVERIFIED ${counts.UNVERIFIED} | BLOCKED ${counts.BLOCKED} | SKIPPED ${counts.SKIPPED}`)
  console.log(`[media] inventory ${inventoryChanged ? 'updated' : 'unchanged'}: ${path.relative(ROOT, INVENTORY_FILE).split(path.sep).join('/')}`)

  if (!ffprobeAvailable) {
    console.warn('[media] ffprobe was not found — videos are marked UNVERIFIED (container structure checked with Node only).')
  }

  if (missing.length > 0) {
    console.error(`[media] Missing required sources (${missing.length}):`)
    for (const name of missing) console.error(`  - ${name}`)
  }

  if (corrupted.length > 0) {
    console.error(`[media] Corrupted or unverifiable sources (${corrupted.length}):`)
    for (const name of corrupted) console.error(`  - ${name}`)
  }

  if (counts.BLOCKED > 0) {
    console.error(`[media] Blocked targets: ${counts.BLOCKED}`)
  }

  if (missing.length > 0 || corrupted.length > 0 || counts.BLOCKED > 0) {
    process.exitCode = 1
  }
}

/**
 * Writes the report only when its content (ignoring the generation timestamp)
 * actually changed, so repeated runs keep the file byte-identical.
 * @param {string} template
 */
async function writeInventory(template) {
  let existing
  try {
    existing = await readFile(INVENTORY_FILE, 'utf8')
  }
  catch {
    existing = null
  }

  if (existing !== null) {
    const normalized = existing.replace(/^- Generated: .*$/m, `- Generated: ${GENERATED_AT_MARKER}`)
    if (normalized === template) return false
  }

  await writeFile(INVENTORY_FILE, template.replace(GENERATED_AT_MARKER, new Date().toISOString()), 'utf8')
  return true
}

/** @param {{ status: string }[]} rows */
function countStatuses(rows) {
  return rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, { READY: 0, UNVERIFIED: 0, BLOCKED: 0, SKIPPED: 0 })
}

/**
 * @param {Record<string, any>} data
 * @param {string} generatedAt
 */
function renderInventory(data, generatedAt) {
  const { rows, duplicates, missing, corrupted, unmapped, previews, totalSources, ffprobeAvailable } = data
  const copied = rows.filter(row => row.status === 'READY' || row.status === 'UNVERIFIED')
  const images = copied.filter(row => row.kind === 'image')
  const videos = copied.filter(row => row.kind === 'video')
  const brand = copied.filter(row => row.kind === 'brand')
  const counts = countStatuses(rows)

  const lines = []
  lines.push('<!-- Generated by `pnpm media:sync`. Do not edit by hand. -->')
  lines.push('# Media inventory')
  lines.push('')
  lines.push(`- Generated: ${generatedAt}`)
  lines.push(`- Source directory: \`_incoming/gluke-assets\``)
  lines.push(`- Target directory: \`public/media\``)
  lines.push(`- Source files found: ${totalSources}`)
  lines.push(`- Usable images: ${images.length}`)
  lines.push(`- Videos: ${videos.length}`)
  lines.push(`- Brand assets: ${brand.length}`)
  lines.push(`- Tilda 20px previews skipped: ${previews.length}`)
  lines.push(`- Status totals: READY ${counts.READY}, UNVERIFIED ${counts.UNVERIFIED}, BLOCKED ${counts.BLOCKED}, SKIPPED ${counts.SKIPPED}`)
  lines.push(`- Video verification: ${ffprobeAvailable ? 'ffprobe available' : 'ffprobe unavailable — MP4 container checked with Node (`ftyp`/`moov`/`tkhd`/`mvhd`), codec and fps not confirmed'}`)
  lines.push('')

  lines.push('## Copied assets')
  lines.push('')
  lines.push('| Source | Target | Format | W × H | Alpha | Size | SHA-256 | Status |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const row of copied) {
    lines.push([
      '',
      `\`${row.sourceName ?? row.source}\``,
      `\`public/media/${row.target}\``,
      row.format ?? '—',
      row.width && row.height ? `${row.width} × ${row.height}` : '—',
      row.alpha === null || row.alpha === undefined ? '—' : row.alpha ? 'yes' : 'no',
      formatBytes(row.size ?? 0),
      `\`${row.hash}\``,
      row.status,
      '',
    ].join(' | ').trim())
  }
  lines.push('')

  const videoRows = copied.filter(row => row.kind === 'video')
  if (videoRows.length > 0) {
    lines.push('## Video details')
    lines.push('')
    lines.push('| Target | Codec | W × H | FPS | Duration | Status |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const row of videoRows) {
      lines.push([
        '',
        `\`public/media/${row.target}\``,
        row.codec ?? '—',
        row.width && row.height ? `${row.width} × ${row.height}` : '—',
        row.fps ?? '—',
        formatDuration(row.duration),
        row.status,
        '',
      ].join(' | ').trim())
    }
    lines.push('')
  }

  lines.push('## Excluded sources')
  lines.push('')
  lines.push('| Source | Reason |')
  lines.push('| --- | --- |')
  for (const preview of previews) {
    lines.push(`| \`${path.basename(preview)}\` | preview |`)
  }
  for (const row of rows.filter(item => item.status === 'SKIPPED')) {
    lines.push(`| \`${row.source}\` | ${row.note} |`)
  }
  for (const name of unmapped) {
    lines.push(`| \`${name}\` | not in media map |`)
  }
  lines.push('')

  lines.push('## Duplicate candidates')
  lines.push('')
  if (duplicates.length === 0) {
    lines.push('No normalized name resolved to more than one source file — no `(1)` variants were present.')
  }
  else {
    lines.push('| Normalized name | Variants | Identical (SHA-256) | Decision |')
    lines.push('| --- | --- | --- | --- |')
    for (const duplicate of duplicates) {
      const variants = duplicate.variants
        .map(variant => `\`${variant.name}\` (${formatBytes(variant.size)}${variant.readable ? '' : `, unreadable: ${variant.error}`})`)
        .join('<br>')
      const decision = rows.find(row => normalizeName(row.source) === duplicate.normalized)?.note ?? '—'
      lines.push(`| \`${duplicate.normalized}\` | ${variants} | ${duplicate.identical ? 'yes' : 'no'} | ${decision} |`)
    }
  }
  lines.push('')

  lines.push('## Missing and corrupted')
  lines.push('')
  if (missing.length === 0 && corrupted.length === 0) {
    lines.push('No mapped source is missing or structurally unreadable.')
  }
  else {
    for (const name of missing) lines.push(`- Missing: \`${name}\``)
    for (const name of corrupted) lines.push(`- Corrupted: ${name}`)
  }
  lines.push('')

  lines.push('## Next stage')
  lines.push('')
  lines.push('Files in `public/media` are byte-for-byte copies of the originals. AVIF/WebP generation, responsive variants and video re-encoding (H.264/AV1, poster frames) are a separate, later stage of the pipeline and are intentionally not performed here.')
  lines.push('')

  return lines.join('\n')
}

await main()
