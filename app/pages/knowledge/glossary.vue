<script setup lang="ts">
/* Глоссарий базы знаний: термин — определение в 1–2 предложения — ссылка на
   статью, где он раскрыт. У каждого термина свой якорь (`#lod`), на него
   ссылаются статьи. Для поиска и ассистентов страница размечена как
   DefinedTermSet, а для агентов есть та же страница чистым markdown
   (`<url>.md`, собирает scripts/generate-llms.mjs).

   Статический маршрут `knowledge/glossary` перекрывает `knowledge/[slug]`,
   поэтому статьи со slug `glossary` быть не может — это проверяет
   `pnpm validate:content`. */
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { home, knowledge: knowledgePath, article: articlePath, glossary: glossaryPath } = useSiteRoutes()
const { toAbsolute, toCanonical } = useSiteUrls()

const { data } = await useAsyncData(
  computed(() => `knowledge-glossary-${locale.value}`),
  async () => {
    const [glossary, articles, project] = await Promise.all([
      queryLocalizedGlossary(locale.value).first(),
      queryLocalizedArticles(locale.value).select('slug', 'title').all(),
      queryLocalizedProjects(locale.value).select('cover').first(),
    ])

    return { glossary, articles, project }
  },
)

if (!data.value?.glossary) {
  throw createError({ statusCode: 404, statusMessage: t('errors.articleNotFound'), fatal: true })
}

const glossary = computed(() => data.value?.glossary)
const terms = computed(() => glossary.value?.terms ?? [])
const groups = computed(() => groupByLetter(terms.value, locale.value))
const articleTitles = computed(() => new Map((data.value?.articles ?? []).map(article => [article.slug, article.title])))

/* Якорь группы: буква как есть (id в HTML может быть кириллическим),
   группа терминов не с буквы — `letter-0`. */
const letterId = (letter: string) => `letter-${letter === '#' ? '0' : letter}`

const pageTitle = computed(() => t('seo.glossaryTitle', { site: site.value.brand.name }))
const pageDescription = computed(() => t('seo.glossaryDescription'))
const canonicalUrl = computed(() => toCanonical(glossaryPath()))
const markdownUrl = computed(() => `${canonicalUrl.value}.md`)

usePageSeo({
  title: pageTitle,
  description: pageDescription,
  path: () => glossaryPath(),
  type: 'website',
  image: () => data.value!.project!.cover,
})

useHead({
  link: [
    {
      rel: 'alternate',
      type: 'text/markdown',
      href: () => markdownUrl.value,
    },
  ],
})

/* DefinedTerm у каждого термина: определение — `description`, адрес —
   якорь на этой странице, подробная статья — `subjectOf`. */
const definedTerms = computed(() => terms.value.map(term => ({
  '@type': 'DefinedTerm',
  '@id': `${canonicalUrl.value}#${term.id}`,
  'name': term.term,
  ...(term.aka?.length ? { alternateName: term.aka } : {}),
  'description': term.definition,
  'url': `${canonicalUrl.value}#${term.id}`,
  'inDefinedTermSet': { '@id': `${canonicalUrl.value}#termset` },
  ...(term.article ? { subjectOf: { '@id': `${toCanonical(articlePath(term.article))}#article` } } : {}),
})))

useSchemaOrg([
  defineWebPage({
    '@id': () => `${canonicalUrl.value}#webpage`,
    'url': () => canonicalUrl.value,
    'name': () => pageTitle.value,
    'description': () => pageDescription.value,
    'inLanguage': () => locale.value,
  }),
  {
    '@id': () => `${canonicalUrl.value}#termset`,
    '@type': 'DefinedTermSet',
    'name': () => glossary.value?.title ?? '',
    'description': () => pageDescription.value,
    'url': () => canonicalUrl.value,
    'inLanguage': () => locale.value,
    'hasDefinedTerm': () => definedTerms.value,
  },
  defineBreadcrumb({
    '@id': () => `${canonicalUrl.value}#breadcrumb`,
    'itemListElement': [
      defineListItem({ name: () => t('breadcrumb.home'), item: () => toAbsolute(home()) }),
      defineListItem({ name: () => t('breadcrumb.knowledge'), item: () => toAbsolute(knowledgePath()) }),
      defineListItem({ name: () => t('breadcrumb.glossary') }),
    ],
  }),
])
</script>

