/**
 * Пурж вариантов картинки: заменённый файл виден сразу, а не через неделю.
 *
 * Зачем. Версии картинок в адресах устроены по-разному на каждой стороне:
 * локально и в превью картинки идут через `/_ipx/**`, и версия едет
 * модификатором адреса (`app/utils/imageVersion.ts`); на Vercel варианты
 * собирает платформенный оптимизатор `/_vercel/image`, и туда версия не
 * доезжает — Vercel выкидывает query из ключа кэша, а варианты локальных
 * картинок ключует по отпечатку содержимого исходника. Передеплой после замены
 * файла обычно и так даёт новый вариант, но копия, уже лежащая в кэше браузера
 * и на краю, живёт до истечения срока (`scripts/cache-headers.mjs`,
 * набор `MEDIA_CACHE`). Пурж закрывает именно это окно: он помечает исходник
 * устаревшим, и все его варианты пересобираются на следующем запросе.
 *
 * Что вызывает. `POST /v1/edge-cache/invalidate-by-src-images` — пурж по
 * исходной картинке, доступен на всех планах. Это мягкая форма (invalidate):
 * первый запрос отдаёт старую копию и обновляет её в фоне, то есть посетитель
 * не ждёт пересборки. Жёсткая форма (`dangerously-delete-by-src-images`) не
 * используется намеренно: она заставляет всех ждать origin и на всплеске
 * запросов бьёт по нему сразу.
 *
 * Токен. Нужен `VERCEL_TOKEN`. Без него команда печатает готовый `curl` и путь
 * в дашборде (Project → CDN → Caches → Source Image) и завершается успешно:
 * выкатка не должна падать из-за отсутствия токена в окружении.
 *
 * Использование:
 *
 *   pnpm media:purge /media/projects/rp-grand/rp-grand-cover.jpg
 *   pnpm media:purge --changed                 # картинки, изменённые в коммите
 *   pnpm media:purge --changed --dry-run
 *   pnpm media:purge /media/... --project gluke
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const API = 'https://api.vercel.com'

/** Расширения, которые оптимизатор действительно обрабатывает. */
const IMAGE_PATTERN = /\.(?:jpe?g|png|webp|avif)$/i

/**
 * Сколько исходников за один запрос. Ограничение Vercel на массовый пурж
 * (16 меток в вызове) взято с запасом: дробим сами, чтобы не упираться в 400.
 */
const BATCH_SIZE = 16

/**
 * Пути картинок в виде `/media/...`: что бы ни передали — путь из репозитория,
 * абсолютный URL или `public/media/...` — на выходе путь, по которому картинку
 * видит сайт.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export function mediaPaths(paths) {
  const result = []

  for (const raw of paths) {
    let path = raw.trim()

    if (!path || !IMAGE_PATTERN.test(path)) {
      continue
    }

    path = path.replace(/^[a-z]+:\/\/[^/]+/i, '')
    path = path.replace(/^public\//, '')

    /* Адрес сайта ищем как хвост от `/media/`. Это не только удобство: в Git
       Bash на Windows аргумент `/media/…` подменяется на путь MSYS
       (`C:/Program Files/Git/media/…`), и без такого поиска команда получила бы
       не тот путь и молча ничего не помечала. */
    const mediaIndex = path.indexOf('/media/')

    if (mediaIndex > 0) {
      path = path.slice(mediaIndex)
    }
    else if (path.startsWith('media/')) {
      path = `/${path}`
    }

    if (!path.startsWith('/')) {
      path = `/${path}`
    }

    if (!path.startsWith('/media/')) {
      continue
    }

    if (!result.includes(path)) {
      result.push(path)
    }
  }

  return result
}

/**
 * Адреса исходников для API: пурж по исходной картинке подразумевает её адрес
 * на сайте (в дашборде это то же поле — «Source Image»).
 *
 * @param {string[]} paths
 * @param {string} baseUrl
 * @returns {string[]}
 */
export function sourceImageUrls(paths, baseUrl) {
  const base = baseUrl.replace(/\/+$/, '')

  return paths.map(path => `${base}${path}`)
}

/**
 * Разбивка на порции: длинный список нельзя отправить одним вызовом.
 *
 * @param {string[]} list
 * @param {number} [size]
 * @returns {string[][]}
 */
export function batchSourceImages(list, size = BATCH_SIZE) {
  const batches = []

  for (let index = 0; index < list.length; index += size) {
    batches.push(list.slice(index, index + size))
  }

  return batches
}

/** Разбор аргументов: пути и режимы. */
export function parseArgs(argv) {
  const options = { paths: [], changed: false, since: '', dryRun: false, baseUrl: '', project: '', verify: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--changed') {
      options.changed = true
    }
    else if (arg === '--since') {
      options.since = argv[index + 1] ?? ''
      index += 1
    }
    else if (arg === '--dry-run') {
      options.dryRun = true
    }
    else if (arg === '--verify') {
      options.verify = true
    }
    else if (arg === '--base-url') {
      options.baseUrl = argv[index + 1] ?? ''
      index += 1
    }
    else if (arg === '--project') {
      options.project = argv[index + 1] ?? ''
      index += 1
    }
    else if (arg.startsWith('--')) {
      throw new Error(`неизвестный аргумент «${arg}»`)
    }
    else {
      options.paths.push(arg)
    }
  }

  return options
}

