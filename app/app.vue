<script setup lang="ts">
/* Единственный источник `<html lang>`, canonical, hreflang, x-default,
   og:locale и og:locale:alternate — @nuxtjs/i18n. */
const localeHead = useLocaleHead()

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: [
    /* Фавиконки: SVG для современных браузеров, PNG-фолбэки, apple-touch-icon
       для iOS (иконка на главном экране). favicon.ico — контейнер 16/32/48. */
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    ...localeHead.value.link,
  ],
  meta: localeHead.value.meta,
}))
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
