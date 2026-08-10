<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

const props = withDefaults(
  defineProps<{
    project: ProjectsCollectionItem
    emphasis?: 'lead' | 'tall' | 'default'
    sizes?: string
  }>(),
  {
    emphasis: 'default',
    sizes: '100vw md:50vw xl:640px',
  },
)

const { t } = useI18n()
const { project: projectPath } = useSiteRoutes()

const titleId = computed(() => `project-${props.project.slug}`)
const leadMetric = computed(() => props.project.metrics[0])
const services = computed(() => props.project.services.slice(0, 2))
</script>

<template>
  <NuxtLink
    :to="projectPath(project.slug)"
    :aria-labelledby="titleId"
    class="project-card"
    :class="`project-card--${emphasis}`"
  >
    <span class="project-card__media">
      <NuxtPicture
        :src="project.cover.src"
        :alt="project.cover.alt"
        :width="project.cover.width"
        :height="project.cover.height"
        :sizes="sizes"
        format="avif,webp"
        loading="lazy"
        decoding="async"
        class="project-card__picture"
        :img-attrs="{ class: 'project-card__image' }"
      />
    </span>

    <span class="project-card__body">
      <span class="project-card__meta text-label text-dimmed">
        <span>{{ project.client }}</span>
        <span aria-hidden="true">/</span>
        <span>{{ project.industry }}</span>
      </span>

      <h3
        :id="titleId"
        class="text-heading project-card__title"
        :class="emphasis === 'lead' ? 'text-heading--md' : 'text-heading--sm'"
      >
        {{ project.title }}
      </h3>

      <span
        v-if="leadMetric"
        class="project-card__metric"
      >
        <span class="text-heading text-heading--sm project-card__metric-value">{{ leadMetric.value }}</span>
        <span class="text-body--sm project-card__metric-label">{{ leadMetric.label }}</span>
      </span>

      <span class="project-card__footer">
        <span class="project-card__services">
          <span
            v-for="service in services"
            :key="service"
            class="project-card__service text-body--sm"
          >
            {{ service }}
          </span>
        </span>

        <span class="project-card__period text-body--sm">{{ project.period }}</span>
      </span>

      <span class="project-card__go text-label">
        <span>{{ t('projects.card.view') }}</span>
        <span
          class="project-card__arrow"
          aria-hidden="true"
        >→</span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.project-card {
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

.project-card__media {
  display: block;
  overflow: hidden;
  border-radius: var(--site-radius-md);
  background-color: var(--site-media-canvas);
}

.project-card__picture {
  display: block;
}

.project-card__picture :deep(.project-card__image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: 16 / 10;
  transition: transform 250ms ease;
}

.project-card--lead .project-card__picture :deep(.project-card__image) {
  aspect-ratio: 16 / 9;
}

.project-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.project-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-card__title {
  color: var(--site-text);
  text-wrap: balance;
  overflow-wrap: anywhere;
  transition: color 150ms ease;
}

.project-card__metric {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
}

.project-card__metric-value {
  color: var(--site-accent-text);
}

.project-card__metric-label {
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.project-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding-top: 12px;
  border-top: var(--site-border);
}

.project-card__services {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.project-card__service {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: var(--site-border);
  border-radius: var(--site-radius-sm);
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.project-card__period {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

.project-card__go {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--site-accent-text);
}

.project-card__arrow {
  transition: transform 200ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .project-card:hover {
    border-color: var(--site-text-muted);
    background-color: var(--site-surface-raised);
  }

  .project-card:hover .project-card__picture :deep(.project-card__image) {
    transform: scale(1.03);
  }

  .project-card:hover .project-card__title {
    color: var(--site-text);
  }

  .project-card:hover .project-card__arrow {
    transform: translateX(4px);
  }
}

@media (min-width: 1024px) {
  .project-card--lead {
    padding: clamp(24px, 2vw, 32px);
  }

  /* Узкая карточка растянута на высоту широкого соседа. Свободную высоту забирает
     обложка, поэтому текстовый блок остаётся плотным, без провала в середине. */
  .project-card--tall .project-card__media {
    flex: 1;
    min-height: clamp(220px, 18vw, 320px);
  }

  .project-card--tall .project-card__picture,
  .project-card--tall .project-card__picture :deep(.project-card__image) {
    height: 100%;
  }

  .project-card--tall .project-card__picture :deep(.project-card__image) {
    aspect-ratio: auto;
  }

  .project-card--tall .project-card__body {
    flex: 0 0 auto;
  }

  .project-card--tall .project-card__metric {
    margin-top: 0;
  }
}
</style>
