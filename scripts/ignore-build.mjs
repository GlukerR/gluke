/**
 * Пропуск сборки, когда коммит физически не может изменить сайт.
 *
 * Зачем. Каждый деплой Vercel оставляет в Deployment Storage вывод сборки —
 * около 300 МБ статики и бандл функции на Hobby, а хранит их по политике
 * хранения проекта (см. `scripts/deployment-retention.mjs`). Пуш только с
 * документацией или служебными файлами не меняет ни одной страницы, но платит
 * за деплой полной ценой: временем сборки и местом. `ignoreCommand` в
 * `vercel.json` спрашивает эту команду, и если она отвечает кодом 0, сборка не
 * запускается вовсе (код 1 — «собирай»; так это описано в справочнике
 * `vercel.json`).
 *
 * Правило намеренно асимметрично. Пропуск требует, чтобы **все** изменённые
 * файлы были из явного списка известных служебных путей (документация, рабочие
 * каталоги агентов, настройки редактора). Любой незнакомый путь — сборка. Так
 * новая папка исходников не приведёт к молча пропущенному релизу: неверный
 * пропуск заметен, а вот неверная сборка — нет.
 *
 * Идентификаторы коммитов. Vercel кладёт в окружение `VERCEL_GIT_PREVIOUS_SHA`
 * (коммит предыдущего деплоя). Сравнение идёт по нему; если история в мелком
 * клоне его не содержит, скрипт пробует догрузить коммит и в любом случае при
 * сомнении собирает.
 *
 * Использование:
 *
 *   node scripts/ignore-build.mjs                  # решение для VERCEL_GIT_PREVIOUS_SHA
 *   node scripts/ignore-build.mjs --since HEAD~1    # локальная проверка правила
 *   node scripts/ignore-build.mjs --paths docs/run.md README.md   # показ решения без git
 *
 * Код выхода: 0 — сборку пропустить, 1 — собирать.
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Пути, изменения в которых не влияют на собранный сайт ни одним байтом. */
export const IGNORED_PREFIXES = [
  'docs/',
  '.freebuff/',
  '.github/',
  '.vscode/',
  '.claude/',
]

/** Служебные файлы в корне: их правка сайт не меняет. */
export const IGNORED_FILES = [
  'README.md',
  'CASE_TEMPLATE.md',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
]

/**
 * Можно ли не собирать из-за этого файла.
 *
 * @param {string} path
 * @returns {boolean}
 */
export function isIgnorable(path) {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '')

  return IGNORED_FILES.includes(normalized) || IGNORED_PREFIXES.some(prefix => normalized.startsWith(prefix))
}

/**
 * Решение по списку изменённых файлов.
 *
 * @param {string[]} changedPaths
 * @returns {{ skip: boolean, ignored: string[], blocking: string[], reason: string }}
 */
export function decideBuild(changedPaths) {
  const paths = changedPaths.map(path => path.trim()).filter(Boolean)
  const ignored = paths.filter(isIgnorable)
  const blocking = paths.filter(path => !isIgnorable(path))

  if (!paths.length) {
    return {
      skip: false,
      ignored,
      blocking,
      reason: 'список изменённых файлов пуст — сравнивать не с чем, собираем',
    }
  }

  if (blocking.length) {
    return {
      skip: false,
      ignored,
      blocking,
      reason: `меняются исходники: ${blocking.slice(0, 5).join(', ')}${blocking.length > 5 ? ` и ещё ${blocking.length - 5}` : ''}`,
    }
  }

  return {
    skip: true,
    ignored,
    blocking,
    reason: `изменения только в служебных путях: ${ignored.slice(0, 5).join(', ')}${ignored.length > 5 ? ` и ещё ${ignored.length - 5}` : ''}`,
  }
}

/** Запуск git: нужен только вывод, ошибки обрабатывает вызывающий. */
function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} → ${(result.stderr || '').trim().split('\n')[0] || 'ошибка'}`)
  }

  return result.stdout.split('\n').map(line => line.trim()).filter(Boolean)
}

/** Изменённые файлы между коммитами; при неудаче — догрузка и одна повторная попытка. */
function changedPaths(since) {
  try {
    return git(['diff', '--name-only', '--no-renames', since, 'HEAD'])
  }
  catch (first) {
    try {
      git(['fetch', '--depth=50', 'origin', since])
    }
    catch {
      throw first
    }

    return git(['diff', '--name-only', '--no-renames', since, 'HEAD'])
  }
}

/** Разбор аргументов: `--since <ref>` и `--paths <файлы>` для проверки правила. */
export function parseArgs(argv) {
  const options = { since: process.env.VERCEL_GIT_PREVIOUS_SHA ?? '', paths: null }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--since') {
      options.since = argv[index + 1] ?? ''
      index += 1
    }
    else if (arg === '--paths') {
      options.paths = argv.slice(index + 1)
      break
    }
    else {
      throw new Error(`неизвестный аргумент «${arg}»`)
    }
  }

  return options
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  let paths

  if (options.paths) {
    paths = options.paths
  }
  else if (options.since) {
    try {
      paths = changedPaths(options.since)
    }
    catch (error) {
      console.log(`[ignore-build] сравнить с ${options.since} не удалось (${error.message}) — собираем`)
      process.exitCode = 1
      return
    }
  }
  else {
    console.log('[ignore-build] нет VERCEL_GIT_PREVIOUS_SHA и нет --since — собираем')
    process.exitCode = 1
    return
  }

  const decision = decideBuild(paths)

  console.log(`[ignore-build] ${decision.skip ? 'пропускаем сборку' : 'собираем'}: ${decision.reason}`)

  if (decision.skip) {
    console.log('[ignore-build] сайт от этих файлов не меняется; принудительно собрать — redeploy из дашборда')
  }

  process.exitCode = decision.skip ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  }
  catch (error) {
    console.log(`[ignore-build] ${error instanceof Error ? error.message : error} — собираем`)
    process.exitCode = 1
  }
}
