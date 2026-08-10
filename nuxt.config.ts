import { DEFAULT_LOCALE, SITE_LOCALES } from './shared/i18n'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/image',
    '@nuxt/content',
    '@nuxt/fonts',
    '@nuxtjs/i18n',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    'nuxt-schema-org',
  ],
  $development: {
    devtools: { enabled: true },
  },
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  /* Единственное место конфигурации сайта.
     url и env приходят из NUXT_SITE_URL и NUXT_SITE_ENV и намеренно не дублируются здесь. */
  site: {
    name: 'GLUKE',
    defaultLocale: DEFAULT_LOCALE,
  },
  /* Интеграция Nuxt UI с Nuxt Color Mode: тёмная тема при первом визите,
     класс `.dark`/`.light` ставит штатный ранний скрипт до гидратации,
     сохранённый выбор пользователя читается из стандартного хранилища. */
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    /* Nuxt UI по умолчанию глушит transition на время смены темы; здесь переход
       разрешён, потому что он ограничен цветовыми свойствами и длится 180 ms. */
    disableTransition: false,
  },
  content: {
    experimental: {
      sqliteConnector: 'native',
    },
  },
  experimental: {
    /* Типизированные маршруты нужны локализованным ссылкам: имя маршрута и его
       параметры проверяются компилятором вместо ручной сборки путей строками. */
    typedPages: true,
  },
  compatibilityDate: '2026-07-29',
  typescript: {
    typeCheck: true,
  },
  eslint: {
    config: {
      stylistic: {
        indent: 2,
        quotes: 'single',
        semi: false,
        commaDangle: 'always-multiline',
      },
    },
  },
  fonts: {
    families: [
      {
        name: 'Manrope',
        provider: 'google',
        weights: [400, 500, 600, 700],
        styles: ['normal'],
        subsets: ['latin', 'latin-ext', 'cyrillic'],
      },
    ],
  },
  i18n: {
    /* Английский — локаль по умолчанию без префикса, русский — под /ru.
       Публичных дублей /en при этой стратегии не существует. */
    strategy: 'prefix_except_default',
    defaultLocale: DEFAULT_LOCALE,
    locales: SITE_LOCALES.map(({ code, language, name, file }) => ({ code, language, name, file })),
    /* Встроенное определение языка браузера отключено:
       первичный выбор делает собственное server middleware по стране и cookie. */
    detectBrowserLanguage: false,
    /* Абсолютные hreflang и canonical берут домен из той же переменной, что и Site Config:
       второго источника production-URL в проекте нет. */
    baseUrl: import.meta.env.NUXT_SITE_URL ?? '',
    experimental: {
      typedOptionsAndMessages: 'default',
    },
  },
  robots: {
    disallow: ['/api/'],
    sitemap: '/sitemap.xml',
    credits: false,
  },
  sitemap: {
    /* Статические маршруты берутся из nuxt:pages, кейсы — из типизированного серверного источника. */
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/api/**'],
    credits: false,
  },
})
