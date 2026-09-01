<script setup lang="ts">
const route = useRoute()
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { home, projects: projectsPath, project: projectPath } = useSiteRoutes()

/* Слаг берётся из параметра маршрута, а не из пути: публичный URL
   отвязан от внутреннего content-path (`/projects/en/getic`).
   Проверка ключа сужает объединение параметров локализованных маршрутов без приведения типов. */
const slug = computed(() => ('slug' in route.params ? route.params.slug : ''))

const { data } = await useAsyncData(
  computed(() => `project-detail-${locale.value}-${slug.value}`),
  async () => {
    const [project, orderedProjects] = await Promise.all([
      queryLocalizedProject(locale.value, slug.value).first(),
      queryLocalizedProjects(locale.value)
        .select('title', 'slug', 'position')
        .all()
        .then(items => items.sort((a, b) => a.position - b.position)),
    ])

    if (!project) {
      return null
    }

    const currentIndex = orderedProjects.findIndex(item => item.slug === slug.value)

    if (currentIndex === -1) {
      throw createError({
        statusCode: 500,
        statusMessage: t('errors.projectOrderFailed'),
        fatal: true,
      })
    }

    return {
      project,
      /* Круговой переход в обе стороны: навигация никогда не обрывается.
         С первого кейса «предыдущий» ведёт на последний, с последнего
         «следующий» — на первый. Цель берётся из краёв упорядоченного
         списка, поэтому при добавлении нового кейса кнопка сразу ведёт на него. */
      previous: currentIndex > 0
        ? orderedProjects[currentIndex - 1] ?? null
        : orderedProjects[orderedProjects.length - 1] ?? null,
      next: currentIndex < orderedProjects.length - 1
        ? orderedProjects[currentIndex + 1] ?? null
        : orderedProjects[0] ?? null,
    }
  },
)

function notFound() {
  return createError({
    statusCode: 404,
    statusMessage: t('errors.projectNotFound'),
    fatal: true,
  })
}

const initialData = data.value

if (!initialData) {
  throw notFound()
}

/* Компонент страницы переиспользуется при переходе между кейсами,
   поэтому 404 для несуществующего слага обрабатывается и после навигации. */
watch(data, (value) => {
  if (!value) {
    showError(notFound())
  }
})

/* Предыдущий кейс остаётся значением по умолчанию только на время
   переходного рендера, реальный 404 обрабатывается watch выше. */
const project = computed(() => data.value?.project ?? initialData.project)

/* Showcase (синематики/гейм-реди): компактная страница без метрик,
   «Услуг» и «О проекте» — акцент на видео/галерее по клику. */
const isShowcase = computed(() => project.value.type === 'showcase')

const pageTitle = computed(() => t('seo.projectTitle', {
  title: project.value.title,
  site: site.value.brand.name,
}))
const pageDescription = computed(() => project.value.description)

const { toAbsolute, toCanonical } = useSiteUrls()

const canonicalUrl = computed(() => toCanonical(projectPath(project.value.slug)))
const coverUrl = computed(() => toAbsolute(project.value.cover.src))
const organizationId = computed(() => toAbsolute('#identity'))

/* Обложка кейса как главное изображение страницы: передаём URL строкой,
   module nuxt-schema-org сам создаст ImageObject и не подставит логотип студии. */

usePageSeo({
  title: pageTitle,
  description: pageDescription,
  path: () => projectPath(project.value.slug),
  type: 'article',
  image: () => project.value.cover,
})

/* Дата публикации видео для VideoObject: из первого года периода кейса
   («2023–2024» → 2023-01-01). Точной даты загрузки нет — год достаточно
   корректен для разметки. */
function uploadDateFor(period: string): string {
  const year = period.match(/(\d{4})/)?.[1]
  return year ? `${year}-01-01` : '2020-01-01'
}

/* Видео-материалы кейса как VideoObject: Google и ИИ индексируют ролики
   отдельно от страницы. Узел строится только если в кейсе есть видео. */
const videoSchema = computed(() => (project.value.media ?? [])
  .filter(item => item.kind === 'video')
  .map((item, index) => ({
    '@id': `${canonicalUrl.value}#video-${index}`,
    '@type': 'VideoObject',
    'name': item.caption || item.alt || project.value.title,
    'description': item.alt || pageDescription.value,
    'contentUrl': toAbsolute(item.src),
    'thumbnailUrl': toAbsolute(item.poster || project.value.cover.src),
    'uploadDate': uploadDateFor(project.value.period),
    'width': item.width,
    'height': item.height,
  })))

useSchemaOrg([
  /* Явные @id нужны, чтобы узлы обновлялись при клиентском переходе между кейсами. */
  defineWebPage({
    '@id': () => `${canonicalUrl.value}#webpage`,
    '@type': 'ItemPage',
    'url': () => canonicalUrl.value,
    'name': () => pageTitle.value,
    'description': () => pageDescription.value,
    'inLanguage': () => locale.value,
    'primaryImageOfPage': () => coverUrl.value,
  }),
  {
    '@id': () => `${canonicalUrl.value}#creativework`,
    '@type': 'CreativeWork',
    'name': () => project.value.title,
    'description': () => pageDescription.value,
    'url': () => canonicalUrl.value,
    'image': () => coverUrl.value,
    'inLanguage': () => locale.value,
    'creator': { '@id': () => organizationId.value },
    'provider': { '@id': () => organizationId.value },
  },
  defineBreadcrumb({
    '@id': () => `${canonicalUrl.value}#breadcrumb`,
    'itemListElement': [
      defineListItem({ name: () => t('breadcrumb.home'), item: () => toAbsolute(home()) }),
      defineListItem({ name: () => t('breadcrumb.projects'), item: () => toAbsolute(projectsPath()) }),
      defineListItem({ name: () => project.value.title }),
    ],
  }),
  ...videoSchema.value,
])
</script>

<template>
  <div
    v-if="data && project"
    class="project-page"
  >
    <div class="site-container project-page__back">
      <NuxtLink
        :to="projectsPath()"
        class="project-page__back-link text-body--sm"
      >
        <span aria-hidden="true">←</span>
        <span>{{ t('project.back') }}</span>
      </NuxtLink>
    </div>

    <ProjectsProjectShowcaseHero
      v-if="isShowcase"
      :project="project"
    />

    <template v-else>
      <ProjectsProjectDetailHero :project="project" />

      <ProjectsProjectDetailOverview :metrics="project.metrics" />

      <ProjectsProjectDetailScope
        :services="project.services"
        :deliverables="project.deliverables"
        :about="project.about"
      />
    </template>

    <ProjectsProjectMediaGallery
      :media="project.media"
      :fallback-video-poster="project.cover.src"
      :grid="isShowcase"
    />

    <ProjectsProjectPager
      :previous="data.previous"
      :next="data.next"
    />

    <SiteContact
      :cta="site.hero.primaryCta"
      :pricing="site.pricing"
      :contacts="site.contacts"
      :spacing="'project'"
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
  color: var(--site-accent-text);
}
</style>
