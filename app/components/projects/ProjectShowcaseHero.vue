<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

const props = defineProps<{ project: ProjectsCollectionItem }>()

/* Картинка в шапке: отдельное поле `hero`, если задано, иначе обложка кейса. */
const heroVisual = computed(() => props.project.hero ?? props.project.cover)
</script>

<template>
  <section
    class="showcase-hero"
    aria-labelledby="showcase-hero-title"
  >
    <div class="site-container showcase-hero__inner">
      <div class="showcase-hero__text">
        <p class="text-label text-accent showcase-hero__meta">
          <span>{{ project.client }}</span>
          <span aria-hidden="true">/</span>
          <span>{{ project.industry }}</span>
        </p>

        <h1
          id="showcase-hero-title"
          class="text-display text-highlighted showcase-hero__title"
        >
          {{ project.title }}
        </h1>

        <p class="text-body showcase-hero__description">
          {{ project.description }}
        </p>
      </div>

      <div class="showcase-hero__visual">
        <NuxtPicture
          :src="heroVisual.src"
          :alt="heroVisual.alt"
          :width="heroVisual.width"
          :height="heroVisual.height"
          sizes="100vw lg:58vw xl:1000px"
          format="avif,webp"
          loading="eager"
          decoding="async"
          class="showcase-hero__picture"
          :img-attrs="{ class: 'showcase-hero__image', fetchpriority: 'high' }"
        />
        <p
          v-if="heroVisual.caption"
          class="text-body--sm showcase-hero__caption"
        >
          {{ heroVisual.caption }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.showcase-hero {
  padding-block: clamp(32px, 4vw, 64px) clamp(48px, 6vw, 96px);
}

.showcase-hero__inner {
  display: grid;
  gap: clamp(28px, 4vw, 48px);
  align-items: center;
}

.showcase-hero__text {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.showcase-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.showcase-hero__title {
  max-width: 18ch;
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
  font-size: var(--type-h1);
  line-height: var(--type-h1-leading);
  letter-spacing: var(--type-h1-tracking);
}

.showcase-hero__description {
  max-width: 56ch;
  color: var(--site-text-secondary);
}

.showcase-hero__visual {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.showcase-hero__picture {
  display: block;
  overflow: hidden;
  border: var(--site-border);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-media-canvas);
}

.showcase-hero__picture :deep(.showcase-hero__image) {
  width: 100%;
  height: auto;
}

.showcase-hero__caption {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

@media (min-width: 1024px) {
  .showcase-hero__inner {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    gap: clamp(40px, 4vw, 72px);
  }

  .showcase-hero__title {
    font-size: clamp(2.5rem, 3.4vw, 3.25rem);
    max-width: 14em;
  }
}
</style>
