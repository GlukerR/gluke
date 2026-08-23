<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from '#shared/i18n'

/* Nuxt кладёт в объект ошибки 404 запрошенный URL, но в типах H3Error его нет —
   поле опционально расширяется здесь, а не через any. */
interface RouteError extends NuxtError {
  url?: string
}

function pathnameOf(url: string | undefined): string {
  if (!url) {
    return '/'
  }
  try {
    return new URL(url, 'http://localhost').pathname
  }
  catch {
    return url
  }
}

/* error.vue рендерится вне маршрута, поэтому i18n-контекст здесь не гарантирован:
   локаль определяется единственным надёжным сигналом — префиксом запрошенного URL.
   Английская локаль живёт без префикса, русская — под /ru (см. strategy в nuxt.config).
   На клиенте у error может не быть поля url (SPA-переход), поэтому второй сигнал —
   адресная строка браузера. На сервере location не существует, там работает url. */
const requestedUrl = computed(() => (props.error as RouteError).url ?? '')
const clientPath = typeof window !== 'undefined' ? window.location.pathname : ''
const pathname = computed(() => {
  const fromUrl = pathnameOf(requestedUrl.value)
  /* pathnameOf возвращает '/' и для пустого url, поэтому сверяемся с оригиналом. */
  return requestedUrl.value ? fromUrl : (clientPath || '/')
})
const isRussian = computed(() => pathname.value.startsWith('/ru'))

/* Путь без префикса локали: на него навешиваются ссылки переключателя языка,
   чтобы переключение с 404 вело на ту же (несуществующую) страницу в другой локали. */
const unprefixedPath = computed(() => {
  const rest = isRussian.value ? pathname.value.slice(3) : pathname.value
  return rest || '/'
})

const copy = computed(() => isRussian.value ? {
  lang: 'ru-RU',
  codeLabel: 'ОШИБКА 404',
  title: 'Страница не найдена',
  text: 'Возможно, ссылка устарела или страница переехала. Начните с главной — там всё на месте.',
  action: 'На главную',
  projectsAction: 'Смотреть проекты',
  serverTitle: 'Что-то пошло не так',
  serverText: 'Попробуйте обновить страницу или вернуться на главную.',
} : {
  lang: 'en-US',
  codeLabel: 'ERROR 404',
  title: 'Page not found',
  text: 'The link may be outdated or the page may have moved. Start from the home page — everything is there.',
  action: 'Back to home',
  projectsAction: 'View projects',
  serverTitle: 'Something went wrong',
  serverText: 'Try refreshing the page or go back to the home page.',
})

const is404 = computed(() => props.error.statusCode === 404)

/* Ссылки собираются вручную, а не через useLocalePath: на странице ошибки
   локализованный маршрут не существует, и префикс зависит только от локали. */
const homeHref = computed(() => isRussian.value ? '/ru' : '/')
const projectsHref = computed(() => isRussian.value ? '/ru/projects' : '/projects')

/* Переключатель языка: короткие формы EN/RU, ссылки на тот же путь
   в другой локали (RU — с префиксом, EN — без). */
const localeOptions = computed(() => [
  { code: 'en', short: 'EN', href: unprefixedPath.value, current: !isRussian.value },
  { code: 'ru', short: 'RU', href: `/ru${unprefixedPath.value}`, current: isRussian.value },
])

/* Тот же cookie, что читает серверное определение языка: ручной выбор
   приоритетнее страны и сохраняется после перезагрузки. */
const localeCookie = useCookie<string | null>(LOCALE_COOKIE_NAME, {
  path: '/',
  sameSite: 'lax',
  secure: import.meta.dev ? false : undefined,
  maxAge: LOCALE_COOKIE_MAX_AGE,
  default: () => null,
})

useHead(() => ({
  htmlAttrs: { lang: copy.value.lang },
  title: is404.value ? '404 — GLUKE' : `${props.error.statusCode ?? 500} — GLUKE`,
  meta: [{ name: 'robots', content: 'noindex' }],
}))

function goHome() {
  clearError({ redirect: homeHref.value })
}
</script>

<!-- Без scoped: оверлей ошибки Nuxt DevTools рендерится вне корня приложения
     (тег nuxt-error-overlay в <body>), и scoped-селекторы его не достают.
     Error-страница существует только при ошибке, поэтому правило действует
     только на ней: на проде этого элемента нет, и на обычных страницах
     DevTools продолжает работать как обычно. -->
<style>
nuxt-error-overlay {
  display: none !important;
}
</style>

