import type { ProjectsCollectionItem } from '@nuxt/content'

export type ProjectMedia = ProjectsCollectionItem['media'][number]

export type GalleryRowVariant = 'wide' | 'paired' | 'solo' | 'quad' | 'triple'

export interface GalleryEntry {
  item: ProjectMedia
  sizes: string
}

export interface GalleryRow {
  id: string
  variant: GalleryRowVariant
  compact: boolean
  entries: GalleryEntry[]
}

const WIDE_SIZES = '100vw lg:92vw xl:1400px'
const PAIRED_SIZES = '100vw md:92vw lg:46vw xl:700px'
const QUAD_SIZES = '100vw md:46vw lg:23vw xl:350px'
const TRIPLE_SIZES = '100vw md:46vw lg:30vw xl:466px'
const SOLO_SIZES = '100vw lg:900px'
const SOLO_COMPACT_SIZES = '100vw lg:720px'

/**
 * Ширина элемента выбирается детерминированно по данным из Content
 * (`kind`, `width`, `height`), без обращения к DOM и измерения окна:
 * панорамные материалы и широкие видео занимают всю ширину сетки.
 */
function isWide(item: ProjectMedia, grid: boolean): boolean {
  const ratio = item.width / item.height

  /* В сеточном режиме ширина только по явному флагу: горизонтальные видео
     без `wide` по умолчанию встают парами (по 2 в ряд). */
  if (grid) {
    return Boolean(item.wide)
  }

  /* Явный `wide: false` отменяет автоматическое растягивание (например,
     у 16:9-видео, чтобы оно не вылезало на всю ширину). */
  if (item.wide === false) {
    return false
  }

  return Boolean(item.wide) || ratio >= 1.9 || (item.kind === 'video' && ratio >= 1.5)
}

/* Материал, помеченный `quad`, не может быть полноширинным. */
function isQuad(item: ProjectMedia): boolean {
  return Boolean(item.quad)
}

/* Одиночный материал отдельной строкой: не встаёт в пару, не растягивается
   на всю ширину (например, квадратный ролик в подборке). */
function isSolo(item: ProjectMedia): boolean {
  return Boolean(item.solo)
}

/* Материал для ряда из трёх на всю ширину (квадратные, не резать). */
function isTriple(item: ProjectMedia): boolean {
  return Boolean(item.triple)
}

/* Одиночный квадратный или вертикальный материал ограничивается сильнее,
   чем горизонтальный: иначе квадрат вырастает в огромный блок по высоте. */
function isCompact(item: ProjectMedia): boolean {
  return item.width / item.height < 1.2
}

function createEntry(item: ProjectMedia, sizes: string): GalleryEntry {
  return { item, sizes }
}

/**
 * Материалы группируются в строки одним проходом по исходному массиву:
 * широкий материал — отдельная строка, два подряд идущих обычных — пара,
 * одиночный обычный перед широким или в конце — центрированная solo-строка.
 * Исходный массив не мутируется и не сортируется, порядок Content сохраняется.
 *
 * `grid` — сеточный режим для showcase-страниц (синематики/гейм-реди):
 * горизонтальные видео идут по 2 в ряд, вертикальные собираются флагами
 * `triple`/`quad`; правило «первый/последний на всю ширину» и авто-растягивание
 * видео отключены.
 */
export function layoutGallery(media: ProjectMedia[], grid: boolean): GalleryRow[] {
  const result: GalleryRow[] = []
  let pending: ProjectMedia | undefined

  function pushSolo(item: ProjectMedia) {
    const compact = isCompact(item)

    result.push({
      id: item.src,
      variant: 'solo',
      compact,
      entries: [createEntry(item, compact ? SOLO_COMPACT_SIZES : SOLO_SIZES)],
    })
  }

  /* Материалы, помеченные `quad`, собираются в ряды по четыре. */
  function pushQuad(items: ProjectMedia[]) {
    for (let i = 0; i < items.length; i += 4) {
      const chunk = items.slice(i, i + 4)

      result.push({
        id: chunk.map(c => c.src).join('|'),
        variant: 'quad',
        compact: false,
        entries: chunk.map(c => createEntry(c, QUAD_SIZES)),
      })
    }
  }

  /* Материалы, помеченные `triple`, собираются в ряды по три. */
  function pushTriple(items: ProjectMedia[]) {
    for (let i = 0; i < items.length; i += 3) {
      const chunk = items.slice(i, i + 3)

      result.push({
        id: chunk.map(c => c.src).join('|'),
        variant: 'triple',
        compact: false,
        entries: chunk.map(c => createEntry(c, TRIPLE_SIZES)),
      })
    }
  }

  /* Quad-элементы группируются непрерывно, пока не встретится другой тип. */
  let quadBuffer: ProjectMedia[] = []

  function flushQuad() {
    if (quadBuffer.length > 0) {
      pushQuad(quadBuffer)
      quadBuffer = []
    }
  }

  /* Triple-элементы группируются непрерывно, пока не встретится другой тип. */
  let tripleBuffer: ProjectMedia[] = []

  function flushTriple() {
    if (tripleBuffer.length > 0) {
      pushTriple(tripleBuffer)
      tripleBuffer = []
    }
  }

  for (const [index, item] of media.entries()) {
    if (isSolo(item)) {
      flushPending()
      flushQuad()
      flushTriple()
      pushSolo(item)
      continue
    }

    if (isQuad(item)) {
      flushPending()
      flushTriple()
      quadBuffer.push(item)
      continue
    }

    if (isTriple(item)) {
      flushPending()
      flushQuad()
      tripleBuffer.push(item)
      continue
    }

    flushQuad()
    flushTriple()

    /* Первый и последний материалы галереи всегда занимают всю ширину строки
       сами по себе (кроме сеточного режима, а также явного wide: false —
       отключает и это принудительное растяжение): остальные группируются
       по прежним правилам. Крайние полноширинные строки дают композиции рамку. */
    const isEdge = !grid && item.wide !== false && (index === 0 || index === media.length - 1)

    if (isEdge) {
      flushPending()

      result.push({
        id: item.src,
        variant: 'wide',
        compact: false,
        entries: [createEntry(item, WIDE_SIZES)],
      })

      continue
    }

    if (isWide(item, grid)) {
      flushPending()

      result.push({
        id: item.src,
        variant: 'wide',
        compact: false,
        entries: [createEntry(item, WIDE_SIZES)],
      })

      continue
    }

    if (pending) {
      result.push({
        id: pending.src,
        variant: 'paired',
        compact: false,
        entries: [createEntry(pending, PAIRED_SIZES), createEntry(item, PAIRED_SIZES)],
      })

      pending = undefined

      continue
    }

    pending = item
  }

  flushQuad()
  flushTriple()
  flushPending()

  return result

  function flushPending() {
    if (pending) {
      pushSolo(pending)
      pending = undefined
    }
  }
}
