<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

defineProps<{ stats: SiteCollectionItem['stats'] }>()
</script>

<template>
  <section
    class="home-stats"
    aria-labelledby="home-stats-title"
  >
    <div class="site-container">
      <h2
        id="home-stats-title"
        class="sr-only"
      >
        Опыт студии в цифрах
      </h2>

      <dl class="home-stats__list">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="home-stats__item"
        >
          <dt class="home-stats__label text-body--sm">
            {{ stat.label }}
          </dt>
          <dd class="home-stats__value text-heading">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.home-stats {
  padding-block: clamp(40px, 5vw, 72px);
  border-block: var(--site-border);
  background-color: var(--site-surface);
}

.home-stats__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(24px, 3vw, 40px);
}

.home-stats__item {
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  min-width: 0;
}

.home-stats__value {
  font-size: var(--type-h2);
  line-height: var(--type-h2-leading);
  letter-spacing: var(--type-h2-tracking);
  color: var(--site-text);
  overflow-wrap: anywhere;
}

.home-stats__label {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

@media (min-width: 768px) {
  .home-stats__list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .home-stats__item + .home-stats__item {
    padding-inline-start: clamp(16px, 2vw, 32px);
    border-inline-start: var(--site-border);
  }
}
</style>
