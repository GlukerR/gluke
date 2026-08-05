<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

defineProps<{ services: SiteCollectionItem['services'] }>()

function formatIndex(index: number): string {
  return String(index + 1).padStart(2, '0')
}
</script>

<template>
  <section
    id="services"
    class="site-section site-anchor"
    aria-labelledby="home-services-title"
  >
    <div class="site-container home-services__inner">
      <HomeSectionHeader
        eyebrow="УСЛУГИ"
        title="От модели до готовых материалов"
        title-id="home-services-title"
      />

      <ul class="home-services__list">
        <li
          v-for="(service, index) in services"
          :key="service.id"
          class="home-services__item"
        >
          <p
            class="home-services__number text-label"
            aria-hidden="true"
          >
            {{ formatIndex(index) }}
          </p>

          <h3 class="text-heading text-heading--sm home-services__title">
            {{ service.title }}
          </h3>

          <p class="text-body--sm home-services__description">
            {{ service.description }}
          </p>

          <p class="text-body--sm home-services__proof">
            <span class="text-label home-services__proof-label">Где применяли</span>
            <span>{{ service.proof }}</span>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.home-services__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 56px);
}

.home-services__list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  border-top: var(--site-border);
}

.home-services__item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-block: clamp(24px, 3vw, 36px);
  border-bottom: var(--site-border);
}

.home-services__number {
  color: var(--site-accent);
}

.home-services__title {
  color: var(--site-text);
  text-wrap: balance;
}

.home-services__description {
  max-width: 52ch;
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.home-services__proof {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

.home-services__proof-label {
  color: var(--site-text-muted);
}

@media (min-width: 768px) {
  .home-services__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(24px, 4vw, 64px);
  }
}

@media (min-width: 1280px) {
  .home-services__list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