<template>
  <section
    class="kb-glossary"
    aria-labelledby="kb-glossary-title"
  >
    <div class="site-container">
      <NuxtLink
        :to="knowledgePath()"
        class="kb-glossary__back text-body--sm"
      >
        <span aria-hidden="true">←</span>
        <span>{{ t('knowledge.back') }}</span>
      </NuxtLink>

      <header class="kb-glossary__header">
        <p class="text-label text-accent">
          {{ t('knowledge.glossary.eyebrow') }}
        </p>
        <h1
          id="kb-glossary-title"
          class="text-heading kb-glossary__title"
        >
          {{ glossary?.title }}
        </h1>
        <p class="kb-glossary__intro">
          {{ glossary?.intro }}
        </p>
      </header>

      <nav
        class="kb-glossary__letters"
        :aria-label="t('knowledge.glossary.letters')"
      >
        <a
          v-for="group in groups"
          :key="group.letter"
          :href="`#${letterId(group.letter)}`"
        >{{ group.letter }}</a>
      </nav>

      <section
        v-for="group in groups"
        :id="letterId(group.letter)"
        :key="group.letter"
        class="kb-glossary__group site-anchor"
        :aria-labelledby="`${letterId(group.letter)}-title`"
      >
        <h2
          :id="`${letterId(group.letter)}-title`"
          class="kb-glossary__letter"
        >
          {{ group.letter }}
        </h2>

        <dl class="kb-glossary__terms">
          <div
            v-for="term in group.terms"
            :id="term.id"
            :key="term.id"
            class="kb-glossary__term site-anchor"
          >
            <dt>
              <span class="kb-glossary__name">{{ term.term }}</span>
              <span
                v-if="term.aka?.length"
                class="kb-glossary__aka text-body--sm"
              >{{ t('knowledge.glossary.aka', { names: term.aka.join(', ') }) }}</span>
            </dt>
            <dd>
              <p class="kb-glossary__definition">
                {{ term.definition }}
              </p>
              <NuxtLink
                v-if="term.article && articleTitles.get(term.article)"
                :to="articlePath(term.article)"
                class="kb-glossary__more text-body--sm"
              >
                {{ t('knowledge.glossary.more') }}: {{ articleTitles.get(term.article) }}
                <span aria-hidden="true">→</span>
              </NuxtLink>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </section>
</template>

<style scoped>
.kb-glossary {
  padding-block: clamp(16px, 2vw, 24px) var(--site-section-space);
}

.kb-glossary__back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--site-text-secondary);
  transition: color 150ms ease;
}

.kb-glossary__back:hover {
  color: var(--site-accent-text);
}

.kb-glossary__header {
  padding-block: clamp(16px, 2.4vw, 32px) 0;
}

.kb-glossary__title {
  max-width: 20ch;
  margin-block-start: 14px;
  color: var(--site-text);
}

.kb-glossary__intro {
  max-width: 64ch;
  margin-block-start: 20px;
  color: var(--site-text-secondary);
}

/* Указатель букв: строка ссылок-плашек, переносится на узком экране.
   Липким не делаем — на телефоне он съел бы пол-экрана. */
.kb-glossary__letters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-block-start: clamp(28px, 3.2vw, 44px);
}

.kb-glossary__letters a {
  display: grid;
  place-items: center;
  min-width: 40px;
  min-height: 40px;
  padding-inline: 8px;
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  color: var(--site-text-secondary);
  font-weight: 600;
  transition: color 150ms ease, border-color 150ms ease;
}

.kb-glossary__letters a:hover {
  border-color: var(--site-accent);
  color: var(--site-accent-text);
}

/* Группа буквы: на широком экране буква — колонка слева, термины справа,
   как в словаре; на узком буква стоит над терминами. */
.kb-glossary__group {
  display: grid;
  gap: 8px;
  margin-block-start: clamp(32px, 4vw, 56px);
  padding-block-start: clamp(16px, 2vw, 24px);
  border-block-start: var(--site-border);
}

@media (min-width: 900px) {
  .kb-glossary__group {
    grid-template-columns: 120px minmax(0, 1fr);
  }
}

.kb-glossary__letter {
  color: var(--site-accent-text);
  font-size: var(--type-h2);
  font-weight: 600;
  line-height: 1;
}

.kb-glossary__terms {
  display: grid;
  gap: clamp(20px, 2.4vw, 28px);
  max-width: 72ch;
}

/* Термин, на который пришли по ссылке из статьи, подсвечен: иначе среди
   соседей его приходится искать глазами. */
.kb-glossary__term {
  margin-inline: -14px;
  padding: 10px 14px;
  border-radius: var(--site-radius-md);
  transition: background-color 300ms ease;
}

.kb-glossary__term:target {
  background-color: var(--kb-soft);
}

.kb-glossary__term dt {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.kb-glossary__name {
  color: var(--site-text);
  font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.25rem);
  font-weight: 600;
}

.kb-glossary__aka {
  color: var(--site-text-muted);
}

.kb-glossary__definition {
  margin-block-start: 6px;
  color: var(--site-text-secondary);
}

.kb-glossary__more {
  display: inline-block;
  margin-block-start: 8px;
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.kb-glossary__more:hover {
  color: var(--site-accent-text-hover);
}
</style>
