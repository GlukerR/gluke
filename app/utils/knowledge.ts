import { KNOWLEDGE_SECTIONS } from '#shared/knowledge'
import type { KnowledgeSection } from '#shared/knowledge'

/* Тело статьи приходит разобранным MDC-деревом (`body.value`): узлы вида
   `[tag, props, ...children]`, листья — строки. */
type MinimalNode = [string, Record<string, unknown>, ...unknown[]]

function isNode(value: unknown): value is MinimalNode {
  return Array.isArray(value) && typeof value[0] === 'string'
}

/* Текст всего поддерева. Подписи схем (`kb-figure`) тоже читаются, поэтому
   считаются; сами схемы — SVG в компоненте, в дереве их нет. */
export function bodyText(nodes: unknown): string {
  if (typeof nodes === 'string') {
    return nodes
  }
  if (isNode(nodes)) {
    return nodes.slice(2).map(bodyText).join(' ')
  }
  if (Array.isArray(nodes)) {
    return nodes.map(bodyText).join(' ')
  }
  return ''
}

/* Скорость чтения — 180 слов в минуту: темп внимательного чтения
   технического текста, а не беглого просмотра. Каждая схема добавляет
   полминуты — её разглядывают, а не пролистывают. */
const WORDS_PER_MINUTE = 180
const MINUTES_PER_FIGURE = 0.5

function countFigures(nodes: unknown): number {
  if (isNode(nodes)) {
    const own = nodes[0] === 'kb-figure' ? 1 : 0
    return own + nodes.slice(2).reduce<number>((sum, child) => sum + countFigures(child), 0)
  }
  if (Array.isArray(nodes)) {
    return nodes.reduce<number>((sum, child) => sum + countFigures(child), 0)
  }
  return 0
}

export function readingMinutes(nodes: unknown): number {
  const words = bodyText(nodes).split(/\s+/).filter(Boolean).length
  const minutes = words / WORDS_PER_MINUTE + countFigures(nodes) * MINUTES_PER_FIGURE

  return Math.max(1, Math.round(minutes))
}

export interface SectionGroup<T> {
  section: KnowledgeSection
  articles: T[]
}

/* Хаб: разделы в порядке `KNOWLEDGE_SECTIONS`, статьи внутри — по
   `position`. Пустые разделы не показываются: «скоро будет» без статей
   читателю не помогает. */
export function groupBySection<T extends { section: KnowledgeSection, position: number }>(
  articles: readonly T[],
): SectionGroup<T>[] {
  return KNOWLEDGE_SECTIONS
    .map(section => ({
      section,
      articles: articles
        .filter(article => article.section === section)
        .sort((a, b) => a.position - b.position),
    }))
    .filter(group => group.articles.length > 0)
}

export interface LetterGroup<T> {
  letter: string
  terms: T[]
}

/* Глоссарий: термины по алфавиту языка страницы и группами по первой букве.
   Сортировка — `Intl.Collator`, а не сравнение строк: так «Ё» стоит рядом
   с «Е», а регистр не разрывает соседей. В русской версии латинские
   аббревиатуры (AR, GLB, LOD) идут после кириллицы — так их ставит сама
   русская локаль. Термин не с буквы («3D viewer») попадает в группу «#». */
export function groupByLetter<T extends { term: string }>(terms: readonly T[], locale: string): LetterGroup<T>[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const groups: LetterGroup<T>[] = []

  for (const term of [...terms].sort((a, b) => collator.compare(a.term, b.term))) {
    const first = term.term.charAt(0).toLocaleUpperCase(locale)
    const letter = /\p{L}/u.test(first) ? first : '#'
    const last = groups.at(-1)

    if (last?.letter === letter) {
      last.terms.push(term)
    }
    else {
      groups.push({ letter, terms: [term] })
    }
  }

  return groups
}
