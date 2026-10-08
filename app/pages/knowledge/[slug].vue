<script setup lang="ts">
/* Статья базы знаний. Устроена под три читателя сразу (KB_TEMPLATE.md §1):
   человеку — короткий ответ сверху, оглавление и схемы; поиску — Article
   с автором и датой; ИИ — та же статья чистым markdown по адресу `<url>.md`
   (собирает scripts/generate-llms.mjs), ссылка на него стоит в <head>. */
definePageMeta({
  key: route => String(('slug' in route.params ? route.params.slug : '') ?? ''),
  pageTransition: {
    name: 'page-fade',
    mode: 'out-in',
  },
})

const route = useRoute()
const site = useSiteContent()
const locale = useCurrentLocale()
const { t } = useI18n()
const { home, knowledge: knowledgePath, article: articlePath, glossary: glossaryPath } = useSiteRoutes()

const slug = computed(() => ('slug' in route.params ? route.params.slug : ''))

const { data } = await useAsyncData(
  computed(() => `knowledge-article-${locale.value}-${slug.value}`),
  async () => {
    const article = await queryLocalizedArticle(locale.value, slug.value).first()

    if (!article) {
      return null
    }

    const caseSlugs = article.cases ?? []
    const relatedSlugs = article.related ?? []

    const [cases, related] = await Promise.all([
      caseSlugs.length
        ? queryLocalizedProjects(locale.value).where('slug', 'IN', caseSlugs).all()
        : Promise.resolve([]),
      relatedSlugs.length
        ? queryLocalizedArticles(locale.value)
            .where('slug', 'IN', relatedSlugs)
            .select('slug', 'title', 'summary', 'section')
            .all()
        : Promise.resolve([]),
    ])

    /* Порядок карточек — как в frontmatter: автор статьи ставит главный
       пример первым. */
    const bySlug = <T extends { slug: string }>(items: T[], order: string[]) =>
      order.map(item => items.find(entry => entry.slug === item)).filter((entry): entry is T => Boolean(entry))

    return {
      article,
      cases: bySlug(cases, caseSlugs),
      related: bySlug(related, relatedSlugs),
    }
  },
)

function notFound() {
  return createError({
    statusCode: 404,
    statusMessage: t('errors.articleNotFound'),
    fatal: true,
  })
}

const initialData = data.value

if (!initialData) {
  throw notFound()
}

watch(data, (value) => {
  if (!value) {
    showError(notFound())
  }
})

const article = computed(() => data.value?.article ?? initialData.article)
const cases = computed(() => data.value?.cases ?? [])
const related = computed(() => data.value?.related ?? [])

const minutes = computed(() => readingMinutes(article.value.body?.value))

