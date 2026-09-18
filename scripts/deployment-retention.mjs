/**
 * Политика хранения деплоев: показать текущие сроки и поставить нужные.
 *
 * Зачем. Хранилище деплоев (Deployment Storage) — это облачное хранилище
 * вывода сборки каждого сохранённого деплоя, а не вес проекта на диске: наш
 * вывод `public/` — около 300 МБ на деплой плюс бандл функции. На Hobby по
 * умолчанию все категории деплоев хранятся 30 дней, а деплой создаётся на
 * каждый пуш и сразу в двух проектах, поэтому бесплатные 10 ГБ переполняются
 * (см. `docs/run.md`, «Хранилище деплоев»). Сроки хранения — единственная
 * ручка, которая уменьшает занятое место без правки приложения, и она должна
 * быть командой, а не настройкой в дашборде, о которой никто не помнит.
 *
 * API. Сроки пишутся в `PATCH /v9/projects/{idOrName}/deployment-expiration`
 * метками `1d`, `1w`, `1m`, `2m`, `3m`, `6m`, `1y`, `unlimited` — те же метки
 * предлагает дашборд (Project → Settings → Security → Deployment Retention
 * Policy). Форму запроса подсказывает провайдер Terraform: он ходит ровно этими
 * двумя маршрутами.
 *
 * Асимметрия, на которой легко ошибиться. Запрос и ответ называют одни и те же
 * сроки по-разному: **отправляются метки** (`expiration`, `expirationProduction`,
 * `expirationCanceled`, `expirationErrored`), а **проект отвечает днями** в полях
 * `expirationDays`, `expirationDaysProduction`, `expirationDaysCanceled`,
 * `expirationDaysErrored` плюс `deploymentsToKeep`. Поля запроса при чтении
 * выглядят «пустыми» даже когда политика задана явно, поэтому читаются оба
 * набора, а метка принимается и строкой: ответ `PATCH` уже отдаёт метки. Проверено
 * на живом API: тот же объект в ответе на `PATCH` приходит как `expiration: '1w'`,
 * а в `GET /v2/projects/{id}` — как `expirationDaysProduction: 7`.
 *
 * Не все проекты доступны токену. Проект на другом аккаунте не появится ни в
 * списке команды, ни в применении: его политику ставит владелец того аккаунта.
 *
 * Токен. Нужен `VERCEL_TOKEN` (Account Settings → Tokens). Команда намеренно
 * устроена так, что без токена ничего не падает: она печатает шаги для
 * дашборда и завершается успешно. Так её можно звать в любом окружении и
 * получать от неё либо действие, либо инструкцию — но не падение сборки.
 *
 * Использование:
 *
 *   pnpm retention                                # текущие политики проектов команды
 *   pnpm retention --apply                        # прод 1w, превью/отменённые/упавшие 1d
 *   pnpm retention --apply --project gluke
 *   pnpm retention --apply --production 1m --preview 1w
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const API = 'https://api.vercel.com'

/** Сколько дней соответствует метке срока: значение из ответа Vercel приходит днями. */
const RETENTION_DAYS = {
  '1d': 1,
  '1w': 7,
  '1m': 30,
  '2m': 60,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  'unlimited': 36500,
}

/** Метки в порядке возрастания срока: ими же проверяются аргументы команды. */
export const RETENTION_LABELS = Object.keys(RETENTION_DAYS)

/**
 * Политика по умолчанию: неделя продовой истории и сутки на всё остальное.
 *
 * Неделя — компромисс: этого хватает на откат после неудачного релиза, а
 * каждая лишняя неделя хранения умножает место на число деплоев за эту неделю.
 * Отменённые и упавшие деплои не нужны дольше суток: их вывод не обслуживает
 * посетителей, а разбираются с ними сразу.
 */
export const DEFAULT_RETENTION = {
  preview: '1d',
  production: '1w',
  canceled: '1d',
  errored: '1d',
}

/**
 * Категории деплоев: ключ политики, человекочитаемое имя, поле запроса и поля
 * ответа. Полей ответа два, потому что `GET` проекта отвечает днями
 * (`expirationDays*`), а `PATCH` — метками (`expiration*`); порядок в списке и
 * есть приоритет чтения.
 */
export const CATEGORIES = [
  {
    key: 'preview',
    label: 'превью',
    requestField: 'expiration',
    responseFields: ['expirationDays', 'expiration'],
  },
  {
    key: 'production',
    label: 'прод',
    requestField: 'expirationProduction',
    responseFields: ['expirationDaysProduction', 'expirationProduction'],
  },
  {
    key: 'canceled',
    label: 'отменённые',
    requestField: 'expirationCanceled',
    responseFields: ['expirationDaysCanceled', 'expirationCanceled'],
  },
  {
    key: 'errored',
    label: 'упавшие',
    requestField: 'expirationErrored',
    responseFields: ['expirationDaysErrored', 'expirationErrored'],
  },
]

