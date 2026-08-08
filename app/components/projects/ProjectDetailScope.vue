<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

const props = defineProps<{
  services: ProjectsCollectionItem['services']
  deliverables: ProjectsCollectionItem['deliverables']
}>()

const hasServices = computed(() => props.services.length > 0)
const hasDeliverables = computed(() => props.deliverables.length > 0)
const hasContent = computed(() => hasServices.value || hasDeliverables.value)
</script>

<template>
  <section
    v-if="hasContent"
    class="project-scope"
    aria-labelledby="project-scope-title"
  >
    <div class="site-container project-scope__inner">
      <h2
        id="project-scope-title"
        class="sr-only"
      >
        Состав работ по проекту
      </h2>

      <div
        v-if="hasServices"
        class="project-scope__group"
      >
        <h3 class="text-heading text-heading--sm project-scope__heading">
          Услуги
        </h3>
        <ul class="project-scope__list">
          <li
            v-for="service in services"
            :key="service"
            class="text-body project-scope__item"
          >
            {{ service }}
          </li>
        </ul>
      </div>

      <div
        v-if="hasDeliverables"
        class="project-scope__group"
      >
        <h3 class="text-heading text-heading--sm project-scope__heading">
          Что подготовили
        </h3>
        <ul class="project-scope__list">
          <li
            v-for="deliverable in deliverables"
            :key="deliverable"
            class="text-body project-scope__item"
          >
            {{ deliverable }}
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Сверху — полный разрыв: полоса метрик заканчивается границей
   и внешнего отступа не даёт. Снизу — половина разрыва до галереи. */
.project-scope {
  padding-block:
    var(--project-space-edge, clamp(56px, 6.4vw, 104px))
    var(--project-space, clamp(28px, 3.2vw, 56px));
}

.project-scope__inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(32px, 4vw, 64px);
}

.project-scope__group {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.project-scope__heading {
  color: var(--site-text);
  text-wrap: balance;
}

.project-scope__list {
  display: flex;
  flex-direction: column;
  border-top: var(--site-border);
}

.project-scope__item {
  padding-block: 14px;
  border-bottom: var(--site-border);
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

@media (min-width: 768px) {
  .project-scope__inner {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
