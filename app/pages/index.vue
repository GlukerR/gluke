<script setup lang="ts">
const site = useSiteContent()

const { data: projects } = await useAsyncData('home-featured-projects', () => queryCollection('projects')
  .where('status', '=', 'published')
  .where('featured', '=', true)
  .order('position', 'ASC')
  .all())

const featuredProjects = projects.value ?? []
const heroProject = featuredProjects[0]

if (!heroProject) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Опубликованные избранные проекты не найдены',
    fatal: true,
  })
}

const pageTitle = `${site.brand.name} — ${site.hero.title}`

useSeoMeta({
  title: pageTitle,
  description: site.hero.description,
  ogTitle: pageTitle,
  ogDescription: site.hero.description,
  ogType: 'website',
})
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