const language = computed(() => (locale.value === 'ru' ? 'ru-RU' : 'en-US'))
const updatedLabel = computed(() => {
  const updated = article.value.updated
  if (!updated) {
    return ''
  }
  /* Дата из frontmatter — календарный день без времени: форматируем в UTC,
     иначе западнее Гринвича она съехала бы на день назад. */
  const date = new Date(`${updated}T00:00:00Z`)
  return new Intl.DateTimeFormat(language.value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
})

/* Оглавление — только заголовки второго уровня: на них держится структура
   статьи, третий уровень в боковой колонке превращается в шум. */
const toc = computed(() => (article.value.body?.toc?.links ?? []).map(link => ({ id: link.id, text: link.text })))

const pageTitle = computed(() => t('seo.articleTitle', {
  title: article.value.title,
  site: site.value.brand.name,
}))

const { toAbsolute, toCanonical } = useSiteUrls()

const canonicalUrl = computed(() => toCanonical(articlePath(article.value.slug)))
const markdownUrl = computed(() => `${canonicalUrl.value}.md`)

/* Картинка для превью ссылки: своя обложка статьи, иначе обложка первого
   кейса-примера. Хотя бы одно из двух есть всегда — это проверяет
   `pnpm validate:content`. */
const shareImage = computed(() => article.value.cover ?? cases.value[0]?.cover ?? initialData.cases[0]!.cover)

usePageSeo({
  title: pageTitle,
  description: () => article.value.description,
  path: () => articlePath(article.value.slug),
  type: 'article',
  image: () => shareImage.value,
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

const homeUrl = computed(() => toAbsolute(home()))

useSchemaOrg([
  defineWebPage({
    '@id': () => `${canonicalUrl.value}#webpage`,
    'url': () => canonicalUrl.value,
    'name': () => pageTitle.value,
    'description': () => article.value.description,
    'inLanguage': () => locale.value,
    'primaryImageOfPage': () => toAbsolute(shareImage.value.src),
  }),
  {
    '@id': () => `${canonicalUrl.value}#article`,
    '@type': 'TechArticle',
    'headline': () => article.value.title,
    'description': () => article.value.description,
    /* Короткий ответ — то, что ассистенты цитируют чаще всего: отдаём его
       отдельным полем, а не только текстом страницы. */
    'abstract': () => article.value.summary,
    'url': () => canonicalUrl.value,
    'image': () => toAbsolute(shareImage.value.src),
    'inLanguage': () => locale.value,
    ...(article.value.updated ? { dateModified: () => article.value.updated } : {}),
    'author': { '@id': () => `${homeUrl.value}#person` },
    'publisher': { '@id': () => toAbsolute('#identity') },
    'mainEntityOfPage': { '@id': () => `${canonicalUrl.value}#webpage` },
    'encoding': {
      '@type': 'MediaObject',
      'encodingFormat': 'text/markdown',
      'contentUrl': () => markdownUrl.value,
    },
  },
  defineBreadcrumb({
    '@id': () => `${canonicalUrl.value}#breadcrumb`,
    'itemListElement': [
      defineListItem({ name: () => t('breadcrumb.home'), item: () => toAbsolute(home()) }),
      defineListItem({ name: () => t('breadcrumb.knowledge'), item: () => toAbsolute(knowledgePath()) }),
      defineListItem({ name: () => article.value.title }),
    ],
  }),
])
</script>

<template>
  <div
    v-if="data && article"
    class="kb-article"
  >
    <div class="site-container kb-article__back">
      <NuxtLink
        :to="knowledgePath()"
        class="kb-article__back-link text-body--sm"
      >
        <span aria-hidden="true">←</span>
        <span>{{ t('knowledge.back') }}</span>
      </NuxtLink>
    </div>

    <header class="site-container kb-article__header">
      <p class="text-label text-accent">
        {{ t(`knowledge.sections.${article.section}.title`) }}
      </p>
      <h1 class="text-heading kb-article__title">
        {{ article.title }}
      </h1>
      <p class="kb-article__meta text-body--sm">
        <span>{{ site.brand.founder }}</span>
        <span
          v-if="updatedLabel"
          aria-hidden="true"
        >·</span>
        <span v-if="updatedLabel">{{ t('knowledge.updated', { date: updatedLabel }) }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ t('knowledge.readingTime', { minutes }) }}</span>
      </p>

      <div class="kb-article__summary">
        <p class="text-label kb-article__summary-label">
          {{ t('knowledge.summary') }}
        </p>
        <p class="kb-article__summary-text">
          {{ article.summary }}
        </p>
        <p class="kb-article__audience text-body--sm">
          {{ t('knowledge.audience') }}:
          {{ article.audience.map(item => t(`knowledge.audiences.${item}`)).join(', ') }}
        </p>
      </div>
    </header>

    <div class="site-container kb-article__layout">
      <nav
        v-if="toc.length > 2"
        class="kb-article__toc"
        :aria-label="t('knowledge.toc')"
      >
        <p class="text-label kb-article__toc-title">
          {{ t('knowledge.toc') }}
        </p>
        <ol>
          <li
            v-for="link in toc"
            :key="link.id"
          >
            <a
              :href="`#${link.id}`"
              class="text-body--sm"
            >{{ link.text }}</a>
          </li>
        </ol>
        <NuxtLink
          :to="glossaryPath()"
          class="kb-article__glossary text-body--sm"
        >
          {{ t('knowledge.glossary.link') }} <span aria-hidden="true">→</span>
        </NuxtLink>
      </nav>

      <article class="kb-prose">
        <!-- `prose: false` — обычные теги вместо Prose-компонентов Nuxt UI,
             типографика статьи задана ниже (как у истории кейса). -->
        <ContentRenderer
          :value="article"
          :prose="false"
        />
      </article>
    </div>

    <section
      v-if="cases.length"
      class="site-container kb-article__block"
      aria-labelledby="kb-cases-title"
    >
      <h2
        id="kb-cases-title"
        class="text-heading text-heading--md"
      >
        {{ t('knowledge.cases') }}
      </h2>
      <ul class="kb-article__cases">
        <li
          v-for="project in cases"
          :key="project.slug"
        >
          <ProjectsProjectCard
            :project="project"
            sizes="100vw md:50vw xl:640px"
          />
        </li>
      </ul>
    </section>

    <section
      v-if="related.length"
      class="site-container kb-article__block"
      aria-labelledby="kb-related-title"
    >
      <h2
        id="kb-related-title"
        class="text-heading text-heading--md"
      >
        {{ t('knowledge.related') }}
      </h2>
      <ul class="kb-article__related">
        <li
          v-for="item in related"
          :key="item.slug"
        >
          <KnowledgeArticleCard :article="item" />
        </li>
      </ul>
    </section>

    <SiteContact
      :cta="site.hero.primaryCta"
      :pricing="site.pricing"
      :contacts="site.contacts"
      :spacing="'project'"
    />
  </div>
</template>

<style scoped>
.kb-article {
  --project-space: clamp(28px, 3.2vw, 56px);
  --project-space-edge: clamp(56px, 6.4vw, 104px);
}

.kb-article__back {
  padding-block: clamp(16px, 2vw, 24px) 0;
}

.kb-article__back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--site-text-secondary);
  transition: color 150ms ease;
}

