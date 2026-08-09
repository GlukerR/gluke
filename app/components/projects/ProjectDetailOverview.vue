<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

defineProps<{ metrics: ProjectsCollectionItem['metrics'] }>()

const { t } = useI18n()
</script>

<template>
  <section
    class="project-overview"
    aria-labelledby="project-overview-title"
  >
    <div class="site-container">
      <h2
        id="project-overview-title"
        class="sr-only"
      >
        {{ t('project.overviewSrTitle') }}
      </h2>

      <dl class="project-overview__list">
        <div
          v-for="metric in metrics"
          :key="`${metric.value}-${metric.label}`"
          class="project-overview__item"
        >
          <dt class="text-body--sm project-overview__label">
            {{ metric.label }}
          </dt>
          <dd class="text-heading project-overview__value">
            {{ metric.value }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.project-overview {
  padding-block: clamp(32px, 4vw, 56px);
  border-block: var(--site-border);
  background-color: var(--site-surface);
}

.project-overview__list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(20px, 3vw, 40px);
}

.project-overview__item {
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  min-width: 0;
}

.project-overview__value {
  font-size: var(--type-h2);
  line-height: var(--type-h2-leading);
  letter-spacing: var(--type-h2-tracking);
  color: var(--site-text);
  overflow-wrap: anywhere;
}

.project-overview__label {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

@media (min-width: 768px) {
  .project-overview__list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .project-overview__item + .project-overview__item {
    padding-inline-start: clamp(16px, 2vw, 32px);
    border-inline-start: var(--site-border);
  }
}
</style>
