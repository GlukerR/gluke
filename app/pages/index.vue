<script setup lang="ts">
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { home } = useSiteRoutes()

const { data: projects } = await useAsyncData(
  computed(() => `home-featured-projects-${locale.value}`),
  () => queryLocalizedProjects(locale.value)
    .where('featured', '=', true)
    .all()
    .then(items => items.sort((a, b) => a.position - b.position)),
)

/* На главной показываем только первые 4 проекта, остальные — в архиве /projects. */
const featuredProjects = computed(() => (projects.value ?? []).slice(0, 4))
const initialHeroProject = featuredProjects.value[0]

if (!initialHeroProject) {
  throw createError({
    statusCode: 500,
    statusMessage: t('errors.featuredProjectsMissing'),
    fatal: true,
  })
}

/* Обложка героя остаётся непустой и во время переключения языка. */
const heroProject = computed(() => featuredProjects.value[0] ?? initialHeroProject)

const pageTitle = computed(() => t('seo.homeTitle', {
  site: site.value.brand.name,
  tagline: site.value.hero.title,
}))

const { toAbsolute } = useSiteUrls()
const heroCoverUrl = computed(() => toAbsolute(heroProject.value.cover.src))

/* Явный ImageObject обложки первого проекта: module nuxt-schema-org иначе
   подставляет логотип студии как primaryImageOfPage. */
/* Обложка первого проекта как главное изображение страницы: передаём URL строкой,
   module nuxt-schema-org сам создаст ImageObject и не подставит логотип студии. */

usePageSeo({
  title: pageTitle,
  description: () => site.value.hero.description,
  path: () => home(),
  type: 'website',
  image: () => heroProject.value.cover,
})

useSchemaOrg([
  defineWebPage({
    '@type': 'WebPage',
    'name': () => pageTitle.value,
    'description': () => site.value.hero.description,
    'inLanguage': () => locale.value,
    'primaryImageOfPage': () => heroCoverUrl.value,
  }),
])
</script>

<template>
  <div>
    <HomeHero :hero="site.hero" />

    <HomeStats :stats="site.stats" />

    <HomeProjects :projects="featuredProjects" />

    <HomeServices :services="site.services" />

    <HomeProcess :steps="site.process" />

    <HomeAbout
      :about="site.about"
      :audiences="site.audiences"
      :pricing="site.pricing"
    />

    <SiteContact
      :cta="site.hero.primaryCta"
      :pricing="site.pricing"
      :contacts="site.contacts"
    />
  </div>
</template>
