/**
 * Аудит деплоя: настройки Vercel-проекта против репозитория. `pnpm deploy:audit`.
 *
 * Зачем одной командой. Настройки деплоя лежат в четырёх местах, и почти каждое
 * способно разойтись молча: `vercel.json` (какие зоны просим), поле проекта
 * `serverlessFunctionRegion` (что выбрано в дашборде), сроки хранения деплоев и
 * поведение кэша, которое задаёт не код, а платформа. Каждое из этих
 * расхождений уже случалось по отдельности и находилось руками — зона в
 * дашборде (`docs/changes-log.md` §79), правила кэша, проигравшие друг другу
 * (§76). Здесь они сводятся в один прогон, который печатает **только
 * расхождения**: строка «совпало» на каждую настройку превратила бы отчёт в
 * шум, а по шуму перестают искать настоящую поломку.
 *
 * Четыре группы, и у каждой своя сторона сравнения:
 *
 * 1. **Зона функций.** `regions` в `vercel.json` против
 *    `serverlessFunctionRegion` проекта и против зоны, которая реально
 *    исполнила ответ (`x-vercel-id`, второй сегмент). Зона — единственная
 *    настройка, которая живёт и в конфиге, и в дашборде, причём побеждает
 *    конфиг, поэтому проверяются обе стороны.
 * 2. **Сроки хранения деплоев.** Политика проекта (`expirationDays*`) против
 *    `DEFAULT_RETENTION` из `scripts/deployment-retention.mjs` — та же точка
 *    правды, которой пользуется `pnpm retention`.
 * 3. **Кэш.** Наборы директив для страницы, варианта `/_vercel/image` и статики
 *    из `public/**` против `scripts/cache-headers.mjs`. Сравниваются не строки,
 *    а директивы по отдельности (`parseDirectives`): подменённый `s-maxage` —
 *    поломка, а перестановка директив местами — нет.
 * 4. **Пурж вариантов картинки.** Это не настройка проекта, а цепочка в
 *    репозитории: команда, вызов после деплоя и токен в CI. Разорванное звено
 *    ошибки не даёт — пурж просто не выполняется, а заменённая картинка живёт из
 *    кэша до истечения срока. Сам эндпоинт пуржа здесь не вызывается: это
 *    изменяющий запрос, и аудит не должен трогать кэш.
 *
 * Токен. Сторона платформы читается токеном: `VERCEL_TOKEN` из окружения, а
 * если его нет — локальной авторизацией Vercel CLI (`vercel login`). Только
 * чтение (`GET`), никаких изменений. Без токена команда не падает: она
 * печатает, что именно осталось непроверенным, и не выдаёт непроверенное за
 * совпавшее.
 *
 * Использование:
 *
 *   pnpm deploy:audit
 *   CACHE_PROBE_URL=https://gluke.vercel.app pnpm deploy:audit
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { CACHE_MIRROR_HEADER, MEDIA_CACHE, PAGE_CACHE, parseDirectives } from './cache-headers.mjs'
import { CATEGORIES, DEFAULT_RETENTION, policyLabels, retentionDays } from './deployment-retention.mjs'

const API = 'https://api.vercel.com'
const baseUrl = (process.env.CACHE_PROBE_URL ?? 'https://gluke.ru').replace(/\/+$/, '')

/** Сколько ждать ответа домена: он может быть на прогреве сразу после деплоя. */
const REQUEST_TIMEOUT_MS = 25_000

/** Страница кейса: серверный рендер, то есть ответ функции, а не статика. */
const PAGE_PATH = '/ru/projects/softlogic'
/** Файл статики из `public/`: правило `/media/**`. */
const MEDIA_PATH = '/media/projects/alphatent/cover.jpg'
/** Вариант картинки платформенного оптимизатора: отдельное правило кэша. */
const IMAGE_PATH = `/_vercel/image?url=${encodeURIComponent(MEDIA_PATH)}&w=640&q=75`

/**
 * Разница между задуманным набором директив и тем, что отдал ответ.
 *
 * Сравнивается каждая директива по отдельности: проверка строки целиком не
 * заметила бы подмену одной директивы другой — `s-maxage=60` вместо `604800`
 * выглядел бы совпадением, если остальное на месте.
 *
 * @param {string} expected набор директив из политики
 * @param {string} actual набор директив из ответа
 * @param {{ headerName?: string }} [options]
 * @returns {string[]}
 */
