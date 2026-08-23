<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

type ProjectMedia = ProjectsCollectionItem['media'][number]

const props = defineProps<{
  media: ProjectsCollectionItem['media']
  fallbackVideoPoster: string
}>()

const { t } = useI18n()

type RowVariant = 'wide' | 'paired' | 'solo' | 'quad' | 'triple'

interface GalleryEntry {
  item: ProjectMedia
  sizes: string
}

interface GalleryRow {
  id: string
  variant: RowVariant
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
function isWide(item: ProjectMedia): boolean {
  const ratio = item.width / item.height

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
 */
const rows = computed<GalleryRow[]>(() => {
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

  for (const [index, item] of props.media.entries()) {
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
       сами по себе, независимо от пропорций: остальные группируются по прежним
       правилам. Крайние полноширинные строки дают композиции рамку. */
    const isEdge = index === 0 || index === props.media.length - 1

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

    if (isWide(item)) {
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
})
</script>

<template>
  <section
    v-if="media.length > 0"
    class="project-gallery"
    aria-labelledby="project-gallery-title"
  >
    <div class="site-container project-gallery__inner">
      <h2
        id="project-gallery-title"
        class="text-heading text-heading--md text-highlighted"
      >
        {{ t('project.gallery') }}
      </h2>

      <ul class="project-gallery__rows">
        <li
          v-for="row in rows"
          :key="row.id"
          class="project-gallery__row"
          :class="[
            `project-gallery__row--${row.variant}`,
            { 'project-gallery__row--compact': row.compact },
          ]"
        >
          <ProjectsProjectMediaItem
            v-for="entry in row.entries"
            :key="entry.item.src"
            :item="entry.item"
            :sizes="entry.sizes"
            :fallback-video-poster="fallbackVideoPoster"
          />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.project-gallery {
  padding-block: var(--project-space, clamp(28px, 3.2vw, 56px));
}

.project-gallery__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(24px, 3vw, 48px);
}

.project-gallery__rows {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 32px);
}

.project-gallery__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(16px, 2vw, 32px);
  min-width: 0;
}

@media (min-width: 1024px) {
  .project-gallery__row {
    align-items: start;
  }

  /* Карточки пары растягиваются на одну высоту, а медиа заполняет фрейм
     с обрезкой (cover): оба фрейма в паре всегда строго одной высоты. */
  .project-gallery__row--paired {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .project-gallery__row--quad {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: stretch;
  }

  .project-gallery__row--triple {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    /* Квадратные материалы не растягиваются и не обрезаются: каждый
       сохраняет свои пропорции, три в ряд на всю ширину. */
    align-items: start;
  }

  .project-gallery__row--paired :deep(.project-media) {
    height: 100%;
  }

  .project-gallery__row--paired :deep(.project-media__picture) {
    flex: 1;
    min-height: 0;
  }

  .project-gallery__row--paired :deep(.project-media__picture .project-media__image) {
    height: 100%;
    object-fit: cover;
  }

  .project-gallery__row--paired :deep(.project-media__video) {
    height: 100%;
    object-fit: cover;
  }

  .project-gallery__row--quad :deep(.project-media) {
    height: 100%;
  }

  .project-gallery__row--quad :deep(.project-media__picture) {
    flex: 1;
    min-height: 0;
  }

  .project-gallery__row--quad :deep(.project-media__picture .project-media__image) {
    height: 100%;
    object-fit: cover;
  }

  .project-gallery__row--quad :deep(.project-media__video) {
    height: 100%;
    object-fit: cover;
  }

  .project-gallery__row--triple :deep(.project-media__picture) {
    /* Пропорции сохраняются: квадрат остаётся квадратом. */
    height: auto;
  }

  /* Одиночный материал не растягивается на всю ширину контейнера,
     а центрируется в колонке ограниченной ширины. */
  .project-gallery__row--solo {
    grid-template-columns: minmax(0, 900px);
    justify-content: center;
  }

  .project-gallery__row--solo.project-gallery__row--compact {
    grid-template-columns: minmax(0, 720px);
  }
}
</style>
