<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'
import { layoutGallery } from '~/utils/gallery-layout'
import type { GalleryRow } from '~/utils/gallery-layout'

const props = withDefaults(
  defineProps<{
    media: ProjectsCollectionItem['media']
    fallbackVideoPoster: string
    /* Сеточный режим для showcase-страниц (синематики/гейм-реди):
       горизонтальные видео идут по 2 в ряд, вертикальные собираются
       флагами `triple`/`quad`; правило «первый/последний на всю ширину»
       и авторастягивание видео отключены. */
    grid?: boolean
  }>(),
  {
    grid: false,
  },
)

const { t } = useI18n()

const rows = computed<GalleryRow[]>(() => layoutGallery(props.media, props.grid))
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