export function directiveGaps(expected, actual, { headerName = 'cache-control' } = {}) {
  const want = parseDirectives(expected)
  const got = parseDirectives(actual)
  const gaps = []

  for (const [name, value] of Object.entries(want)) {
    if (got[name] === value) {
      continue
    }

    const shown = got[name] === undefined ? '(директивы нет)' : (got[name] || '(без значения)')
    gaps.push(`${headerName}: ${name} — ожидается ${value || '(без значения)'}, а в ответе ${shown}`)
  }

  for (const [name, value] of Object.entries(got)) {
    if (!(name in want)) {
      gaps.push(`${headerName}: лишняя директива ${name}${value ? `=${value}` : ''}`)
    }
  }

  return gaps
}

/**
 * Расхождения по зоне функций: конфиг против дашборда и против живого ответа.
 *
 * @param {{ declared?: string[], projectSetting?: string, live?: string }} state
 * @returns {string[]}
 */
export function regionGaps({ declared = [], projectSetting, live } = {}) {
  const gaps = []
  const want = declared[0] ?? ''

  if (!want) {
    gaps.push('vercel.json: `regions` не задан — функции уйдут в платформенное умолчание iad1')
  }

  if (declared.length > 1) {
    gaps.push(`vercel.json: зон ${declared.length} (${declared.join(', ')}) — на бесплатном плане доступна одна, лишняя валит деплой`)
  }

  if (projectSetting !== undefined && projectSetting !== want) {
    gaps.push(`проект (Settings → Functions → Function Regions): ${projectSetting || '(пусто)'}, а конфиг просит ${want || '(ничего)'}`)
  }

  if (live !== undefined && live !== want) {
    gaps.push(`живое исполнение: ${live || '(нечитаемо)'}, а конфиг просит ${want || '(ничего)'} — заголовок x-vercel-id`)
  }

  return gaps
}

/**
 * Расхождения по срокам хранения: по строке на категорию, а не одна общая,
 * чтобы было видно, какая именно категория держит место.
 *
 * @param {{ preview: string, production: string, canceled: string, errored: string }} labels
 * @param {Record<string, string>} [expected]
 * @returns {string[]}
 */
export function retentionGaps(labels, expected = DEFAULT_RETENTION) {
  return CATEGORIES
    .filter(category => retentionDays(labels[category.key]) !== retentionDays(expected[category.key]))
    .map(category => `${category.label}: сейчас ${labels[category.key]}, ожидается ${expected[category.key]}`)
}

/**
 * Расхождения по пуржу вариантов картинки: цепочка в репозитории, разрыв
 * которой ошибки не даёт — пурж просто не выполняется.
 *
 * @param {{ script?: string, postdeploy?: string, workflow?: string, scriptFile?: boolean }} wiring
 * @returns {string[]}
 */
export function purgeGaps({ script = '', postdeploy = '', workflow = '', scriptFile = true } = {}) {
  const gaps = []

  if (!script.includes('purge-image-cache.mjs')) {
    gaps.push('package.json: `media:purge` не указывает на scripts/purge-image-cache.mjs — пурж нечем запустить')
  }

  if (!scriptFile) {
    gaps.push('scripts/purge-image-cache.mjs отсутствует, но на него ссылаются команды')
  }

  if (!postdeploy.includes('purge-image-cache.mjs')) {
    gaps.push('scripts/postdeploy.mjs: пурж не вызывается после деплоя — заменённая картинка останется в кэше')
  }

  /* Именно присваивание, а не упоминание: в этом же файле про токен есть
     комментарий, и проверка по подстроке считала бы потерянную переменную
     целой — найдено негативным прогоном аудита. */
  if (!/^\s*VERCEL_TOKEN\s*:/m.test(workflow)) {
    gaps.push('.github/workflows/ci.yml: шаг после деплоя не получает VERCEL_TOKEN — пурж в CI молча пропустится')
  }

  return gaps
}

