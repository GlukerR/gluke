<script setup lang="ts">
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { home } = useSiteRoutes()

const { data: projects } = await useAsyncData(
  computed(() => `home-featured-projects-${locale.value}`),
  () => queryLocalizedProjects(locale.value)
    .where('featured', '=', true)
    .order('position', 'ASC')
    .all(),
)

const featuredProjects = computed(() => projects.value ?? [])
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
  }),
])
</script>

<template>
  <div>
    <HomeHero
      :hero="site.hero"
      :cover="heroProject.cover"
      :cover-client="heroProject.client"
    />

    <HomeStats :stats="site.stats" />

    <HomeProjects :projects="featuredProjects" />

    <HomeServices :services="site.services" />

    <HomeProcess :steps="site.process" />

    <HomeAbout
      :about="site.about"
      :audiences="site.audiences"
      :pricing="site.pricing"
    />

    <HomeContact
      :cta="site.hero.primaryCta"
      :pricing="site.pricing"
      :contacts="site.contacts"
    />
  </div>
</template>
