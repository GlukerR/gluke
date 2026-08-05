<script setup lang="ts">
const { data } = await useAsyncData('site-singleton', () => queryCollection('site').first())

const site = data.value

if (!site) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Глобальный контент сайта недоступен',
    fatal: true,
  })
}

provideSiteContent(site)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default text-default">
    <a
      href="#main-content"
      class="site-skip-link text-body--sm"
    >
      Перейти к содержимому
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