/**
 * Токен для чтения стороны платформы: окружение, затем локальная авторизация
 * Vercel CLI. Только `GET`, поэтому это тот же доступ, что у `vercel whoami`.
 *
 * @returns {{ token: string, source: string }}
 */
export function platformToken() {
  if (process.env.VERCEL_TOKEN) {
    return { token: process.env.VERCEL_TOKEN, source: 'VERCEL_TOKEN' }
  }

  const candidates = [
    process.env.APPDATA ? join(process.env.APPDATA, 'xdg.data', 'com.vercel.cli', 'auth.json') : '',
    join(homedir(), 'AppData', 'Roaming', 'com.vercel.cli', 'auth.json'),
    join(homedir(), '.local', 'share', 'com.vercel.cli', 'auth.json'),
    join(homedir(), 'Library', 'Application Support', 'com.vercel.cli', 'auth.json'),
  ].filter(Boolean)

  for (const path of candidates) {
    try {
      const token = JSON.parse(readFileSync(path, 'utf8')).token

      if (token) {
        return { token, source: 'авторизация Vercel CLI' }
      }
    }
    catch {
      // Нет файла или он другого формата — не ошибка, просто идём дальше.
    }
  }

  return { token: '', source: '' }
}

/**
 * Зона, которая исполнила ответ: `x-vercel-id` выглядит как
 * `<зона края>::<зона функции>::<номер>`. У ответа без функции (статика,
 * вариант картинки) частей две — `<зона края>::<номер>`, — и брать номер
 * запроса за зону нельзя, поэтому короткий заголовок даёт пустоту.
 *
 * @param {Response} response
 * @returns {string}
 */
export function servedRegion(response) {
  const parts = (response.headers.get('x-vercel-id') ?? '').split('::')

  return parts.length < 3 ? '' : parts[1].trim()
}

/** Привязка проекта: то, что записал `vercel link`, либо переменные окружения. */
function linkedProject() {
  try {
    return JSON.parse(readFileSync(join('.vercel', 'project.json'), 'utf8'))
  }
  catch {
    return {}
  }
}

/** Запрос к API Vercel: одна обёртка, чтобы ошибки читались одинаково. */
async function api(path, token) {
  const response = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`${path} → ${response.status}: ${text.slice(0, 200)}`)
  }

  return text ? JSON.parse(text) : {}
}

/** Ответ домена: нужны заголовки, поэтому тело отпускаем сразу. */
async function probe(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  try {
    await response.body?.cancel()
  }
  catch {
    // Тело уже закрыто или поток недоступен — заголовки от этого не меняются.
  }

  return response
}

/** Заголовок ответа без учёта регистра: имена приходят в разном виде. */
function header(response, name) {
  return response.headers.get(name) ?? ''
}

/**
 * Расхождения по кэшу: наборы директив на четырёх видах ответа. Проверяются и
 * `cache-control`, и зеркало `cdn-cache-control`: в одном набор директив
 * читают браузер и промежуточный кэш, в другом он доезжает до клиента целым, и
 * разойтись они могут независимо (`docs/changes-log.md` §76).
 *
 * @returns {Promise<string[]>}
 */
async function cacheGaps() {
  const gaps = []
  const surfaces = [
    { label: 'страница', path: `${PAGE_PATH}?audit-cache=${Date.now()}`, expected: PAGE_CACHE },
    { label: 'статика /media/**', path: `${MEDIA_PATH}?audit-cache=${Date.now()}`, expected: MEDIA_CACHE },
    { label: 'вариант /_vercel/image', path: IMAGE_PATH, expected: MEDIA_CACHE },
  ]

  for (const surface of surfaces) {
    const response = await probe(surface.path)

    if (response.status !== 200) {
      gaps.push(`${surface.label}: ответ ${response.status} вместо 200 — набор директив проверить нельзя`)
      continue
    }

    for (const headerName of ['cache-control', CACHE_MIRROR_HEADER]) {
      gaps.push(...directiveGaps(surface.expected, header(response, headerName), {
        headerName: `${surface.label} · ${headerName}`,
      }))
    }
  }

  /* Корень персонализирован (язык по cookie и стране), поэтому его набор задаёт
     не политика кэша, а `server/middleware/locale-redirect.ts`. Проверяется то,
     что от него требуется: общий кэш запрещён, и запрет продублирован. */
  const root = await probe('/')

  for (const headerName of ['cache-control', CACHE_MIRROR_HEADER]) {
    const value = header(root, headerName)
    const directives = parseDirectives(value)

    if (directives.private === undefined || directives['no-store'] === undefined) {
      gaps.push(`корень · ${headerName}: ${value || '(нет заголовка)'} — ожидается private, no-store, иначе общий кэш отдаст русскому гостю английскую страницу`)
    }
  }

  return gaps
}

