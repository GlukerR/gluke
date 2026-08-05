<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

defineProps<{ projects: ProjectsCollectionItem[] }>()

const WIDE_SIZES = '100vw md:100vw lg:64vw xl:960px'
const NARROW_SIZES = '100vw md:50vw lg:32vw xl:480px'
</script>

<template>
  <section
    id="projects"
    class="site-section site-anchor home-projects"
    aria-labelledby="home-projects-title"
  >
    <div class="site-container home-projects__inner">
      <HomeSectionHeader
        eyebrow="ПРОЕКТЫ"
        title="Техническая визуализация в реальных задачах"
        title-id="home-projects-title"
      />

      <ul class="home-projects__grid">
        <li
          v-for="(project, index) in projects"
          :key="project.path"
          class="home-projects__item"
        >
          <ProjectsProjectCard
            :project="project"
            :emphasis="index === 0 ? 'lead' : 'default'"
            :sizes="index === 0 || index === 3 ? WIDE_SIZES : NARROW_SIZES"
          />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.home-projects__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 56px);
}

.home-projects__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(16px, 2vw, 28px);
}

.home-projects__item {
  display: flex;
  min-width: 0;
}

.home-projects__item > * {
  width: 100%;
}

@media (min-width: 768px) {
  .home-projects__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-projects__item:first-child {
    grid-column: span 2;
  }
}

@media (min-width: 1024px) {
  .home-projects__grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    row-gap: clamp(24px, 3vw, 48px);
  }

  .home-projects__item:nth-child(1) {
    grid-column: span 8;
  }

  .home-projects__item:nth-child(2) {
    grid-column: span 4;
    align-self: end;
  }

  .home-projects__item:nth-child(3) {
    grid-column: span 4;
  }

  .home-projects__item:nth-child(4) {
    grid-column: span 8;
  }

  .home-projects__item:nth-child(n + 5) {
    grid-column: span 6;
  }
}
</style>