.kb-article__back-link:hover {
  color: var(--site-accent-text);
}

.kb-article__header {
  padding-block: clamp(16px, 2.4vw, 32px) clamp(28px, 3.2vw, 48px);
}

.kb-article__title {
  max-width: 22ch;
  margin-block-start: 14px;
  color: var(--site-text);
}

.kb-article__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-block-start: 18px;
  color: var(--site-text-muted);
}

/* «Коротко»: ответ целиком, до любых подробностей. Выделен рамкой слева
   в фирменном цвете — это главный абзац страницы. */
.kb-article__summary {
  max-width: 72ch;
  margin-block-start: clamp(24px, 3vw, 36px);
  padding: clamp(18px, 2.4vw, 28px);
  border: var(--site-border);
  border-inline-start: 3px solid var(--site-accent);
  border-radius: var(--site-radius-md);
  background-color: var(--site-surface);
}

.kb-article__summary-label {
  color: var(--site-accent-text);
}

.kb-article__summary-text {
  margin-block-start: 10px;
  color: var(--site-text);
  font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.25rem);
  line-height: 1.55;
}

.kb-article__audience {
  margin-block-start: 14px;
  color: var(--site-text-muted);
}

.kb-article__layout {
  display: grid;
  gap: clamp(24px, 3vw, 40px);
}

/* Оглавление на широком экране — липкая колонка слева от текста, на узком —
   список перед статьёй. */
.kb-article__toc {
  align-self: start;
  padding-block: 4px;
}

.kb-article__toc-title {
  color: var(--site-text-muted);
}

.kb-article__toc ol {
  display: grid;
  gap: 2px;
  margin-block-start: 12px;
  counter-reset: toc;
}

.kb-article__toc li {
  counter-increment: toc;
}

.kb-article__toc a {
  display: flex;
  gap: 10px;
  padding-block: 6px;
  color: var(--site-text-secondary);
  transition: color 150ms ease;
}

.kb-article__toc li a::before {
  content: counter(toc, decimal-leading-zero);
  color: var(--site-text-muted);
  font-variant-numeric: tabular-nums;
}

.kb-article__toc a:hover {
  color: var(--site-accent-text);
}

