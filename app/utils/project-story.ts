import type { ProjectsCollectionItem } from '@nuxt/content'

/* Разбор тела кейса на «затравку» и остаток.
 *
 * На странице кейса первый абзац секции «Задача» стоит рядом с услугами — это
 * короткий ввод, который читают все. Всё остальное уезжает в свёрнутый блок
 * «Подробнее о проекте», чтобы страница не превращалась в полотно.
 *
 * Тело приходит разобранным MDC-деревом: `body.value` — массив узлов вида
 * `[tag, props, ...children]`. Затравку вырезаем из этого дерева, иначе абзац
 * покажется дважды.
 */

type StoryNode = [string, Record<string, unknown>, ...unknown[]]

export interface ProjectStory {
  /** Первый абзац тела — выводится на странице рядом с услугами. */
  lead: string
  /** Проект с телом без затравки — уходит в свёрнутый блок. */
  rest: ProjectsCollectionItem
  /** Остался ли после выноса затравки текст для свёрнутого блока. */
  hasRest: boolean
}

function isNode(value: unknown): value is StoryNode {
  return Array.isArray(value) && typeof value[0] === 'string'
}

function isHeading(value: unknown): boolean {
  return isNode(value) && /^h[1-6]$/.test(value[0])
}

/* Текст узла: у абзаца дети — строки, но внутри может быть и разметка
   (ссылка, выделение), поэтому собираем строки по всему поддереву. */
function nodeText(node: unknown): string {
  if (typeof node === 'string') {
    return node
  }
  if (!isNode(node)) {
    return ''
  }

  return node.slice(2).map(nodeText).join('')
}

export function splitProjectStory(project: ProjectsCollectionItem): ProjectStory {
  const nodes = (project.body?.value ?? []) as unknown[]
  const leadIndex = nodes.findIndex(node => isNode(node) && node[0] === 'p')

  if (leadIndex === -1) {
    return { lead: '', rest: project, hasRest: nodes.length > 0 }
  }

  const dropped = new Set([leadIndex])

  /* Заголовок секции, из которой взята затравка, убираем всегда: в большинстве
     кейсов абзац в ней единственный и заголовок остался бы пустым, а там, где
     есть продолжение, оно читается как продолжение вводного абзаца — заголовок
     «Задача» над одной осиротевшей фразой выглядит хуже, чем его отсутствие. */
  const headingIndex = leadIndex - 1
  if (isHeading(nodes[headingIndex])) {
    dropped.add(headingIndex)
  }

  const value = nodes.filter((_, index) => !dropped.has(index))

  return {
    lead: nodeText(nodes[leadIndex]).trim(),
    rest: { ...project, body: { ...project.body, value } } as ProjectsCollectionItem,
    hasRest: value.length > 0,
  }
}
