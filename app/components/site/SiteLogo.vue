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
    :aria-label="props.label"
  >
    <span
      class="site-logo__mark"
      aria-hidden="true"
    />
  </NuxtLink>
</template>

<style scoped>
.site-logo {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  border-radius: var(--site-radius-sm);
}

/* Один монохромный белый SVG, подключённый как маска: силуэт логотипа
   рисуется цветом из переменной. Тёмная тема — белый, светлая — фирменный
   фиолетовый вместо прежнего чёрного. */
.site-logo__mark {
  display: inline-block;
  height: 24px;
  aspect-ratio: 783 / 250;
  background-color: var(--site-text);
  -webkit-mask: url('/media/brand/gluke-logo-white.svg') no-repeat center / contain;
  mask: url('/media/brand/gluke-logo-white.svg') no-repeat center / contain;
  transition: opacity 150ms ease;
}

:root.light .site-logo__mark {
  background-color: var(--site-accent);
}

.site-logo:hover .site-logo__mark {
  opacity: 0.75;
}

@media (min-width: 1024px) {
  .site-logo__mark {
    height: 30px;
  }
}
</style>
