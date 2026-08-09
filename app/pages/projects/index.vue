<script setup lang="ts">
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { projects: projectsPath, project: projectPath } = useSiteRoutes()
const { toAbsolute } = useSiteUrls()

const { data: projects } = await useAsyncData(
  computed(() => `projects-archive-${locale.value}`),
  () => queryLocalizedProjects(locale.value)
    .order('position', 'ASC')
    .all(),
)

const publishedProjects = computed(() => projects.value ?? [])
const initialLeadProject = publishedProjects.value[0]

if (!initialLeadProject) {
  throw createError({
    statusCode: 500,
    statusMessage: t('errors.publishedProjectsMissing'),
    fatal: true,
  })
}

const CARD_SIZES = '100vw md:50vw xl:780px'

/* og:image остаётся определённым и во время переключения языка. */
const leadProject = computed(() => publishedProjects.value[0] ?? initialLeadProject)

const pageTitle = computed(() => t('seo.projectsTitle', { site: site.value.brand.name }))

/* Смена языка — это переход на другой маршрут, поэтому список собирается один раз
   для текущей локали: в граф попадают абсолютные публичные URL этого языка. */
const itemListElements = publishedProjects.value.map((project, index) => defineListItem({
  position: index + 1,
  name: project.title,
  item: toAbsolute(projectPath(project.slug)),
}))

usePageSeo({
  title: pageTitle,
  description: () => site.value.hero.description,
  path: () => projectsPath(),
  type: 'website',
  image: () => leadProject.value.cover,
})

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': () => pageTitle.value,
    'description': () => site.value.hero.description,
    'inLanguage': () => locale.value,
  }),
  defineItemList({
    itemListElement: itemListElements,
  }),
])
</script>

<template>
  <section
    class="projects-archive"
    aria-labelledby="projects-archive-title"
  >
    <div class="site-container projects-archive__inner">
      <div class="projects-archive__header">
        <p class="text-label text-primary">
          {{ t('projects.eyebrow') }}
        </p>
        <h1
          id="projects-archive-title"
          class="text-heading text-highlighted projects-archive__title"
        >
          {{ t('projects.title') }}
        </h1>
      </div>

      <ul class="projects-archive__grid">
        <li
          v-for="project in publishedProjects"
          :key="project.slug"
          class="projects-archive__item"
        >
          <ProjectsProjectCard
            :project="project"
            :sizes="CARD_SIZES"
          />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.projects-archive {
  padding-block: clamp(32px, 4vw, 64px) clamp(56px, 6.4vw, 104px);
}

.projects-archive__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 56px);
}

.projects-archive__header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.projects-archive__title {
  max-width: 20ch;
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
}

.projects-archive__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(16px, 2vw, 28px);
}

.projects-archive__item {
  display: flex;
  min-width: 0;
}

.projects-archive__item > * {
  width: 100%;
}

@media (min-width: 768px) {
  .projects-archive__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
