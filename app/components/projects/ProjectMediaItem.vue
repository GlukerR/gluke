<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

type ProjectMedia = ProjectsCollectionItem['media'][number]

const props = defineProps<{
  item: ProjectMedia
  sizes: string
  fallbackVideoPoster: string
}>()

const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
}

const isVideo = computed(() => props.item.kind === 'video')

/* Собственный `poster` материала всегда приоритетнее обложки кейса. */
const posterSrc = computed(() => props.item.poster ?? props.fallbackVideoPoster)

const videoType = computed(() => {
  const extension = props.item.src.split('.').pop()?.toLowerCase() ?? ''

  return VIDEO_MIME_TYPES[extension]
})
</script>

<template>
  <figure class="project-media">
    <video
      v-if="isVideo"
      :aria-label="item.alt"
      :width="item.width"
      :height="item.height"
      :poster="posterSrc"
      class="project-media__video"
      controls
      playsinline
      preload="metadata"
    >
      <source
        :src="item.src"
        :type="videoType"
      >
      Ваш браузер не воспроизводит это видео.
      <a
        :href="item.src"
        class="project-media__fallback"
      >Открыть видеофайл</a>
    </video>

    <NuxtPicture
      v-else
      :src="item.src"
      :alt="item.alt"
      :width="item.width"
      :height="item.height"
      :sizes="sizes"
      format="avif,webp"
      loading="lazy"
      decoding="async"
      class="project-media__picture"
      :img-attrs="{ class: 'project-media__image' }"
    />

    <figcaption
      v-if="item.caption"
      class="text-body--sm project-media__caption"
    >
      {{ item.caption }}
    </figcaption>
  </figure>
</template>

<style scoped>
.project-media {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0;
}

.project-media__picture {
  display: block;
  overflow: hidden;
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  background-color: var(--site-surface);
}

/* `height: auto` keeps the intrinsic ratio of every source image intact. */
.project-media__picture :deep(.project-media__image) {
  width: 100%;
  height: auto;
}

.project-media__video {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  /* Тёмная подложка из токенов: до отрисовки постера нет белой вспышки,
     а постер с другим соотношением сторон вписывается без искажений. */
  background-color: var(--site-surface);
  object-fit: contain;
}

.project-media__fallback {
  color: var(--site-accent);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.project-media__caption {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}
</style>
