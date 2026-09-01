<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

const props = defineProps<{ project: ProjectsCollectionItem }>()

const { t } = useI18n()

/* Тело кейса необязательно: у части проектов под frontmatter пусто. Пустой
   `body.value` дал бы раскрывашку без содержимого — её лучше не рисовать. */
const hasStory = computed(() => Boolean(props.project.body?.value?.length))
</script>

<template>
  <section
    v-if="hasStory"
    class="project-story"
  >
    <div class="site-container">
      <!-- Свёрнуто намеренно: подробности читает тот, кому они нужны, а
           страница остаётся короткой. Текст при этом лежит в HTML, поэтому
           доступен и поиску, и скринридеру. -->
      <details class="project-story__details">
        <summary class="project-story__summary text-heading text-heading--sm">
          {{ t('project.story') }}
        </summary>

        <div class="project-story__prose">
          <!-- `prose: false` — обычные HTML-теги вместо Prose-компонентов Nuxt
               UI: те тянут свою типографику и якорь-решётку в каждый заголовок,
               а тексту кейса нужна типографика сайта. -->
          <ContentRenderer
            :value="props.project"
            :prose="false"
          />
        </div>
      </details>
    </div>
  </section>
</template>

<style scoped>
.project-story {
  padding-block: var(--project-space, clamp(28px, 3.2vw, 56px));
}

.project-story__details {
  border-block: var(--site-border);
}

/* Раскрывашка повторяет поведение блока вопросов на главной: маркер убран,
   вместо него «+», который поворачивается в «×» в открытом состоянии. */
.project-story__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding-block: clamp(16px, 2vw, 24px);
  color: var(--site-text);
  cursor: pointer;
  list-style: none;
}

.project-story__summary::-webkit-details-marker {
  display: none;
}

.project-story__summary::after {
  content: '+';
  flex-shrink: 0;
  color: var(--site-text-secondary);
  font-size: 1.25em;
  line-height: 1;
  transition: transform 150ms ease;
}

.project-story__details[open] .project-story__summary::after {
  transform: rotate(45deg);
}

/* Разметку внутри готовит ContentRenderer, поэтому типографика задаётся через
   :deep() — шкала повторяет text-heading / text-body, чтобы текст кейса
   читался так же, как остальные блоки страницы. */
.project-story__prose {
  max-width: 68ch;
  padding-block-end: clamp(24px, 3vw, 40px);
}

.project-story__prose :deep(h2) {
  margin-block-start: clamp(24px, 2.6vw, 36px);
  color: var(--site-text);
  font-size: clamp(1rem, 0.92rem + 0.35vw, 1.175rem);
  font-weight: 500;
  line-height: 1.3;
  text-wrap: balance;
}

.project-story__prose :deep(h2:first-child) {
  margin-block-start: 0;
}

.project-story__prose :deep(p),
.project-story__prose :deep(li) {
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.project-story__prose :deep(p) {
  margin-block-start: 14px;
}

.project-story__prose :deep(ul),
.project-story__prose :deep(ol) {
  margin-block-start: 14px;
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
