import { SITE_LOCALES, toOpenGraphLocale } from '#shared/i18n'
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
 * Абсолютные URL строятся через конструктор URL, без конкатенации строк.
 * useRequestURL() — безопасный fallback для локальной разработки,
 * если Site Config не получил NUXT_SITE_URL.
 */
export function useSiteUrls(): SiteUrlResolver {
  const siteConfig = useSiteConfig()
  const requestUrl = useRequestURL()

  const origin = computed(() => siteConfig.url || requestUrl.origin)

  function toAbsolute(pathOrUrl: string): string {
    return new URL(pathOrUrl, origin.value).href
  }

  function toCanonical(path: string): string {
    /* Query и hash в canonical не нужны, для главной сохраняется «/». */
    const pathname = new URL(path, origin.value).pathname
    const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return toAbsolute(normalized)
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

  const canonicalUrl = computed(() => toCanonical(toValue(input.path)))
  const imageUrl = computed(() => toAbsolute(toValue(input.image).src))

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
