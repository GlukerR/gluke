<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

defineProps<{ projects: ProjectsCollectionItem[] }>()

const { t } = useI18n()

const WIDE_SIZES = '100vw md:100vw lg:64vw xl:920px'

/* Высокие карточки (индексы 1–2) тянутся на высоту широкого соседа: кадр
   становится заметно выше 16:9, и object-fit:cover апскейлил бы картинку
   по вертикали. Заявляем ширину с запасом (xl:920px), чтобы браузер выбрал
   кандидата, чьей высоты хватает на высокий кадр без upscale. */
const TALL_SIZES = '100vw md:50vw lg:64vw xl:920px'
const NARROW_SIZES = '100vw md:50vw lg:32vw xl:440px'

/* Узкие карточки стоят в паре с широкой и тянутся на её высоту, поэтому у них
   вертикальная обложка: лишняя высота уходит в фотографию, а не в пустоту. */
const TALL_INDEXES = new Set([1, 2])

function cardEmphasis(index: number) {
  if (index === 0) return 'lead'
  return TALL_INDEXES.has(index) ? 'tall' : 'default'
}
</script>

<template>
  <section
    id="projects"
    class="site-section site-anchor home-projects"
    aria-labelledby="home-projects-title"
  >
    <div class="site-container home-projects__inner">
      <HomeSectionHeader
        :eyebrow="t('home.projects.eyebrow')"
        :title="t('home.projects.title')"
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
            :emphasis="cardEmphasis(index)"
            :sizes="index === 0 || index === 3 ? WIDE_SIZES : (TALL_INDEXES.has(index) ? TALL_SIZES : NARROW_SIZES)"
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
  }

  .home-projects__item:nth-child(3) {
    grid-column: span 4;
  }

  .home-projects__item:nth-child(4) {
    grid-column: span 8;
  }
}
</style>
