<script setup lang="ts">
const route = useRoute()
const site = useSiteContent()

const { data } = await useAsyncData(
  () => `project-detail:${route.path}`,
  async () => {
    const [project, orderedProjects] = await Promise.all([
      queryCollection('projects')
        .path(route.path)
        .where('status', '=', 'published')
        .first(),
      queryCollection('projects')
        .where('status', '=', 'published')
        .order('position', 'ASC')
        .select('title', 'path')
        .all(),
    ])

    if (!project) {
      return null
    }

    const currentIndex = orderedProjects.findIndex(item => item.path === route.path)

    if (currentIndex === -1) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Не удалось определить порядок кейсов',
        fatal: true,
      })
    }

    return {
      project,
      previous: currentIndex > 0 ? orderedProjects[currentIndex - 1] ?? null : null,
      next: currentIndex < orderedProjects.length - 1 ? orderedProjects[currentIndex + 1] ?? null : null,
    }
  },
)

function notFound() {
  return createError({
    statusCode: 404,
    statusMessage: 'Проект не найден',
    fatal: true,
  })
}

if (!data.value) {
  throw notFound()
}

/* Компонент страницы переиспользуется при переходе между кейсами,
   поэтому 404 для несуществующего слага обрабатывается и после навигации. */
watch(data, (value) => {
  if (!value) {
    showError(notFound())
  }
})

const project = computed(() => data.value?.project ?? null)

const pageTitle = computed(() => {
  const current = project.value

  return current
    ? `${current.title} — ${current.client} — ${site.brand.name}`
    : site.brand.name
})

const pageDescription = computed(() => project.value?.description ?? site.hero.description)

useSeoMeta({
  title: () => pageTitle.value,
  description: () => pageDescription.value,
  ogTitle: () => pageTitle.value,
  ogDescription: () => pageDescription.value,
  ogType: 'article',
})
</script>

<template>
  <div
    v-if="data && project"
    class="project-page"
  >
    <div class="site-container project-page__back">
      <NuxtLink
        to="/#projects"
        class="project-page__back-link text-body--sm"
      >
        <span aria-hidden="true">←</span>
        <span>Вернуться к проектам</span>
      </NuxtLink>
    </div>

    <ProjectsProjectDetailHero :project="project" />

    <ProjectsProjectDetailOverview :metrics="project.metrics" />

    <ProjectsProjectDetailScope
      :services="project.services"
      :deliverables="project.deliverables"
    />

    <ProjectsProjectMediaGallery
      :media="project.media"
      :fallback-video-poster="project.cover.src"
    />

    <ProjectsProjectPager
      :previous="data.previous"
      :next="data.next"
    />

    <ProjectsProjectContact
      :cta="site.hero.primaryCta"
      :contacts="site.contacts"
    />
  </div>
</template>

<style scoped>
/* Единый вертикальный ритм страницы кейса: соседние секции дают по половине
   разрыва (`--project-space`), а границы блока секций — полный разрыв
   (`--project-space-edge`) там, где сосед своего отступа не добавляет. */
.project-page {
  --project-space: clamp(28px, 3.2vw, 56px);
  --project-space-edge: clamp(56px, 6.4vw, 104px);
}

.project-page__back {
  padding-block: clamp(16px, 2vw, 24px) 0;
}

.project-page__back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--site-text-secondary);
  transition: color 150ms ease;
}

.project-page__back-link:hover {
  color: var(--site-accent);
}
</style>
