/* Canonical и Open Graph — то, по чему поисковик решает, какая страница
 * оригинал, а какая дубль. Ошибка здесь не видна на сайте вообще: страница
 * выглядит нормально, а в выдаче склеиваются языковые версии или canonical
 * уезжает на localhost. Поэтому проверяем не факт вызова useSeoMeta, а
 * значения, которые в него уходят.
 *
 * Композабл живёт на автоимпортах Nuxt, поэтому их подменяем глобально:
 * `computed` и `toValue` берём настоящие из vue, чтобы геттеры считались
 * так же, как в приложении.
 */
import { computed, toValue } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { usePageSeo, useSiteUrls } from './usePageSeo'

type Meta = Record<string, unknown>

let headCalls: Meta[] = []
let metaCalls: Meta[] = []
let siteUrl = 'https://gluke.ru'
let requestOrigin = 'http://localhost:3000'
let currentLocale = 'ru'

const globals = globalThis as Record<string, unknown>

beforeEach(() => {
  headCalls = []
  metaCalls = []
  siteUrl = 'https://gluke.ru'
  requestOrigin = 'http://localhost:3000'
  currentLocale = 'ru'

  globals.computed = computed
  globals.toValue = toValue
  globals.useSiteConfig = () => ({
    get url() {
      return siteUrl
    },
  })
  globals.useRequestURL = () => new URL(requestOrigin)
  globals.useI18n = () => ({ locale: computed(() => currentLocale) })
  globals.useHead = (value: Meta) => headCalls.push(value)
  globals.useSeoMeta = (value: Meta) => metaCalls.push(value)
})

afterEach(() => {
  for (const key of ['computed', 'toValue', 'useSiteConfig', 'useRequestURL', 'useI18n', 'useHead', 'useSeoMeta']) {
    Reflect.deleteProperty(globals, key)
  }
})

/* Значение из useSeoMeta: часть полей передаётся геттерами, часть — как есть. */
function meta(key: string): unknown {
  const value = metaCalls.at(-1)?.[key]
  return typeof value === 'function' ? (value as () => unknown)() : value
}

function canonical(): unknown {
  const link = (headCalls.at(-1)?.link as { rel: string, href: unknown }[] | undefined)
    ?.find(entry => entry.rel === 'canonical')
  const href = link?.href
  return typeof href === 'function' ? (href as () => unknown)() : href
}

function run(path: string) {
  usePageSeo({
    title: 'Заголовок',
    description: 'Описание',
    path,
    type: 'article',
    image: { src: '/media/cover.jpg', alt: 'Обложка', width: 1680, height: 945 },
  })
}

describe('useSiteUrls', () => {
  it('строит абсолютный адрес от origin из Site Config', () => {
    expect(useSiteUrls().toAbsolute('/media/cover.jpg')).toBe('https://gluke.ru/media/cover.jpg')
  })

  /* Локальная разработка без NUXT_SITE_URL: origin берётся из запроса,
     иначе canonical получился бы относительным и невалидным. */
  it('без Site Config падает на origin запроса', () => {
    siteUrl = ''
    expect(useSiteUrls().toAbsolute('/media/cover.jpg')).toBe('http://localhost:3000/media/cover.jpg')
  })

  it('уже абсолютный адрес не переклеивает на свой домен', () => {
    expect(useSiteUrls().toAbsolute('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  /* Query и hash в canonical превратили бы каждую фильтрацию каталога
     в отдельную страницу для поисковика. */
  it('canonical отбрасывает query и hash', () => {
    expect(useSiteUrls().toCanonical('/ru/projects?category=webgl#top'))
      .toBe('https://gluke.ru/ru/projects')
  })

  it('canonical снимает хвостовые слеши, но корень оставляет корнем', () => {
    const { toCanonical } = useSiteUrls()
    expect(toCanonical('/ru/projects/')).toBe('https://gluke.ru/ru/projects')
    expect(toCanonical('/ru/projects///')).toBe('https://gluke.ru/ru/projects')
    expect(toCanonical('/')).toBe('https://gluke.ru/')
  })
})

describe('usePageSeo', () => {
  it('canonical и og:url — один и тот же нормализованный адрес', () => {
    run('/ru/projects/pyramid/?utm_source=x')

    expect(canonical()).toBe('https://gluke.ru/ru/projects/pyramid')
    expect(meta('ogUrl')).toBe(canonical())
  })

  it('картинка карточки уходит абсолютным адресом', () => {
    run('/ru/projects/pyramid')

    expect(meta('ogImage')).toBe('https://gluke.ru/media/cover.jpg')
    expect(meta('twitterImage')).toBe('https://gluke.ru/media/cover.jpg')
    expect(meta('ogImageWidth')).toBe(1680)
    expect(meta('ogImageHeight')).toBe(945)
    expect(meta('ogImageAlt')).toBe('Обложка')
  })

  /* Open Graph хочет `ru_RU`, а не `ru-RU`, и альтернативой указывается
     другой язык — но canonical на него не переводится. */
  it('локаль отдаётся в форме Open Graph, альтернативы — остальные языки', () => {
    run('/ru/projects/pyramid')
    expect(meta('ogLocale')).toBe('ru_RU')
    expect(meta('ogLocaleAlternate')).toEqual(['en_US'])

    currentLocale = 'en'
    run('/projects/pyramid')
    expect(meta('ogLocale')).toBe('en_US')
    expect(meta('ogLocaleAlternate')).toEqual(['ru_RU'])
  })

  it('на незнакомой локали og:locale молчит, а не выдумывает значение', () => {
    currentLocale = 'de'
    run('/de/projects/pyramid')

    expect(meta('ogLocale')).toBeUndefined()
  })

  it('заголовок и описание уходят во все три набора тегов', () => {
    run('/ru/projects/pyramid')

    for (const key of ['title', 'ogTitle', 'twitterTitle']) {
      expect(meta(key), `${key} не совпал`).toBe('Заголовок')
    }
    for (const key of ['description', 'ogDescription', 'twitterDescription']) {
      expect(meta(key), `${key} не совпал`).toBe('Описание')
    }
    expect(meta('ogType')).toBe('article')
    expect(meta('ogSiteName')).toBe('GLUKE')
    expect(meta('twitterCard')).toBe('summary_large_image')
  })
})
