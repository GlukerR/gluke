<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

type ProjectMedia = ProjectsCollectionItem['media'][number]

const props = defineProps<{
  media: ProjectsCollectionItem['media']
  fallbackVideoPoster: string
}>()

type RowVariant = 'wide' | 'paired' | 'solo'

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
const SOLO_SIZES = '100vw lg:900px'
const SOLO_COMPACT_SIZES = '100vw lg:720px'

/**
 * Ширина элемента выбирается детерминированно по данным из Content
 * (`kind`, `width`, `height`), без обращения к DOM и измерения окна:
 * панорамные материалы и широкие видео занимают всю ширину сетки.
 */
function isWide(item: ProjectMedia): boolean {
  const ratio = item.width / item.height

  return ratio >= 1.9 || (item.kind === 'video' && ratio >= 1.5)
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

  for (const item of props.media) {
    if (isWide(item)) {
      if (pending) {
        pushSolo(pending)
        pending = undefined
      }

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

  if (pending) {
    pushSolo(pending)
  }

  return result
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
        Материалы проекта
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

  .project-gallery__row--paired {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
