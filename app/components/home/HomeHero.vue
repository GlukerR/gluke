<script setup lang="ts">
import type { ProjectsCollectionItem, SiteCollectionItem } from '@nuxt/content'

const props = defineProps<{
  hero: SiteCollectionItem['hero']
  cover: ProjectsCollectionItem['cover']
  coverClient: string
}>()

const isExternal = computed(() => props.hero.primaryCta.href.startsWith('https://'))
</script>

<template>
  <section
    class="home-hero"
    aria-labelledby="home-hero-title"
  >
    <div class="site-container home-hero__inner">
      <div class="home-hero__text">
        <p class="text-label text-primary">
          {{ hero.eyebrow }}
        </p>

        <h1
          id="home-hero-title"
          class="text-display text-highlighted home-hero__title"
        >
          {{ hero.title }}
        </h1>

        <p class="text-body home-hero__description">
          {{ hero.description }}
        </p>

        <div class="home-hero__actions">
          <UButton
            :to="hero.primaryCta.href"
            :target="isExternal ? '_blank' : undefined"
            :rel="isExternal ? 'noopener noreferrer' : undefined"
            color="primary"
            size="xl"
            class="home-hero__cta"
          >
            {{ hero.primaryCta.label }}
          </UButton>

          <UButton
            :to="hero.secondaryCta.href"
            color="neutral"
            variant="outline"
            size="xl"
            class="home-hero__cta"
          >
            {{ hero.secondaryCta.label }}
          </UButton>
        </div>
      </div>

      <div class="home-hero__visual">
        <NuxtPicture
          :src="cover.src"
          :alt="cover.alt"
          :width="cover.width"
          :height="cover.height"
          sizes="100vw lg:60vw xl:1100px"
          format="avif,webp"
          loading="eager"
          decoding="async"
          preload
          :img-attrs="{ class: 'home-hero__image', fetchpriority: 'high' }"
          class="home-hero__picture"
        />
        <p class="text-label text-dimmed home-hero__caption">
          {{ coverClient }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  position: relative;
  padding-block: clamp(48px, 7vw, 112px) clamp(56px, 8vw, 128px);
  isolation: isolate;
  /* `clip` keeps the decorative glow inside the section without creating a scroll container. */
  overflow: clip;
}

/* Single calm accent glow, built from the semantic accent token only. */
.home-hero::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset-block-start: -12%;
  inset-inline-end: -10%;
  width: min(760px, 90%);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--site-accent) 12%, transparent) 0%,
    transparent 68%
  );
  pointer-events: none;
}

.home-hero__inner {
  display: grid;
  gap: clamp(32px, 5vw, 56px);
  align-items: center;
}

.home-hero__text {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.home-hero__title {
  max-width: 16ch;
  /* The hero title must wrap on spaces only: mid-word breaks are never acceptable
     here, unlike in contact strings and captions elsewhere on the site. */
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
}

.home-hero__description {
  max-width: 52ch;
  color: var(--site-text-secondary);
}

.home-hero__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.home-hero__cta {
  min-height: 52px;
  justify-content: center;
}

.home-hero__visual {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.home-hero__picture {
  display: block;
  overflow: hidden;
  border: var(--site-border);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-surface);
}

.home-hero__picture :deep(.home-hero__image) {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.home-hero__caption {
  overflow-wrap: anywhere;
}

@media (min-width: 640px) {
  .home-hero__actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
}

@media (min-width: 1024px) {
  .home-hero__inner {
    /* The text column stays wide enough for the longest word of the title
       (`3D-визуализация`), the visual column stays clearly larger. */
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.3fr);
    gap: clamp(40px, 4vw, 72px);
  }

  .home-hero__title {
    /* Flatter slope than `--type-display` so the headline scales with the
       narrower hero column instead of the full viewport. */
    font-size: clamp(2.75rem, 4vw, 3.75rem);
    max-width: 12em;
  }

  .home-hero__picture :deep(.home-hero__image) {
    aspect-ratio: 16 / 10;
  }
}
</style>
