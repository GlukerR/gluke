<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

const props = defineProps<{ steps: SiteCollectionItem['process'] }>()

// Копия массива: исходные данные контента не мутируются.
const orderedSteps = computed(() => [...props.steps].sort((a, b) => a.position - b.position))
</script>

<template>
  <section
    id="process"
    class="site-section site-anchor home-process"
    aria-labelledby="home-process-title"
  >
    <div class="site-container home-process__inner">
      <HomeSectionHeader
        eyebrow="ПРОЦЕСС"
        title="Понятный путь от исходников до результата"
        title-id="home-process-title"
      />

      <ol class="home-process__steps">
        <li
          v-for="step in orderedSteps"
          :key="step.position"
          class="home-process__step"
        >
          <span class="home-process__marker text-label">{{ step.position }}</span>

          <h3 class="text-heading text-heading--sm home-process__title">
            {{ step.title }}
          </h3>

          <p class="text-body--sm home-process__description">
            {{ step.description }}
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.home-process {
  background-color: var(--site-surface);
  border-block: var(--site-border);
}

.home-process__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 56px);
}

.home-process__steps {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(20px, 3vw, 32px);
}

.home-process__step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-inline-start: 56px;
}

.home-process__marker {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: var(--site-border);
  border-radius: 999px;
  background-color: var(--site-bg);
  color: var(--site-accent);
  letter-spacing: 0;
}

/* Вертикальная связь между шагами на мобильном. */
.home-process__step:not(:last-child)::before {
  content: '';
  position: absolute;
  inset-inline-start: 20px;
  inset-block: 44px calc(-1 * clamp(20px, 3vw, 32px));
  width: 1px;
  background-color: var(--site-border-color);
}

.home-process__title {
  color: var(--site-text);
  text-wrap: balance;
}

.home-process__description {
  max-width: 46ch;
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

@media (min-width: 1024px) {
  .home-process__steps {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: clamp(20px, 2vw, 32px);
  }

  .home-process__step {
    padding-inline-start: 0;
    padding-top: 60px;
  }

  /* Общая горизонтальная линия этапов. */
  .home-process__step::after {
    content: '';
    position: absolute;
    inset-block-start: 20px;
    inset-inline: 0 calc(-1 * clamp(20px, 2vw, 32px));
    height: 1px;
    background-color: var(--site-border-color);
  }

  .home-process__step:last-child::after {
    inset-inline-end: 0;
  }

  .home-process__step:not(:last-child)::before {
    content: none;
  }
}
</style>
