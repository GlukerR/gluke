<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

defineProps<{
  about: SiteCollectionItem['about']
  audiences: SiteCollectionItem['audiences']
  pricing: SiteCollectionItem['pricing']
}>()
</script>

<template>
  <section
    id="about"
    class="site-section site-anchor"
    aria-labelledby="home-about-title"
  >
    <div class="site-container home-about__inner">
      <HomeSectionHeader
        eyebrow="О СТУДИИ"
        :title="about.title"
        title-id="home-about-title"
      />

      <div class="home-about__grid">
        <div class="home-about__lead">
          <p class="text-heading text-heading--sm home-about__description">
            {{ about.description }}
          </p>

          <div class="home-about__team">
            <h3 class="text-label text-dimmed">
              Команда
            </h3>
            <p class="text-body home-about__team-text">
              {{ about.team }}
            </p>
          </div>
        </div>

        <div class="home-about__side">
          <div class="home-about__audiences">
            <h3 class="text-label text-dimmed">
              Для кого работаем
            </h3>
            <ul class="home-about__tags">
              <li
                v-for="audience in audiences"
                :key="audience"
                class="home-about__tag text-body--sm"
              >
                {{ audience }}
              </li>
            </ul>
          </div>

          <div class="home-about__pricing">
            <h3 class="text-label text-dimmed">
              Стоимость
            </h3>
            <p class="text-heading text-heading--sm home-about__pricing-summary">
              {{ pricing.summary }}
            </p>
            <p class="text-body--sm home-about__pricing-note">
              {{ pricing.note }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-about__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 56px);
}

.home-about__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(32px, 4vw, 64px);
}

.home-about__lead,
.home-about__side {
  display: flex;
  flex-direction: column;
  gap: clamp(24px, 3vw, 40px);
  min-width: 0;
}

.home-about__description {
  max-width: 44ch;
  color: var(--site-text);
  font-weight: 400;
}

.home-about__team {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: clamp(20px, 2vw, 28px);
  border-top: var(--site-border);
}

.home-about__team-text {
  max-width: 52ch;
  color: var(--site-text-secondary);
}

.home-about__audiences,
.home-about__pricing {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.home-about__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.home-about__tag {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border: var(--site-border);
  border-radius: 999px;
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.home-about__pricing {
  padding: clamp(20px, 2.5vw, 32px);
  border: var(--site-border);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-surface);
}

.home-about__pricing-summary {
  color: var(--site-text);
  overflow-wrap: anywhere;
}

.home-about__pricing-note {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

@media (min-width: 1024px) {
  .home-about__grid {
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.9fr);
    align-items: start;
  }
}
</style>
