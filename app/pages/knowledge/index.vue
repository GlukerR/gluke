<script setup lang="ts">
/* Хаб базы знаний: статьи сгруппированы по задачам читателя (разделы из
   `shared/knowledge.ts`), а не лентой по датам — это справочник, а не блог. */
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { knowledge: knowledgePath, article: articlePath, glossary: glossaryPath } = useSiteRoutes()
const { toAbsolute } = useSiteUrls()

const { data: articles } = await useAsyncData(
  computed(() => `knowledge-hub-${locale.value}`),
  () => queryLocalizedArticles(locale.value)
    .select('slug', 'title', 'summary', 'section', 'position', 'cover', 'cases')
    .all(),
)

const groups = computed(() => groupBySection(articles.value ?? []))

/* Картинка превью хаба — обложка первого кейса-примера первой статьи:
   отдельной обложки у раздела нет, а логотип в превью ничего не говорит. */
const { data: shareProject } = await useAsyncData(
  computed(() => `knowledge-hub-share-${locale.value}`),
  async () => {
    const first = groups.value[0]?.articles[0]
    const slug = first?.cases?.[0]
    const project = slug ? await queryLocalizedProject(locale.value, slug).select('cover').first() : null
    return project ?? await queryLocalizedProjects(locale.value).select('cover').first()
  },
)

const pageTitle = computed(() => t('seo.knowledgeTitle', { site: site.value.brand.name }))
const pageDescription = computed(() => t('seo.knowledgeDescription'))

usePageSeo({
  title: pageTitle,
  description: pageDescription,
  path: () => knowledgePath(),
  type: 'website',
  image: () => shareProject.value!.cover,
})

const itemListElements = computed(() => groups.value
  .flatMap(group => group.articles)
  .map((article, index) => defineListItem({
    position: index + 1,
    name: article.title,
    item: toAbsolute(articlePath(article.slug)),
  })))

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': () => pageTitle.value,
    'description': () => pageDescription.value,
    'inLanguage': () => locale.value,
  }),
  defineItemList({ itemListElement: itemListElements.value }),
])
</script>

<template>
  <section
    class="kb-hub"
    aria-labelledby="kb-hub-title"
  >
    <div class="site-container">
      <header class="kb-hub__header">
        <p class="text-label text-accent">
          {{ t('knowledge.eyebrow') }}
        </p>
        <h1
          id="kb-hub-title"
          class="text-heading kb-hub__title"
        >
          {{ t('knowledge.title') }}
        </h1>
        <p class="kb-hub__intro">
          {{ t('knowledge.intro') }}
        </p>
      </header>

      <section
        v-for="group in groups"
        :id="group.section"
        :key="group.section"
        class="kb-hub__section site-anchor"
        :aria-labelledby="`kb-section-${group.section}`"
      >
        <div class="kb-hub__section-head">
          <h2
            :id="`kb-section-${group.section}`"
            class="text-heading text-heading--md"
          >
            {{ t(`knowledge.sections.${group.section}.title`) }}
          </h2>
          <p class="kb-hub__section-description text-body--sm">
            {{ t(`knowledge.sections.${group.section}.description`) }}
          </p>
        </div>

        <ul class="kb-hub__grid">
          <li
            v-for="article in group.articles"
            :key="article.slug"
          >
            <KnowledgeArticleCard
              :article="article"
              :show-section="false"
            />
          </li>
        </ul>
      </section>

      <!-- Глоссарий — в конце хаба: сначала статьи, потом справочник. -->
      <NuxtLink
        :to="glossaryPath()"
        class="kb-hub__glossary"
      >
        <span class="text-label text-accent">{{ t('knowledge.glossary.link') }}</span>
        <span class="text-body--sm kb-hub__glossary-hint">{{ t('knowledge.glossary.linkHint') }}</span>
        <span
          aria-hidden="true"
          class="kb-hub__glossary-arrow"
        >→</span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.kb-hub {
  padding-block: clamp(40px, 6vw, 96px) var(--site-section-space);
}

.kb-hub__title {
  max-width: 20ch;
  margin-block-start: 14px;
  color: var(--site-text);
}

.kb-hub__intro {
  max-width: 64ch;
  margin-block-start: 20px;
  color: var(--site-text-secondary);
}

.kb-hub__glossary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 16px;
  align-items: center;
  max-width: 64ch;
  margin-block-start: clamp(48px, 6vw, 88px);
  padding: 16px 20px;
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  background-color: var(--site-surface);
  transition: border-color 150ms ease;
}

.kb-hub__glossary:hover {
  border-color: var(--site-accent);
}

.kb-hub__glossary-hint {
  grid-column: 1;
  color: var(--site-text-secondary);
}

.kb-hub__glossary-arrow {
  grid-row: 1 / span 2;
  grid-column: 2;
  color: var(--site-accent-text);
  font-size: 1.25rem;
}

.kb-hub__section {
  margin-block-start: clamp(48px, 6vw, 88px);
  padding-block-start: clamp(20px, 2.4vw, 28px);
  border-block-start: var(--site-border);
}

.kb-hub__section-head {
  display: grid;
  gap: 8px;
}

.kb-hub__section-description {
  max-width: 56ch;
  color: var(--site-text-muted);
}

.kb-hub__grid {
  display: grid;
  gap: 20px;
  margin-block-start: clamp(20px, 2.4vw, 32px);
}

@media (min-width: 768px) {
  .kb-hub__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .kb-hub__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
