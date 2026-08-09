<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

type ProjectPagerLink = Pick<ProjectsCollectionItem, 'title' | 'slug'>

const props = defineProps<{
  previous: ProjectPagerLink | null
  next: ProjectPagerLink | null
}>()

const { t } = useI18n()
const { project: projectPath } = useSiteRoutes()

const hasLinks = computed(() => Boolean(props.previous ?? props.next))
</script>

<template>
  <nav
    v-if="hasLinks"
    class="project-pager"
    aria-labelledby="project-pager-title"
  >
    <div class="site-container">
      <h2
        id="project-pager-title"
        class="sr-only"
      >
        {{ t('project.pager.srTitle') }}
      </h2>

      <ul class="project-pager__list">
        <li
          v-if="previous"
          class="project-pager__cell"
        >
          <NuxtLink
            :to="projectPath(previous.slug)"
            class="project-pager__link project-pager__link--previous"
          >
            <span class="text-label project-pager__label">
              <span aria-hidden="true">←</span>
              <span>{{ t('project.pager.previous') }}</span>
            </span>
            <span class="text-heading text-heading--sm project-pager__title">{{ previous.title }}</span>
          </NuxtLink>
        </li>

        <li
          v-if="next"
          class="project-pager__cell project-pager__cell--next"
        >
          <NuxtLink
            :to="projectPath(next.slug)"
            class="project-pager__link project-pager__link--next"
          >
            <span class="text-label project-pager__label">
              <span>{{ t('project.pager.next') }}</span>
              <span aria-hidden="true">→</span>
            </span>
            <span class="text-heading text-heading--sm project-pager__title">{{ next.title }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.project-pager {
  padding-block: var(--project-space, clamp(28px, 3.2vw, 56px));
}

.project-pager__list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(16px, 2vw, 24px);
}

.project-pager__cell {
  display: flex;
  min-width: 0;
}

.project-pager__link {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 44px;
  padding: clamp(20px, 2.4vw, 32px);
  border: var(--site-border);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-surface);
  color: var(--site-text);
  transition: border-color 150ms ease, background-color 150ms ease;
}

.project-pager__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--site-accent);
}

.project-pager__title {
  color: var(--site-text);
  text-wrap: balance;
  overflow-wrap: anywhere;
}

@media (hover: hover) and (pointer: fine) {
  .project-pager__link:hover {
    border-color: var(--site-text-muted);
    background-color: var(--site-surface-raised);
  }
}

@media (min-width: 768px) {
  .project-pager__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-pager__cell--next {
    grid-column: 2;
  }

  .project-pager__link--next {
    align-items: flex-end;
    text-align: end;
  }
}
</style>
