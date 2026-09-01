<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

const props = defineProps<{ faq: SiteCollectionItem['faq'] }>()

const { t } = useI18n()
</script>

<template>
  <section
    id="faq"
    class="site-section site-anchor home-faq"
    aria-labelledby="home-faq-title"
  >
    <div class="site-container home-faq__inner">
      <HomeSectionHeader
        :eyebrow="t('home.faq.eyebrow')"
        :title="t('home.faq.title')"
        title-id="home-faq-title"
      />

      <div class="home-faq__list">
        <details
          v-for="(item, index) in props.faq"
          :key="index"
          class="home-faq__item"
        >
          <summary class="home-faq__question text-heading text-heading--sm">
            {{ item.question }}
          </summary>

          <p class="text-body--sm home-faq__answer">
            {{ item.answer }}
          </p>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-faq {
  background-color: var(--site-surface);
  border-block: var(--site-border);
}

.home-faq__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 56px);
}

.home-faq__list {
  display: flex;
  flex-direction: column;
}

.home-faq__item {
  border-bottom: var(--site-border);
}

.home-faq__item:first-child {
  border-block-start: var(--site-border);
}

.home-faq__question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding-block: clamp(16px, 2vw, 24px);
  cursor: pointer;
  list-style: none;
}

.home-faq__question::-webkit-details-marker {
  display: none;
}

.home-faq__question::after {
  content: '+';
  flex-shrink: 0;
  color: var(--site-text-secondary);
  font-size: 1.25em;
  line-height: 1;
  transition: transform 150ms ease;
}

.home-faq__item[open] .home-faq__question::after {
  transform: rotate(45deg);
}

.home-faq__answer {
  padding-block-end: clamp(16px, 2vw, 24px);
  max-width: 62ch;
  color: var(--site-text-secondary);
}
</style>
