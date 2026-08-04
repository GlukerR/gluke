<script setup lang="ts">
const props = withDefaults(defineProps<{ label?: string }>(), {
  label: 'GLUKE',
})
</script>

<template>
  <NuxtLink
    to="/"
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

.site-logo:hover .site-logo__image {
  opacity: 0.75;
}

@media (min-width: 1024px) {
  .site-logo__image {
    height: 30px;
  }
}
</style>
