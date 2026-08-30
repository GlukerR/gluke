<script setup lang="ts">
/* Единственный источник `<html lang>`, canonical, hreflang, x-default,
   og:locale и og:locale:alternate — @nuxtjs/i18n. */
const localeHead = useLocaleHead()

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: [
    /* Фавикон: единственная SVG-иконка (белая монограмма G). Прочие PNG/ICO
       и apple-touch-icon удалены, чтобы браузер не тянул их лишний раз. */
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ...localeHead.value.link,
  ],
  meta: [
    /* Проверка прав на сайт в Яндекс.Вебмастере. */
    { name: 'yandex-verification', content: '820eb76ffe56a5df' },
    ...localeHead.value.meta,
  ],
}))
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
