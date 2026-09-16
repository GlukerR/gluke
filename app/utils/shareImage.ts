import { imagePath } from './imageVersion'

/**
 * Версия картинки в адресе: `/media/…/cover.jpg?v=1a2b3c4d`.
 *
 * Смысл — не кэш браузера, а кэш превью ссылки: мессенджер и соцсеть держат
 * картинку по её URL и не переспрашивают страницу, поэтому замена файла под тем
 * же именем в чате не видна. Версия — отпечаток содержимого картинки,
 * посчитанный при сборке (`scripts/media-versions.mjs`): поменялся файл —
 * поменялся адрес, и в превью приезжает новое изображение.
 *
 * Разметку это не ломает: `og:image` остаётся абсолютным URL, а JSON-LD и
 * canonical версии не получают — там важна стабильность адреса.
 *
 * Картинки, которые уходят не ссылкой на файл, а вариантом `/_ipx/**`, версию
 * получают иначе — модификатором адреса, см. `app/utils/imageVersion.ts`.
 */
export function withShareImageVersion(
  src: string,
  versions: Record<string, string> | undefined,
): string {
  /* Отпечатки лежат по адресу файла из frontmatter (без query и фрагмента),
     поэтому и ищем по нему: иначе картинка со своим `?w=1200` версии не
     получила бы. */
  const separatorIndex = src.search(/[?#]/)
  const path = imagePath(src)
  const version = versions?.[path]

  if (!version) {
    return src
  }

  const suffix = separatorIndex === -1 ? '' : src.slice(separatorIndex)
  const hashIndex = suffix.indexOf('#')
  const query = hashIndex === -1 ? suffix : suffix.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : suffix.slice(hashIndex)
  const separator = query ? '&' : '?'

  return `${path}${query}${separator}v=${version}${hash}`
}
