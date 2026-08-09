<script setup lang="ts">
/* Единственный источник `<html lang>`, canonical, hreflang, x-default,
   og:locale и og:locale:alternate — @nuxtjs/i18n. */
const localeHead = useLocaleHead()

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: localeHead.value.link,
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
