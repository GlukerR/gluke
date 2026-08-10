<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description?: string
  titleId?: string
}>()
</script>

<template>
  <div class="home-section-header">
    <p class="text-label text-accent">
      {{ eyebrow }}
    </p>
    <h2
      :id="titleId"
      class="text-heading text-heading--md text-highlighted home-section-header__title"
    >
      {{ title }}
    </h2>
    <p
      v-if="description"
      class="text-body text-muted home-section-header__description"
    >
      {{ description }}
    </p>
  </div>
</template>

<style scoped>
.home-section-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.home-section-header__title {
  max-width: 24ch;
}

.home-section-header__description {
  max-width: 62ch;
}
</style>
