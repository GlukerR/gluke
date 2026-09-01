<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

const props = defineProps<{ project: ProjectsCollectionItem }>()

const { t } = useI18n()

/* Тело кейса необязательно: у части проектов под frontmatter пусто. Пустой
   `body.value` даёт пустую секцию с одним заголовком — её лучше не рисовать. */
const hasStory = computed(() => Boolean(props.project.body?.value?.length))
</script>

<template>
  <section
    v-if="hasStory"
    class="project-story"
    aria-labelledby="project-story-title"
  >
    <div class="site-container project-story__inner">
      <h2
        id="project-story-title"
        class="sr-only"
      >
        {{ t('project.storySrTitle') }}
      </h2>

      <div class="project-story__prose">
        <!-- `prose: false` — обычные HTML-теги вместо Prose-компонентов Nuxt UI:
             те тянут свою типографику (text-2xl, font-bold) и якорь-решётку в
             каждый заголовок, а тексту кейса нужна типографика сайта. -->
        <ContentRenderer
          :value="props.project"
          :prose="false"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.project-story {
  padding-block: var(--project-space, clamp(28px, 3.2vw, 56px));
}

.project-story__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(24px, 3vw, 40px);
}

/* Разметку внутри готовит ContentRenderer, поэтому типографика задаётся через
   :deep() — селекторы повторяют шкалу из text-heading / text-body, чтобы текст
   кейса читался так же, как остальные блоки страницы. */
.project-story__prose {
  max-width: 68ch;
}

.project-story__prose :deep(h2) {
  margin-block-start: clamp(28px, 3vw, 44px);
  color: var(--site-text);
  font-size: clamp(1.125rem, 0.95rem + 0.7vw, 1.5rem);
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.project-story__prose :deep(h2:first-child) {
  margin-block-start: 0;
}

.project-story__prose :deep(h3) {
  margin-block-start: clamp(20px, 2vw, 28px);
  color: var(--site-text);
  font-size: clamp(1rem, 0.92rem + 0.35vw, 1.175rem);
  font-weight: 500;
  line-height: 1.3;
}

.project-story__prose :deep(p),
.project-story__prose :deep(li) {
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.project-story__prose :deep(p) {
  margin-block-start: 16px;
}

.project-story__prose :deep(ul),
.project-story__prose :deep(ol) {
  margin-block-start: 16px;
  padding-inline-start: 20px;
  list-style: outside;
}

.project-story__prose :deep(ul) {
  list-style-type: disc;
}

.project-story__prose :deep(li + li) {
  margin-block-start: 8px;
}

.project-story__prose :deep(strong) {
  color: var(--site-text);
  font-weight: 500;
}

.project-story__prose :deep(a) {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.project-story__prose :deep(a:hover) {
  color: var(--site-accent-text-hover);
}
</style>
