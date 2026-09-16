/**
 * Проставляет в контент поле `updated` — дату последнего изменения файла.
 * Из него sitemap собирает `lastmod`.
 *
 * Почему дата лежит в контенте, а не считается при сборке: production собирает
 * Vercel, а он клонирует репозиторий поверхностно — `git log` по конкретному
 * файлу там вернёт одну и ту же дату для всех файлов. Значение, одинаковое у
 * всех URL и меняющееся на каждый деплой, поисковики просто перестают
 * учитывать, поэтому дату фиксируем в файле и коммитим вместе с правкой.
 *
 * Два режима, и разница между ними — суть скрипта:
 *
 *   pnpm lastmod          только файлы, изменённые в рабочем дереве: им ставится
 *                         сегодняшний день (правка ещё не в истории). Чужие
 *                         кейсы не трогаются вовсе. Иначе правка одного кейса
 *                         тащила в диффе ещё сорок: дата последнего коммита в
 *                         рабочем чекауте расходится с закоммиченным `updated`
 *                         (историю переписывали переносом, ребейзом, клоном
 *                         с другой датой), и скрипт «обновлял» то, чего правка
 *                         не касалась.
 *   pnpm lastmod -- --all все файлы, дата — из истории последних коммитов.
 *                         Это режим сборки: buildCommand делает
 *                         `git fetch --unshallow` (полная история) и только
 *                         потом запускает скрипт, поэтому даты на деплое
 *                         пересчитываются по реальной истории каждого файла.
 *                         Если докачка истории не удалась, шаг пропускается
 *                         целиком и sitemap берёт закоммиченные `updated`.
 *
 * Использование:
 *   pnpm lastmod              (перед коммитом правок контента)
 *   pnpm lastmod -- --all     (в buildCommand Vercel, см. vercel.json)
 */
import { glob, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* Репозиторий может числиться «чужим» по владельцу (Windows + внешний диск),
   поэтому git вызывается с явным исключением — иначе команда падает. */
const gitArgs = ['-c', `safe.directory=${root.split(sep).join('/')}`]

/* Вывод отдаётся как есть: у `git status --porcelain` первый символ строки —
   пробел статуса, и trim съел бы его вместе с началом пути. */
async function git(args) {
  const { stdout } = await run('git', [...gitArgs, ...args], { cwd: root })
  return stdout
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function modifiedInWorkingTree() {
  const out = await git(['status', '--porcelain', '--', 'content'])
  return new Set(
    out.split('\n')
      /* Формат porcelain: два символа статуса, пробел, путь — поэтому slice(3),
         а не split по пробелу: путь может содержать пробелы. */
      .map(line => line.slice(3).trim())
      .filter(Boolean)
      .map(path => path.replace(/^"|"$/g, '')),
  )
}

async function lastCommitDate(path) {
  const out = (await git(['log', '-1', '--format=%cs', '--', path])).trim()
  return out || today()
}

/* Поле пишется в frontmatter сразу после `period` (у кейсов) или после
   `locale` (у site/*.yml) — рядом с остальными датами и всегда на одном месте,
   чтобы диффы оставались читаемыми. */
function withUpdated(source, date, anchor) {
  if (/^updated:/m.test(source)) {
    return source.replace(/^updated:.*$/m, `updated: ${date}`)
  }
  const anchorLine = new RegExp(`^(${anchor}:.*)$`, 'm')
  if (!anchorLine.test(source)) {
    return null
  }
  return source.replace(anchorLine, `$1\nupdated: ${date}`)
}

async function main() {
  const all = process.argv.slice(2).includes('--all')
  /* В режиме сборки список правленого не нужен: даты берутся из истории. */
  const dirty = all ? null : await modifiedInWorkingTree()
  const targets = [
    ...(await Array.fromAsync(glob('content/projects/*/*.md', { cwd: root }))).map(p => ({ p, anchor: 'period' })),
    ...(await Array.fromAsync(glob('content/site/*.yml', { cwd: root }))).map(p => ({ p, anchor: 'locale' })),
  ]

  let changed = 0
  let untouched = 0
  const skipped = []
  for (const { p, anchor } of targets) {
    const relPath = relative(root, join(root, p)).split(sep).join('/')
    /* Файл, которого правка не касалась, оставляем как есть: его дата
       проставлена в своём коммите, и переписывать её локально нечем. */
    if (dirty && !dirty.has(relPath)) {
      untouched += 1
      continue
    }
    const date = all ? await lastCommitDate(relPath) : today()
    const source = await readFile(join(root, p), 'utf8')
    const next = withUpdated(source, date, anchor)

    if (next === null) {
      skipped.push(`${relPath} (не найден якорь «${anchor}:»)`)
      continue
    }
    if (next !== source) {
      await writeFile(join(root, p), next)
      changed += 1
    }
  }

  if (skipped.length) {
    console.error(`[lastmod] пропущено ${skipped.length}:`)
    for (const line of skipped) console.error(`  ${line}`)
    process.exit(1)
  }
  if (dirty) {
    const touched = targets.length - untouched
    console.log(touched === 0
      ? '[lastmod] правок в контенте нет — даты не менялись'
      : `[lastmod] правка затронула ${touched} файл(а) из ${targets.length}, даты обновлены у ${changed}`)
    return
  }
  console.log(`[lastmod] --all: даты пересчитаны по истории, обновлено ${changed} из ${targets.length}`)
}

await main()