/** Учётные данные: токен, проект и команда. */
function credentials() {
  let linked = {}

  try {
    linked = JSON.parse(readFileSync(resolve('.vercel', 'project.json'), 'utf8'))
  }
  catch {
    // Проект не привязан локально: тогда ждём --project.
  }

  return {
    token: process.env.VERCEL_TOKEN ?? '',
    teamId: process.env.VERCEL_ORG_ID ?? linked.orgId ?? '',
    project: process.env.VERCEL_PROJECT_ID ?? linked.projectId ?? '',
    projectName: linked.projectName ?? '',
  }
}

/** Картинки, изменённые между коммитами: только `public/media/**`. */
function changedImagePaths(since) {
  const run = args => spawnSync('git', args, { encoding: 'utf8' })
  const diff = ['diff', '--name-only', '--no-renames', since, 'HEAD', '--', 'public/media']

  let result = run(diff)

  if (result.status !== 0) {
    /* Мелкий клон Vercel может не знать коммита предыдущего деплоя: пробуем
       догрузить его и повторяем один раз. */
    run(['fetch', '--depth=50', 'origin', since])
    result = run(diff)
  }

  if (result.status !== 0) {
    throw new Error(`git diff с ${since} не удался: ${(result.stderr || '').trim().split('\n')[0] || 'ошибка'}`)
  }

  return result.stdout.split('\n').map(line => line.trim()).filter(Boolean)
}

/** Что сделать руками, если токена нет. */
function printManualSteps(urls) {
  console.log(`
[media:purge] VERCEL_TOKEN не задан — показываю шаги вместо запроса.

  Токен: Account Settings → Tokens → Create, затем в .env.local (файл в git не идёт):
    VERCEL_TOKEN=...

  Пурж из дашборда: Project → CDN → Caches → Purge cache → Source Image,
  вписать адрес исходника (например ${urls[0] ?? '<адрес картинки>'}).

  Или curl:
    curl -X POST "https://api.vercel.com/v1/edge-cache/invalidate-by-src-images?projectIdOrName=<проект>" \\
      -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \\
      -d '${JSON.stringify({ srcImages: urls })}'

  Пурж ничего не удаляет: первый запрос отдаёт прежнюю копию и обновляет её в фоне.
`)
}

/** Показ состояния края для одного варианта — доказательство, что пурж сделан. */
async function verify(baseUrl, path) {
  const probe = `${baseUrl}/_vercel/image?url=${encodeURIComponent(path)}&w=640&q=100`

  try {
    const response = await fetch(probe, { signal: AbortSignal.timeout(20_000) })
    const state = response.headers.get('x-vercel-cache') ?? '(нет)'
    const age = response.headers.get('age') ?? '(нет)'

    console.log(`  проверка ${path}: статус ${response.status}, x-vercel-cache: ${state}, age: ${age}`)
  }
  catch (error) {
    console.log(`  проверка ${path} не удалась: ${error instanceof Error ? error.message : error}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const auth = credentials()
  const baseUrl = options.baseUrl || process.env.NUXT_SITE_URL || 'https://gluke.ru'

  const raw = options.changed
    ? changedImagePaths(options.since || process.env.VERCEL_GIT_PREVIOUS_SHA || 'HEAD^')
    : options.paths

  const paths = mediaPaths(raw)

  if (!paths.length) {
    console.log('[media:purge] картинок для пуржа нет')
    return
  }

  const urls = sourceImageUrls(paths, baseUrl)

  console.log(`[media:purge] картинок: ${paths.length}`)
  for (const path of paths) {
    console.log(`  ${path}`)
  }

  if (!auth.token) {
    printManualSteps(urls)
    return
  }

  const project = options.project || auth.projectName || auth.project

  if (!project) {
    throw new Error('не знаю проект: передайте --project <имя|id> или привяжите каталог через vercel link')
  }

  if (options.dryRun) {
    console.log('[media:purge] --dry-run: запрос не отправлен')
    return
  }

  const query = new URLSearchParams({ projectIdOrName: project })
  if (auth.teamId) {
    query.set('teamId', auth.teamId)
  }

  for (const batch of batchSourceImages(urls)) {
    const response = await fetch(`${API}/v1/edge-cache/invalidate-by-src-images?${query}`, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${auth.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ srcImages: batch }),
    })

    if (!response.ok) {
      throw new Error(`пурж вернул ${response.status}: ${(await response.text()).slice(0, 300)}`)
    }

    console.log(`  помечено устаревшими: ${batch.length}`)
  }

  console.log(`[media:purge] готово, проект ${project}`)

  if (options.verify) {
    await verify(baseUrl, paths[0])
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  }
  catch (error) {
    console.error(`[media:purge] ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  }
}
