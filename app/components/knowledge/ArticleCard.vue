<script setup lang="ts">
import type { KnowledgeSection } from '#shared/knowledge'

/* Карточка статьи: на хабе и в блоке «Читать дальше». Вся карточка —
   одна ссылка, а не заголовок плюс отдельная кнопка: так у скринридера
   один пункт на статью. */
const props = withDefaults(defineProps<{
  article: { slug: string, title: string, summary: string, section: KnowledgeSection }
  showSection?: boolean
}>(), { showSection: true })

const { t } = useI18n()
const { article: articlePath } = useSiteRoutes()
</script>

<template>
  <NuxtLink
    :to="articlePath(props.article.slug)"
    class="kb-card"
  >
    <span
      v-if="props.showSection"
      class="text-label kb-card__section"
    >{{ t(`knowledge.sections.${props.article.section}.title`) }}</span>
    <span class="kb-card__title">{{ props.article.title }}</span>
    <span class="kb-card__summary text-body--sm">{{ props.article.summary }}</span>
    <span class="kb-card__more text-body--sm">
      {{ t('knowledge.read') }}
      <span aria-hidden="true">→</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.kb-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: clamp(20px, 2.4vw, 28px);
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  background-color: var(--site-surface);
  transition: border-color 150ms ease, background-color 150ms ease;
}

.kb-card:hover {
  border-color: var(--site-accent);
}

.kb-card__section {
  color: var(--site-accent-text);
}

.kb-card__title {
  color: var(--site-text);
  font-size: var(--type-h3);
  font-weight: 600;
  letter-spacing: var(--type-h3-tracking);
  line-height: var(--type-h3-leading);
  text-wrap: balance;
}

.kb-card__summary {
  display: -webkit-box;
  overflow: hidden;
  color: var(--site-text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.kb-card__more {
  display: inline-flex;
  gap: 8px;
  margin-block-start: auto;
  padding-block-start: 4px;
  color: var(--site-accent-text);
}
</style>
