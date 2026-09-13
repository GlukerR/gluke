#!/usr/bin/env node
/*
 * Сжатие музыкальных треков кейсов через ffmpeg.
 *
 * Треки приходят из библиотек готовыми (256 кбит/с, 4 МБ на две с половиной
 * минуты) — как фон зала это перебор: в кадре музыка тише рендера, а канал
 * она занимает целиком. Перекодирование в 96 кбит/с теряет в весе две трети
 * (4,27 МБ → 1,60 МБ), и разница на слух в фоне не читается.
 *
 *   node scripts/squeeze-audio.mjs in.mp3 out.mp3 --bitrate=96 [--mono]
 *
 * `--mono` — для эмбиента и коротких петель, где стерео не слышно вовсе.
 * Путь к ffmpeg можно переопределить переменной окружения FFMPEG.
 */
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs, promisify } from 'node:util'

const run = promisify(execFile)

const { values, positionals } = parseArgs({
  options: {
    bitrate: { type: 'string', default: '96' },
    mono: { type: 'boolean', default: false },
  },
  allowPositionals: true,
})

const [input, output] = positionals
if (!input || !output) {
  console.error('использование: node scripts/squeeze-audio.mjs in.mp3 out.mp3 [--bitrate=96] [--mono]')
  process.exit(2)
}

const bitrate = String(Math.max(32, Number(values.bitrate) || 96))

await mkdir(path.dirname(output), { recursive: true })

await run(process.env.FFMPEG ?? 'ffmpeg', [
  '-v', 'error',
  '-y',
  '-i', input,
  '-codec:a', 'libmp3lame',
  '-b:a', `${bitrate}k`,
  /* `-ac 1` заодно убирает и стерео-картинку: для эмбиента её слышно не больше,
     чем шум компрессии, а вес падает вдвое. */
  ...(values.mono ? ['-ac', '1'] : []),
  output,
])

const { stdout } = await run('node', ['-e', `
  const fs = require('fs')
  const size = fs.statSync(${JSON.stringify(output)}).size
  console.log((size / 1024 / 1024).toFixed(2) + ' МБ')
`])
console.log(`${output} — ${stdout.trim()} (${bitrate} кбит/с${values.mono ? ', моно' : ''})`)
