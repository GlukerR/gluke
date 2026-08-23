<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

const props = defineProps<{
  hero: SiteCollectionItem['hero']
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
        <p class="text-label text-accent">
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
        </div>
      </div>

      <div class="home-hero__visual">
        <HomeGlukeLogo3D
          src="/media/brand/radial-pneumatic-engine.glb"
          class="home-hero__3d"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  position: relative;
  /* Высота hero задаёт диапазон скролла для раскрытия модели: пока секция
     «приколота» к верху вьюпорта (180vh − 100vh = 80vh прокрутки), скролл
     водит анимацией; только когда hero уезжает — листается остальной сайт.
     Та же схема, что в референсе exploded-view, но короче — анимация
     раскрывается быстрее, без длинной «пустой» прокрутки. */
  height: 180vh;
  isolation: isolate;
  /* Нельзя ставить overflow (hidden/clip/auto/scroll): sticky-стакан внутри
     hero перестанет липнуть к верху вьюпорта, а скролл-анимация раскрытия
     сломается. Свечение ограничено рамками своего псевдоэлемента. */
}

/* Single calm accent glow, built from the semantic accent token only. */
.home-hero::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset-block-start: 0;
  inset-inline-end: 0;
  width: min(760px, 100%);
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
  /* Sticky-стакан на весь вьюпорт: hero держится на месте, пока модель
     раскрывается, затем уезжает вместе с прокруткой. */
  position: sticky;
  top: 0;
  height: 100vh;
  display: grid;
  gap: clamp(32px, 5vw, 56px);
  align-items: center;
  padding-block: clamp(48px, 7vw, 112px);
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

.home-hero__3d {
  display: block;
}

/* На десктопе колонка модели растягивается на всю высоту hero-секции:
   фрейм рендера выходит вверх и вниз за границы текстовой колонки. */
@media (min-width: 1024px) {
  .home-hero__inner {
    align-items: stretch;
  }

  .home-hero__visual {
    align-self: stretch;
  }
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
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
    gap: clamp(40px, 4vw, 72px);
  }

  .home-hero__title {
    /* Flatter slope than `--type-display` so the headline scales with the
       narrower hero column instead of the full viewport. */
    font-size: clamp(2.75rem, 4vw, 3.75rem);
    max-width: 12em;
  }
}
</style>