/**
 * Метка срока по значению из ответа Vercel: числу дней или уже готовой метке.
 * Незнакомое число — не ошибка: Vercel может ввести новый срок, и показать его
 * понятнее, чем упасть.
 *
 * @param {number | string | undefined | null} value
 * @returns {string}
 */
export function retentionLabel(value) {
  if (typeof value === 'string' && value) {
    return value
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '(не задан)'
  }

  const known = Object.entries(RETENTION_DAYS).find(([, days]) => days === value)

  return known ? known[0] : `${value}d`
}

/**
 * Срок категории из ответа Vercel: сначала поля с днями, потом поля с метками.
 *
 * @param {Record<string, number | string | undefined> | undefined} policy
 * @param {{ responseFields: string[] }} category
 * @returns {number | string | undefined}
 */
export function retentionValue(policy, category) {
  for (const field of category.responseFields) {
    const value = policy?.[field]

    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

/**
 * Разбор политики в метки: то, что читает человек и что уходит в API при копировании.
 *
 * @param {Record<string, number | string | undefined> | undefined} policy
 * @returns {{ preview: string, production: string, canceled: string, errored: string }}
 */
export function policyLabels(policy) {
  /** @type {Record<string, string>} */
  const labels = {}

  for (const category of CATEGORIES) {
    labels[category.key] = retentionLabel(retentionValue(policy, category))
  }

  return labels
}

/**
 * Срок в днях по тому, что пришло: метка (`1w`), число дней (`7`) или ответ
 * API. Незнакомое значение — `NaN`, то есть «не совпадает ни с чем», а не
 * падение: показывать расхождение полезнее, чем ломаться на новом сроке Vercel.
 *
 * @param {number | string | undefined | null} value
 * @returns {number}
 */
export function retentionDays(value) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value in RETENTION_DAYS) {
    return RETENTION_DAYS[value]
  }

  return Number.parseInt(String(value ?? ''), 10)
}

/**
 * Совпадает ли политика с желаемой: метка либо равна целевой, либо переводится
 * в то же число дней (`30` от API и `1m` из аргументов — одно и то же).
 *
 * @param {{ preview: string, production: string, canceled: string, errored: string }} actual
 * @param {Record<string, string>} expected
 * @returns {boolean}
 */
export function policyMatches(actual, expected) {
  return CATEGORIES.every(category => retentionDays(actual[category.key]) === RETENTION_DAYS[expected[category.key]])
}

/**
 * Тело запроса на изменение сроков: метки в имена полей, которые принимает API.
 *
 * @param {{ preview: string, production: string, canceled: string, errored: string }} policy
 * @returns {Record<string, string>}
 */
export function expirationBody(policy) {
  /** @type {Record<string, string>} */
  const body = {}

  for (const category of CATEGORIES) {
    body[category.requestField] = policy[category.key]
  }

  return body
}

/** Разбор аргументов: только те, что перечислены, всё остальное — ошибка ввода. */
export function parseArgs(argv) {
  const options = {
    apply: false,
    dryRun: false,
    project: null,
    policy: { ...DEFAULT_RETENTION },
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--apply') {
      options.apply = true
    }
    else if (arg === '--dry-run') {
      options.dryRun = true
    }
    else if (arg === '--project') {
      options.project = argv[index + 1] ?? null
      index += 1
    }
    else if (arg.startsWith('--') && arg.slice(2) in options.policy) {
      const key = arg.slice(2)
      options.policy[key] = argv[index + 1] ?? ''
      index += 1
    }
    else {
      throw new Error(`неизвестный аргумент «${arg}»`)
    }
  }

  for (const category of CATEGORIES) {
    const value = options.policy[category.key]

    if (!RETENTION_LABELS.includes(value)) {
      throw new Error(
        `срок для «${category.label}» — одно из ${RETENTION_LABELS.join(', ')}, а не «${value}»`,
      )
    }
  }

  return options
}

/** Учётные данные окружения: токен и команда из `.vercel/project.json`, если он есть. */
function credentials() {
  let linked = {}

  try {
    linked = JSON.parse(readFileSync(resolve('.vercel', 'project.json'), 'utf8'))
  }
  catch {
    // Проект не привязан локально — не страшно, команду можно передать аргументом.
  }

  return {
    token: process.env.VERCEL_TOKEN ?? '',
    teamId: process.env.VERCEL_ORG_ID ?? linked.orgId ?? '',
    projectId: process.env.VERCEL_PROJECT_ID ?? linked.projectId ?? '',
    projectName: linked.projectName ?? '',
  }
}