<template>
  <div class="bg-default text-default error-page">
    <nav
      class="error-page__locale"
      aria-label="Language"
    >
      <ul class="error-page__locale-list">
        <li
          v-for="option in localeOptions"
          :key="option.code"
        >
          <a
            :href="option.href"
            :lang="option.code"
            :hreflang="option.code === 'ru' ? 'ru-RU' : 'en-US'"
            :aria-current="option.current ? 'true' : undefined"
            class="error-page__locale-option text-label"
            :class="{ 'error-page__locale-option--current': option.current }"
            @click="localeCookie = option.code"
          >
            {{ option.short }}
          </a>
        </li>
      </ul>
    </nav>

    <div class="error-page__inner">
      <a
        :href="homeHref"
        class="error-page__logo"
        :aria-label="'GLUKE'"
        @click.prevent="goHome"
      >
        <span
          class="error-page__logo-mark"
          aria-hidden="true"
        />
      </a>

      <p class="text-label error-page__label">
        {{ copy.codeLabel }}
      </p>

      <h1 class="text-display error-page__code">
        {{ is404 ? '404' : error.statusCode }}
      </h1>

      <p class="text-heading--md error-page__title">
        {{ is404 ? copy.title : copy.serverTitle }}
      </p>

      <p class="text-body error-page__text">
        {{ is404 ? copy.text : copy.serverText }}
      </p>

      <div class="error-page__actions">
        <button
          type="button"
          class="error-page__action"
          @click="goHome"
        >
          {{ copy.action }}
        </button>

        <a
          :href="projectsHref"
          class="error-page__action error-page__action--secondary"
        >
          {{ copy.projectsAction }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Страница ошибки рендерится вне layout, поэтому каркас собирается здесь:
   полная высота экрана, фон из ролей темы, контент по центру. */
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: clamp(24px, 5vw, 64px);
}

/* Переключатель языка — в правом верхнем углу, как у шапки сайта. */
.error-page__locale {
  position: absolute;
  inset-block-start: clamp(16px, 3vh, 32px);
  inset-inline-end: clamp(16px, 4vw, 48px);
}

.error-page__locale-list {
  display: flex;
  align-items: center;
  gap: 2px;
}

.error-page__locale-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding-inline: 8px;
  border-radius: var(--site-radius-sm);
  color: var(--site-text-muted);
  text-decoration: none;
  transition: color 150ms ease, background-color 150ms ease;
}

.error-page__locale-option--current {
  color: var(--site-text);
  background-color: var(--site-surface);
}

@media (hover: hover) and (pointer: fine) {
  .error-page__locale-option:hover {
    color: var(--site-text);
    background-color: var(--site-surface-raised);
  }
}


.error-page__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 560px;
  text-align: center;
}

.error-page__logo {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-block-end: clamp(32px, 6vh, 64px);
  border-radius: var(--site-radius-sm);
}

.error-page__logo-mark {
  display: inline-block;
  height: 24px;
  aspect-ratio: 783 / 250;
  background-color: var(--site-text);
  -webkit-mask: url('/media/brand/gluke-logo-white.svg') no-repeat center / contain;
  mask: url('/media/brand/gluke-logo-white.svg') no-repeat center / contain;
}

.error-page__label {
  color: var(--site-accent-text);
}

.error-page__code {
  margin-block-start: 8px;
  color: var(--site-accent);
  /* Цифры 404 — самый крупный элемент: не переносится и не сжимается. */
  line-height: 1;
}

.error-page__title {
  margin-block-start: clamp(16px, 3vh, 28px);
  color: var(--site-text);
  text-wrap: balance;
}

.error-page__text {
  margin-block-start: 12px;
  max-width: 42ch;
  color: var(--site-text-secondary);
}

/* Кнопки — primary (фирменная заливка) и secondary (контур). */
.error-page__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-block-start: clamp(24px, 4vh, 40px);
}

.error-page__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding-inline: 32px;
  border: none;
  border-radius: var(--site-radius-md);
  background-color: var(--site-accent);
  color: var(--site-accent-fg);
  font-size: var(--type-body);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.error-page__action:hover {
  background-color: var(--site-accent-hover);
}

.error-page__action--secondary {
  border: 1px solid var(--site-border-strong);
  background-color: transparent;
  color: var(--site-text);
}

.error-page__action--secondary:hover {
  border-color: var(--site-accent-text);
  background-color: transparent;
  color: var(--site-accent-text);
}

.error-page__action:focus-visible {
  outline: 2px solid var(--site-focus);
  outline-offset: 3px;
}
</style>
