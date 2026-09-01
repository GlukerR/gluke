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
 * Источник даты — git: у изменённых в рабочем дереве файлов берётся сегодняшний
 * день (правка ещё не в истории), у остальных — дата последнего коммита.
 *
 * Использование: pnpm lastmod   (перед коммитом правок контента)
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

async function git(args) {
  const { stdout } = await run('git', [...gitArgs, ...args], { cwd: root })
  return stdout.trim()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function modifiedInWorkingTree() {
  const out = await git(['status', '--porcelain', '--', 'content'])
  return new Set(
    out.split('\n')
      .map(line => line.slice(3).trim())
      .filter(Boolean)
      .map(path => path.replace(/^"|"$/g, '')),
  )
}

async function lastCommitDate(path) {
  const out = await git(['log', '-1', '--format=%cs', '--', path])
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
  const dirty = await modifiedInWorkingTree()
  const targets = [
    ...(await Array.fromAsync(glob('content/projects/*/*.md', { cwd: root }))).map(p => ({ p, anchor: 'period' })),
    ...(await Array.fromAsync(glob('content/site/*.yml', { cwd: root }))).map(p => ({ p, anchor: 'locale' })),
  ]

  let changed = 0
  const skipped = []
  for (const { p, anchor } of targets) {
    const relPath = relative(root, join(root, p)).split(sep).join('/')
    const date = dirty.has(relPath) ? today() : await lastCommitDate(relPath)
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
  console.log(`[lastmod] обновлено ${changed} из ${targets.length} файлов`)
}

await main()
