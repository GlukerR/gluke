<script setup lang="ts">
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { projects: projectsPath, project: projectPath } = useSiteRoutes()
const { toAbsolute } = useSiteUrls()
const route = useRoute()

type ProjectCategory = 'orgtech' | 'industrial' | 'furniture' | 'gameready'

/* Профили, показываемые на хабе (gameready появится, когда появятся кейсы). */
const CATEGORIES = ['orgtech', 'industrial', 'furniture'] as const

const { data: projects } = await useAsyncData(
  computed(() => `projects-archive-${locale.value}`),
  () => queryLocalizedProjects(locale.value)
    .all()
    .then(items => items.sort((a, b) => a.position - b.position)),
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

/* Активная категория приходит query-параметром: /projects?category=orgtech. */
const activeCategory = computed<ProjectCategory | null>(() => {
  const raw = route.query.category
  if (typeof raw !== 'string') return null
  return (CATEGORIES as readonly string[]).includes(raw) ? raw as ProjectCategory : null
})

const visibleProjects = computed(() => {
  if (!activeCategory.value) return publishedProjects.value
  return publishedProjects.value
    .filter(project => project.categories?.includes(activeCategory.value as ProjectCategory))
})

/* Обложка категории — представительный кейс (не повторяет топ главной),
   с фолбэком на первый кейс категории. */
const CATEGORY_COVERS: Record<ProjectCategory, string> = {
  orgtech: 'prime-box',
  industrial: 'sibmaster',
  furniture: 'gelios-tables',
  gameready: '',
}

const categoryCover = (category: ProjectCategory) => {
  const preferred = publishedProjects.value.find(project => project.slug === CATEGORY_COVERS[category])
  if (preferred) return preferred.cover
  return publishedProjects.value.find(project => project.categories?.includes(category))?.cover
    ?? initialLeadProject.cover
}

const categoryCards = computed(() =>
  CATEGORIES.map(category => ({
    category,
    cover: categoryCover(category),
  })),
)

const activeCategoryTitle = computed(() =>
  activeCategory.value ? t(`projects.categories.${activeCategory.value}.title`) : '',
)

const activeCategoryDescription = computed(() =>
  activeCategory.value ? t(`projects.categories.${activeCategory.value}.description`) : '',
)

/* У архива и каждой категории своё описание — не дублируем hero-текст главной. */
const pageDescription = computed(() => {
  if (activeCategory.value) {
    return t('seo.projectsCategoryDescription', {
      category: activeCategoryTitle.value,
      description: activeCategoryDescription.value,
    })
  }
  return t('seo.projectsDescription')
})

const leadProject = computed(() => visibleProjects.value[0] ?? initialLeadProject)

const pageTitle = computed(() => {
  if (activeCategory.value) {
    return t('seo.projectsCategoryTitle', {
      category: activeCategoryTitle.value,
      site: site.value.brand.name,
    })
  }
  return t('seo.projectsTitle', { site: site.value.brand.name })
})

const itemListElements = computed(() =>
  visibleProjects.value.map((project, index) => defineListItem({
    position: index + 1,
    name: project.title,
    item: toAbsolute(projectPath(project.slug)),
  })),
)

/* Явный ImageObject обложки ведущего проекта: module nuxt-schema-org иначе
   подставляет логотип студии как primaryImageOfPage. */
/* Обложка ведущего проекта как главное изображение страницы: передаём URL строкой,
   module nuxt-schema-org сам создаст ImageObject и не подставит логотип студии. */

usePageSeo({
  title: pageTitle,
  description: pageDescription,
  path: () => projectsPath(),
  type: 'website',
  image: () => leadProject.value.cover,
})

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': () => pageTitle.value,
    'description': () => pageDescription.value,
    'inLanguage': () => locale.value,
    'primaryImageOfPage': () => toAbsolute(leadProject.value.cover.src),
  }),
  ...(activeCategory.value
    ? [defineItemList({ itemListElement: itemListElements.value })]
    : []),
])
</script>

<template>
  <section
    class="projects-archive"
    aria-labelledby="projects-archive-title"
  >
    <div class="site-container projects-archive__inner">
      <div class="projects-archive__header">
        <p class="text-label text-accent">
          {{ t('projects.eyebrow') }}
        </p>

        <NuxtLink
          v-if="activeCategory"
          :to="projectsPath()"
          class="projects-archive__back text-body--sm"
        >
          <span aria-hidden="true">←</span>
          {{ t('projects.categories.back') }}
        </NuxtLink>

        <h1
          id="projects-archive-title"
          class="text-heading text-highlighted projects-archive__title"
          :class="{ 'projects-archive__title--category': activeCategory }"
        >
          {{ activeCategory ? activeCategoryTitle : t('projects.title') }}
        </h1>
      </div>

      <ul
        v-if="activeCategory"
        class="projects-archive__grid"
      >
        <li
          v-for="project in visibleProjects"
          :key="project.slug"
          class="projects-archive__item"
        >
          <ProjectsProjectCard
            :project="project"
            :sizes="CARD_SIZES"
          />
        </li>
      </ul>

      <ul
        v-else
        class="projects-categories__grid"
      >
        <li
          v-for="card in categoryCards"
          :key="card.category"
          class="projects-categories__item"
        >
          <ProjectsCategoryCard
            :category="card.category"
            :cover="card.cover"
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

.projects-archive__title--category {
  max-width: none;
  text-wrap: balance;
}

.projects-archive__back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  color: var(--site-text-secondary);
  transition: color 150ms ease;
}

.projects-archive__back:hover {
  color: var(--site-accent-text);
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

.projects-categories__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(16px, 2vw, 28px);
}

.projects-categories__item {
  display: flex;
  min-width: 0;
}

.projects-categories__item > * {
  width: 100%;
}

@media (min-width: 768px) {
  .projects-archive__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .projects-categories__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .projects-categories__item:last-child {
    grid-column: span 2;
  }
}

@media (min-width: 1024px) {
  .projects-categories__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .projects-categories__item:last-child {
    grid-column: auto;
  }
}
</style>
