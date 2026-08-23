<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

const props = defineProps<{
  category: 'orgtech' | 'industrial' | 'furniture'
  cover: ProjectsCollectionItem['cover']
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const SIZES = '100vw md:50vw xl:560px'

const title = computed(() => t(`projects.categories.${props.category}.title`))
const description = computed(() => t(`projects.categories.${props.category}.description`))
</script>

<template>
  <NuxtLink
    :to="localePath({ name: 'projects', query: { category } })"
    class="category-card"
  >
    <span class="category-card__media">
      <NuxtPicture
        :src="cover.src"
        :alt="cover.alt"
        :width="cover.width"
        :height="cover.height"
        :sizes="SIZES"
        format="avif,webp"
        loading="lazy"
        decoding="async"
        class="category-card__picture"
        :img-attrs="{ class: 'category-card__image' }"
      />
    </span>

    <span class="category-card__body">
      <h3
        class="text-heading text-heading--md category-card__title"
      >
        {{ title }}
      </h3>

      <p class="text-body--sm category-card__description">
        {{ description }}
      </p>

      <span class="category-card__go text-label">
        <span>{{ t('projects.categories.card.view') }}</span>
        <span
          class="category-card__arrow"
          aria-hidden="true"
        >→</span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.category-card {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  min-width: 0;
  height: 100%;
  padding: clamp(16px, 1.6vw, 24px);
  border: var(--site-border);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-surface);
  color: var(--site-text);
  transition: border-color 150ms ease, background-color 150ms ease;
}

.category-card__media {
  display: block;
  overflow: hidden;
  border-radius: var(--site-radius-md);
  background-color: var(--site-media-canvas);
}

.category-card__picture {
  display: block;
}

.category-card__picture :deep(.category-card__image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: 16 / 9;
  transition: transform 250ms ease;
}

.category-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.category-card__title {
  color: var(--site-text);
  text-wrap: balance;
  transition: color 150ms ease;
}

.category-card__description {
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
  /* Прижимает пояснение (и CTA под ним) к низу карточки:
     во всех карточках описания на одном уровне. */
  margin-top: auto;
}

.category-card__go {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--site-accent-text);
}

.category-card__arrow {
  transition: transform 200ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .category-card:hover {
    border-color: var(--site-text-muted);
    background-color: var(--site-surface-raised);
  }

  .category-card:hover .category-card__picture :deep(.category-card__image) {
    transform: scale(1.03);
  }

  .category-card:hover .category-card__arrow {
    transform: translateX(4px);
  }
}
</style>
