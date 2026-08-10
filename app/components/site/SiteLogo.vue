<script setup lang="ts">
const props = withDefaults(defineProps<{ label?: string }>(), {
  label: 'GLUKE',
})

const { home } = useSiteRoutes()
</script>

<template>
  <NuxtLink
    :to="home()"
    class="site-logo"
  >
    <img
      src="/media/brand/gluke-logo-white.svg"
      :alt="props.label"
      width="783"
      height="250"
      class="site-logo__image"
      decoding="async"
    >
  </NuxtLink>
</template>

<style scoped>
.site-logo {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  border-radius: var(--site-radius-sm);
}

.site-logo__image {
  height: 24px;
  width: auto;
  transition: opacity 150ms ease;
}

/* Логотип — один монохромный белый SVG, подключённый как `<img>`.
   Второго файла не появляется: в светлой теме тот же файл приводится к почти чёрному. */
:root.light .site-logo__image {
  filter: brightness(0);
}

.site-logo:hover .site-logo__image {
  opacity: 0.75;
}

@media (min-width: 1024px) {
  .site-logo__image {
    height: 30px;
  }
}
</style>