/** Сторона платформы: зона в дашборде и сроки хранения. Только чтение. */
async function platformState() {
  const { token, source } = platformToken()

  if (!token) {
    return { token, source, unchecked: 'сторона платформы (зона в дашборде, сроки хранения): нет токена — ни VERCEL_TOKEN, ни авторизации Vercel CLI' }
  }

  const linked = linkedProject()
  const projectId = process.env.VERCEL_PROJECT_ID ?? linked.projectId ?? ''
  const teamId = process.env.VERCEL_ORG_ID ?? linked.orgId ?? ''
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const name = linked.projectName ?? '(не привязан)'

  if (!projectId) {
    return { token, source, name, unchecked: 'сторона платформы: нет .vercel/project.json — неизвестно, какой проект читать' }
  }

  try {
    const project = await api(`/v9/projects/${encodeURIComponent(projectId)}${query}`, token)
    const retention = project.deploymentExpiration
      ?? (await api(`/v2/projects/${encodeURIComponent(projectId)}${query}`, token)).deploymentExpiration
      ?? null

    return {
      token,
      source,
      name: project.name ?? name,
      projectSetting: project.serverlessFunctionRegion,
      retention,
    }
  }
  catch (error) {
    return { token, source, name, unchecked: `сторона платформы: ${error instanceof Error ? error.message : error}` }
  }
}

async function main() {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
  const platform = await platformState()

  const gaps = []
  const unchecked = []

  if (platform.unchecked) {
    unchecked.push(platform.unchecked)
  }

  let live
  try {
    live = servedRegion(await probe(`${PAGE_PATH}?audit-region=${Date.now()}`))
  }
  catch (error) {
    gaps.push(`живое исполнение: домен не ответил (${error instanceof Error ? error.message : error})`)
  }

  gaps.push(...regionGaps({ declared: config.regions ?? [], projectSetting: platform.projectSetting, live }))

  if (platform.token && !platform.unchecked && platform.projectSetting === undefined) {
    unchecked.push('зона в дашборде: проект отвечает без поля serverlessFunctionRegion')
  }

  if (platform.retention) {
    gaps.push(...retentionGaps(policyLabels(platform.retention)))
  }
  else if (platform.token && !platform.unchecked) {
    unchecked.push('сроки хранения: проект отвечает без поля deploymentExpiration')
  }

  gaps.push(...(await cacheGaps()))
  gaps.push(...purgeGaps({
    script: manifest.scripts?.['media:purge'] ?? '',
    postdeploy: readFileSync('scripts/postdeploy.mjs', 'utf8'),
    workflow: readFileSync('.github/workflows/ci.yml', 'utf8'),
    scriptFile: existsSync('scripts/purge-image-cache.mjs'),
  }))

  const title = `[deploy:audit] ${baseUrl} · проект ${platform.name ?? '(не привязан)'}${platform.token ? ` · токен: ${platform.source}` : ''}`

  console.log(title)

  for (const line of unchecked) {
    console.log(`  ! ${line}`)
  }

  if (!gaps.length) {
    console.log(unchecked.length
      ? '\nрасхождений нет: проверено то, что доступно этому окружению'
      : '\nрасхождений нет: зона, сроки хранения, кэш и пурж совпадают с репозиторием')

    return
  }

  console.log(`\nрасхождений: ${gaps.length}`)
  for (const gap of gaps) {
    console.log(`  ✗ ${gap}`)
  }

  process.exitCode = 1
}

/* Прямой запуск: при импорте (тесты) модуль отдаёт только чистые функции и не
   ходит ни в API, ни на домен. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  }
  catch (error) {
    console.error(`[deploy:audit] ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  }
}
