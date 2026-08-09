<script setup lang="ts">
const { t } = useI18n()
const locale = useCurrentLocale()

/* Ключ зависит от локали, поэтому переключение языка подтягивает новый
   глобальный контент без полной перезагрузки страницы. */
const { data } = await useAsyncData(
  computed(() => `site-singleton-${locale.value}`),
  () => queryLocalizedSite(locale.value).first(),
)

const initialSite = data.value

if (!initialSite) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Глобальный контент сайта недоступен',
    fatal: true,
  })
}

/* На время загрузки новой локали каркас показывает предыдущие данные
   вместо пустого экрана. */
const site = computed(() => data.value ?? initialSite)

provideSiteContent(site)

const { toAbsolute } = useSiteUrls()

/* Контакты ищутся по типизированному полю channel, а не по индексу.
   Набор каналов одинаков в обеих локалях, поэтому наличие ключей в графе
   определяется один раз, а значения остаются реактивными. */
const email = computed(() => site.value.contacts.find(contact => contact.channel === 'email')?.value ?? '')
const telephone = computed(() => site.value.contacts.find(contact => contact.channel === 'phone')?.value ?? '')
const telegramHref = computed(() => site.value.contacts.find(contact => contact.channel === 'telegram')?.href)
const kworkHref = computed(() => site.value.proofLinks.find(link => link.href.includes('kwork.ru'))?.href)

/* sameAs — только собственные публичные профили GLUKE.
   Адреса профилей от языка не зависят, поэтому список вычисляется один раз. */
const sameAs = [kworkHref.value, telegramHref.value]
  .filter((href): href is string => Boolean(href))

const { home } = useSiteRoutes()

const homeUrl = computed(() => toAbsolute(home()))
const websiteId = computed(() => `${homeUrl.value}#website`)

useSchemaOrg([
  /* @id намеренно не задаётся: резолвер модуля присваивает стабильный `<host>/#identity`,
     на который ссылаются страницы кейсов. */
  defineOrganization({
    name: () => site.value.brand.name,
    description: () => site.value.brand.descriptor,
    /* Организация — одна сущность для обоих языков, поэтому её url остаётся
       корнем сайта, а не локализованной главной. */
    url: toAbsolute('/'),
    logo: toAbsolute('/media/brand/gluke-logo-white.svg'),
    ...(email.value ? { email: () => email.value } : {}),
    ...(telephone.value ? { telephone: () => telephone.value } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }),
  /* @id повторяет схему локализованного узла WebSite из nuxt-schema-org,
     поэтому описание из контента дополняет уже существующий узел,
     а не создаёт второй и не разрывает связи translationOfWork/workTranslation. */
  defineWebSite({
    '@id': () => websiteId.value,
    'url': () => homeUrl.value,
    'name': () => site.value.brand.name,
    'description': () => site.value.hero.description,
    'inLanguage': () => locale.value,
  }),
])
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default text-default">
    <a
      href="#main-content"
      class="site-skip-link text-body--sm"
    >
      {{ t('layout.skipToContent') }}
    </a>

    <SiteHeader :site="site" />

    <main
      id="main-content"
      class="flex-1"
    >
      <slot />
    </main>

    <SiteFooter :site="site" />
  </div>
</template>

<style scoped>
.site-skip-link {
  position: absolute;
  z-index: 100;
  inset-inline-start: 16px;
  inset-block-start: 16px;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding-inline: 16px;
  border: var(--site-border);
  border-radius: var(--site-radius-sm);
  background-color: var(--site-surface-raised);
  color: var(--site-text);
  transform: translateY(-200%);
  transition: transform 150ms ease;
}

.site-skip-link:focus-visible {
  transform: translateY(0);
}
</style>
