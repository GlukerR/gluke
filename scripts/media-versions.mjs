/**
 * Отпечатки картинок проекта: «адрес → версия содержимого».
 *
 * Зачем версия в адресе. Первый повод — превью ссылки: мессенджер держит
 * картинку по её URL и не переспрашивает страницу, поэтому замена файла под тем
 * же именем в чате не видна. Именно так выглядел симптом «кидаю клиенту ссылку
 * на кейс, а там старая картинка»: обложка `rp-grand` менялась под тем же
 * именем файла (`docs/changes-log.md` §67).
 *
 * Второй повод — варианты `/_ipx/**`. Их адрес собирается из пути исходника и
 * модификаторов, поэтому по нему нельзя отличить новую картинку от прежней, и
 * кэш браузера и CDN залипает на старой даже после замены файла. Версия едет в
 * адрес модификатором (`app/utils/imageVersion.ts`), и адрес меняется вместе с
 * содержимым.
 *
 * Карту читает `nuxt.config.ts` при сборке или старте dev-сервера и отдаёт
 * страницам через `runtimeConfig.public.imageVersions`. В рантайме файлы не
 * читаются: на запрос это не влияет.
 *
 * Модуль намеренно на голом Node (как остальные `scripts/*.mjs`): он читает
 * файлы проекта, то есть в клиентскую сборку попадать не должен.
 *
 * Проверить руками:
 *
 *   node scripts/media-versions.mjs             # карта целиком
 *   node scripts/media-versions.mjs rp-grand    # только кейс
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Расширения, которые считаются картинками: GLB, MP3 и видео версий не получают. */
const IMAGE_PATTERN = /\/media\/[^\s'"]+\.(?:jpe?g|png|webp|avif)/gi

/** Файлы контента, в которых ищутся картинки. */
const CONTENT_EXTENSIONS = ['.md', '.yml', '.yaml']

/** Длина отпечатка в hex-символах: хватает для различения версий, коротко в URL. */
const FINGERPRINT_LENGTH = 8

/**
 * Короткий отпечаток содержимого файла — версия картинки в адресе.
 *
 * @param {string | Uint8Array} data
 * @param {number} [length]
 * @returns {string}
 */
export function fingerprint(data, length = FINGERPRINT_LENGTH) {
  return createHash('sha256').update(data).digest('hex').slice(0, length)
}

/**
 * Frontmatter без ограничителей `---`: только блок полей, без тела кейса.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function frontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    return ''
  }

  const end = normalized.indexOf('\n---', 4)

  return end === -1 ? '' : normalized.slice(4, end)
}

/**
 * Адреса картинок в тексте: любые пути `/media/…` с картинным расширением.
 *
 * Разбор регулярный, а не по структуре YAML, и это осознанный выбор: одна и та
 * же картинка объявлена и в `cover`, и в `media`, и в `thumb`, а заводить
 * список полей значило бы терять версию у каждой новой картинки, о которой
 * модуль ещё не знает. Расширения отсекают то, чему версия в адресе не нужна:
 * модели `.glb`, музыку и видео.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function imageSources(text) {
  return text.match(IMAGE_PATTERN) ?? []
}

/**
 * Файлы контента каталога, рекурсивно.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function contentFiles(dir) {
  const files = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...contentFiles(path))
    }
    else if (entry.isFile() && CONTENT_EXTENSIONS.some(extension => entry.name.endsWith(extension))) {
      files.push(path)
    }
  }

  return files
}

/**
 * Карта «адрес картинки → отпечаток файла» по всему контенту проекта.
 *
 * У markdown читается только frontmatter: картинки объявлены там, а тела
 * статей — проза. У yml читается файл целиком: у него нет блока полей.
 *
 * Файл, которого нет на диске, версии не получает: битую ссылку ловит
 * `pnpm validate:content`, а превью ссылки из-за отсутствующей версии не
 * ломается. Отсутствие каталогов (например, в урезанном чекауте) — не ошибка
 * сборки: карта тогда пустая, адреса остаются прежними.
 *
 * @param {{ rootDir?: string, contentDir?: string, publicDir?: string }} [options]
 * @returns {Record<string, string>}
 */
export function collectImageVersions(options = {}) {
  const root = options.rootDir ?? process.cwd()
  const contentDir = join(root, options.contentDir ?? 'content')
  const publicDir = join(root, options.publicDir ?? 'public')
  /** @type {Record<string, string>} */
  const versions = {}

  let files

  try {
    files = contentFiles(contentDir)
  }
  catch {
    return versions
  }

  for (const file of files) {
    let text

    try {
      text = readFileSync(file, 'utf8')
    }
    catch {
      continue
    }

    const body = file.endsWith('.md') ? frontmatter(text) : text

    for (const src of imageSources(body)) {
      if (versions[src]) {
        continue
      }

      try {
        versions[src] = fingerprint(readFileSync(join(publicDir, src)))
      }
      catch {
        // Файла нет — версии нет; см. комментарий к функции.
      }
    }
  }

  return versions
}

/* Прямой запуск — печать карты: так проверяют, что попало в сборку. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filter = process.argv.slice(2).find(arg => !arg.startsWith('-'))
  const versions = collectImageVersions()
  const entries = Object.entries(versions)
    .filter(([src]) => !filter || src.includes(filter))
    .sort(([a], [b]) => a.localeCompare(b))

  console.log(`${entries.length} картинок с версией${filter ? ` по фильтру «${filter}»` : ''}:`)

  for (const [src, version] of entries) {
    console.log(`  ${src}?v=${version}`)
  }
}
