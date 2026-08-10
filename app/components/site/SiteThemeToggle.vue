<script setup lang="ts">
/* Единственная реализация переключателя: используется и в шапке, и в мобильном меню.
   Тема меняется только через `colorMode.preference`, DOM руками не трогается. */
const colorMode = useColorMode()
const { t } = useI18n()

const isDark = computed(() => colorMode.value === 'dark')

/* Подсказка сообщает текущую тему, accessible name — результат нажатия. */
const stateLabel = computed(() => (isDark.value ? t('themeSwitcher.dark') : t('themeSwitcher.light')))
const actionLabel = computed(() => (isDark.value ? t('themeSwitcher.switchToLight') : t('themeSwitcher.switchToDark')))

function toggle(): void {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <!-- До гидратации реальное значение темы клиенту неизвестно, поэтому кнопка
       рендерится только на клиенте, а fallback занимает ровно её место. -->
  <ClientOnly>
    <button
      type="button"
      class="theme-toggle"
      :aria-label="actionLabel"
      :aria-pressed="isDark"
      :title="stateLabel"
      @click="toggle"
    >
      <svg
        v-if="isDark"
        class="theme-toggle__icon"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="4.2"
        />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
      </svg>
      <svg
        v-else
        class="theme-toggle__icon"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M20 14.4a8.4 8.4 0 0 1-10.4-10.4 8.4 8.4 0 1 0 10.4 10.4Z" />
      </svg>
    </button>

    <template #fallback>
      <span
        class="theme-toggle theme-toggle--placeholder"
        aria-hidden="true"
      />
    </template>
  </ClientOnly>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Требование к области нажатия сохраняется на всех ширинах. */
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--site-radius-sm);
  color: var(--site-text-muted);
  transition: color 150ms ease, background-color 150ms ease;
}

.theme-toggle--placeholder {
  /* Плейсхолдер держит ширину кнопки, чтобы шапка не прыгала после гидратации. */
  display: inline-block;
}

.theme-toggle:active {
  color: var(--site-accent-text);
}

@media (hover: hover) and (pointer: fine) {
  .theme-toggle:hover {
    color: var(--site-text);
    background-color: var(--site-surface-raised);
  }
}
</style>