/** Запрос к API Vercel: одна обёртка, чтобы ошибки читались одинаково. */
async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 300)}`)
  }

  return text ? JSON.parse(text) : {}
}

/** Проекты команды: имя и сроки хранения. Личный аккаунт — тоже команда. */
async function projects({ token, teamId }) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}&limit=100` : '?limit=100'
  const { projects: list = [] } = await api(`/v9/projects${query}`, { token })

  return list
}

/**
 * Сроки одного проекта. Список проектов отдаёт не все поля, поэтому за сроками
 * идём в сам проект — только если их нет в списке, чтобы не делать лишних запросов.
 */
async function projectRetention(project, { token, teamId }) {
  if (project.deploymentExpiration) {
    return project.deploymentExpiration
  }

  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const full = await api(`/v2/projects/${encodeURIComponent(project.id)}${query}`, { token })

  return full.deploymentExpiration ?? null
}

/** Куда идти за токеном и что сделать руками, если токена нет. */
function printManualSteps(policy) {
  console.log(`
[retention] VERCEL_TOKEN не задан — показываю шаги вместо изменений.

  Токен: Account Settings → Tokens → Create, затем в .env.local (файл в git не идёт):
    VERCEL_TOKEN=...

  Сроки (по умолчанию на Hobby — 30 дней) ставятся в каждом проекте команды:
    Project → Settings → Security → Deployment Retention Policy
      предпросмотр (Pre-Production) .... ${policy.preview}
      прод (Production) ............... ${policy.production}
      отменённые (Canceled) ........... ${policy.canceled}
      упавшие (Errored) ............... ${policy.errored}
    Сохранить. Политика проекта не меняет политику команды и других проектов.

  Проект на чужом аккаунте в этот список не попадёт никогда: токен видит только
  свою команду, и его политику ставит владелец того аккаунта.

  Проверить, что применилось: pnpm retention (после появления токена).
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const auth = credentials()

  if (!auth.token) {
    printManualSteps(options.policy)
    return
  }

  const list = await projects(auth)

  if (!list.length) {
    console.log('[retention] в команде нет доступных проектов')
    return
  }

  const target = options.project
    ? list.filter(project => project.name === options.project || project.id === options.project)
    : list

  if (!target.length) {
    const names = list.map(project => project.name).join(', ')
    console.log(`[retention] проект «${options.project}» в команде не найден; есть: ${names}`)
    process.exitCode = 1
    return
  }

  console.log(`[retention] команда ${auth.teamId || '(личная)'}, проектов: ${list.length}`)

  for (const project of target) {
    const current = await projectRetention(project, auth)
    const before = policyLabels(current)

    console.log(`\n  ${project.name}`)
    for (const category of CATEGORIES) {
      console.log(`    ${category.label.padEnd(12)} ${before[category.key]}`)
    }

    if (policyMatches(before, options.policy)) {
      console.log(`    уже по политике ${options.policy.production} / ${options.policy.preview} — менять нечего`)
    }

    if (!options.apply && !options.dryRun) {
      continue
    }

    const query = auth.teamId ? `?teamId=${encodeURIComponent(auth.teamId)}` : ''
    const body = expirationBody(options.policy)

    if (options.dryRun) {
      console.log(`    → было бы: ${options.policy.preview} / ${options.policy.production} / ${options.policy.canceled} / ${options.policy.errored}`)
      continue
    }

    await api(`/v9/projects/${encodeURIComponent(project.id)}/deployment-expiration${query}`, {
      token: auth.token,
      method: 'PATCH',
      body,
    })

    /* Проверка идёт по ответу API, а не по отправленному телу: имена полей в
       запросе и в ответе разные (метки против дней), и «ушло» не значит «встало». */
    const stored = await projectRetention({ id: project.id }, auth)
    const after = policyLabels(stored)

    console.log(`    → стало: ${after.preview} / ${after.production} / ${after.canceled} / ${after.errored}`)

    if (!policyMatches(after, options.policy)) {
      console.log('    ⚠ API вернул не то, что просили — стоит проверить в дашборде')
      process.exitCode = 1
    }
  }

  if (!options.apply && !options.dryRun) {
    console.log('\n[retention] это только чтение; чтобы поставить сроки — pnpm retention --apply')
    return
  }

  console.log(`
[retention] готово. Удаление деплоев запускает фоновая задача Vercel: она
разбирает кандидатов в течение 48 часов, а переоценку исключений (последние
деплои и активные алиасы) — до 30 дней. Место в Usage уменьшается постепенно;
кэш картинок и содержимое страниц от этой чистки не зависят.
`)
}

/* Прямой запуск: при импорте (тесты) модуль только отдаёт чистые функции. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  }
  catch (error) {
    console.error(`[retention] ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  }
}
