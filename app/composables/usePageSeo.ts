import { SITE_LOCALES, toOpenGraphLocale } from '#shared/i18n'
import { withShareImageVersion } from '~/utils/shareImage'
import type { MaybeRefOrGetter } from 'vue'

export interface PageSeoImage {
  src: string
  alt: string
  width: number
  height: number
}

export type PageSeoType = 'website' | 'article'

export interface PageSeoInput {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  path: MaybeRefOrGetter<string>
  type: MaybeRefOrGetter<PageSeoType>
  image: MaybeRefOrGetter<PageSeoImage>
}

const SITE_NAME = 'GLUKE'

export interface SiteUrlResolver {
  toAbsolute: (pathOrUrl: string) => string
  toCanonical: (path: string) => string
}

/**
 * Проверка, что значение — настоящий http(s)-адрес, а не что угодно, что
 * оказалось в поле `url`.
 *
 * Проверка нужна не из педантичности. `Site Config` берёт `url` из
 * `NUXT_SITE_URL`, и на хосте, где переменная не задана (превью-деплой или
 * второй проект с тем же кодом), в это поле может приехать не адрес: сборка
 * без переменной кладёт туда строку вида `https://() => resolveI18nUrl(i18n)`.
 * Она непустая, поэтому простой `||` до фолбэка не доходит, а
 * `new URL(путь, этаСтрока)` бросает `Invalid URL` — то есть падает страница,
 * а не портится одна ссылка.
 */
function isHttpOrigin(value: string | undefined): value is string {
  if (!value) {
    return false
  }

  try {
    const { protocol } = new URL(value)

    return protocol === 'http:' || protocol === 'https:'
  }
  catch {
    return false
  }
}

/**
 * Абсолютные URL строятся через конструктор URL, без конкатенации строк.
 * useRequestURL() — безопасный fallback для локальной разработки и для любого
 * окружения, где Site Config не получил NUXT_SITE_URL (в том числе когда
 * вместо адреса в конфиг приехало что-то другое).
 */
export function useSiteUrls(): SiteUrlResolver {
  const siteConfig = useSiteConfig()
  const requestUrl = useRequestURL()

  const origin = computed(() => (isHttpOrigin(siteConfig.url) ? siteConfig.url : requestUrl.origin))

  function toAbsolute(pathOrUrl: string): string {
    return new URL(pathOrUrl, origin.value).href
  }

  function toCanonical(path: string): string {
    /* Query и hash в canonical не нужны: иначе каждая фильтрация каталога
       становилась бы для поисковика отдельной страницей. Хвостовые слеши
       снимаются, а корень остаётся корнем сам — пустой путь конструктор URL
       и так разворачивает в «/». */
    const pathname = new URL(path, origin.value).pathname

    return toAbsolute(pathname.replace(/\/+$/, ''))
  }

  return { toAbsolute, toCanonical }
}

/**
 * Единый источник canonical, Open Graph и Twitter Cards для публичных страниц.
 *
 * `<html lang>`, hreflang и x-default остаются за `useLocaleHead()` в `app.vue`
 * и здесь не дублируются. canonical всегда указывает на тот же язык,
 * что и страница: переводы взаимными дублями не объявляются.
 */
export function usePageSeo(input: PageSeoInput): void {
  const { toAbsolute, toCanonical } = useSiteUrls()
  const { locale } = useI18n()
  /* Версии share-картинок считает сборка (`shared/mediaVersions.ts`), в
     рантайме это просто карта в конфиге. Картинка без отпечатка (например,
     логотип или чужая страница) уходит адресом как есть. */
  const imageVersions = useRuntimeConfig().public.imageVersions

  const canonicalUrl = computed(() => toCanonical(toValue(input.path)))
  const imageUrl = computed(() => toAbsolute(
    withShareImageVersion(toValue(input.image).src, imageVersions),
  ))

  const currentLanguage = computed(() =>
    SITE_LOCALES.find(option => option.code === locale.value)?.language,
  )
  const alternateLanguages = computed(() => SITE_LOCALES
    .filter(option => option.code !== locale.value)
    .map(option => toOpenGraphLocale(option.language)))

  useHead({
    link: [
      {
        rel: 'canonical',
        href: () => canonicalUrl.value,
      },
    ],
  })

  useSeoMeta({
    title: () => toValue(input.title),
    description: () => toValue(input.description),
    ogTitle: () => toValue(input.title),
    ogDescription: () => toValue(input.description),
    ogType: () => toValue(input.type),
    ogUrl: () => canonicalUrl.value,
    ogSiteName: SITE_NAME,
    ogLocale: () => {
      const language = currentLanguage.value

      return language ? toOpenGraphLocale(language) : undefined
    },
    ogLocaleAlternate: () => alternateLanguages.value,
    ogImage: () => imageUrl.value,
    ogImageAlt: () => toValue(input.image).alt,
    ogImageWidth: () => toValue(input.image).width,
    ogImageHeight: () => toValue(input.image).height,
    twitterCard: 'summary_large_image',
    twitterTitle: () => toValue(input.title),
    twitterDescription: () => toValue(input.description),
    twitterImage: () => imageUrl.value,
    twitterImageAlt: () => toValue(input.image).alt,
  })
}