/* Ссылка на глоссарий — под оглавлением, отделена от пунктов статьи. */
.kb-article__toc .kb-article__glossary {
  margin-block-start: 12px;
  padding-block-start: 14px;
  border-block-start: var(--site-border);
  color: var(--site-accent-text);
}

@media (min-width: 1100px) {
  .kb-article__layout {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .kb-article__toc {
    position: sticky;
    top: calc(var(--site-anchor-offset) + 8px);
  }
}

.kb-article__block {
  padding-block: var(--project-space) 0;
}

.kb-article__block + .kb-article__block {
  padding-block-start: var(--project-space-edge);
}

.kb-article__cases,
.kb-article__related {
  display: grid;
  gap: 20px;
  margin-block-start: clamp(20px, 2.4vw, 32px);
}

@media (min-width: 768px) {
  .kb-article__cases,
  .kb-article__related {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Типографика тела статьи. Разметку готовит ContentRenderer, поэтому
   :deep(). Шкала — та же, что у остальных текстов сайта. */
.kb-prose {
  max-width: 72ch;
  min-width: 0;
}

.kb-prose :deep(h2) {
  margin-block-start: clamp(36px, 4vw, 56px);
  color: var(--site-text);
  font-size: var(--type-h3);
  font-weight: 600;
  letter-spacing: var(--type-h3-tracking);
  line-height: var(--type-h3-leading);
  text-wrap: balance;
  scroll-margin-top: var(--site-anchor-offset);
}

.kb-prose :deep(h2:first-child) {
  margin-block-start: 0;
}

.kb-prose :deep(h3) {
  margin-block-start: 28px;
  color: var(--site-text);
  font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.2rem);
  font-weight: 600;
  scroll-margin-top: var(--site-anchor-offset);
}

.kb-prose :deep(h2 a),
.kb-prose :deep(h3 a) {
  color: inherit;
  text-decoration: none;
}

.kb-prose :deep(p),
.kb-prose :deep(li) {
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.kb-prose :deep(p) {
  margin-block-start: 16px;
}

.kb-prose :deep(ul),
.kb-prose :deep(ol) {
  margin-block-start: 16px;
  padding-inline-start: 22px;
  list-style: outside;
}

.kb-prose :deep(ul) {
  list-style-type: disc;
}

.kb-prose :deep(ol) {
  list-style-type: decimal;
}

.kb-prose :deep(li + li) {
  margin-block-start: 8px;
}

.kb-prose :deep(li::marker) {
  color: var(--site-accent-text);
}

.kb-prose :deep(strong) {
  color: var(--site-text);
  font-weight: 600;
}

.kb-prose :deep(a) {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.kb-prose :deep(a:hover) {
  color: var(--site-accent-text-hover);
}

/* Блок кода в статье — это шаблон, который копируют (ТЗ, чек-лист), а не
   код: моноширинный шрифт не нужен, нужна рамка и перенос строк. */
.kb-prose :deep(pre) {
  margin-block-start: 20px;
  padding: clamp(16px, 2vw, 22px);
  overflow-x: auto;
  border: var(--site-border);
  border-inline-start: 3px solid var(--site-accent);
  border-radius: var(--site-radius-md);
  background-color: var(--site-surface);
  color: var(--site-text);
  font-family: inherit;
  font-size: var(--type-small);
  line-height: 1.9;
  white-space: pre-wrap;
}

.kb-prose :deep(pre code) {
  font-family: inherit;
}

.kb-prose :deep(table) {
  display: block;
  width: 100%;
  margin-block-start: 20px;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: var(--type-small);
  line-height: var(--type-small-leading);
}

.kb-prose :deep(th),
.kb-prose :deep(td) {
  min-width: 120px;
  padding: 10px 14px 10px 0;
  border-bottom: var(--site-border);
  text-align: start;
  vertical-align: top;
}

.kb-prose :deep(th) {
  color: var(--site-text);
  font-weight: 600;
}

.kb-prose :deep(td) {
  color: var(--site-text-secondary);
}
</style>
