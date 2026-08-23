<script setup lang="ts">
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, SITE_LOCALES } from '#shared/i18n'
import type { LocaleCode } from '#shared/i18n'

const { locale, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

/* Тот же cookie, что читает серверное определение языка: ручной выбор
   всегда приоритетнее страны и сохраняется после перезагрузки. */
const localeCookie = useCookie<LocaleCode | null>(LOCALE_COOKIE_NAME, {
  path: '/',
  sameSite: 'lax',
  secure: import.meta.dev ? false : undefined,
  maxAge: LOCALE_COOKIE_MAX_AGE,
  default: () => null,
})

const options = computed(() => SITE_LOCALES.map(option => ({
  ...option,
  to: switchLocalePath(option.code),
  current: option.code === locale.value,
})))

function remember(code: LocaleCode): void {
  localeCookie.value = code
}
</script>

<template>
  <nav
    class="locale-switcher"
    :aria-label="t('localeSwitcher.label')"
  >
    <ul class="locale-switcher__list">
      <li
        v-for="option in options"
        :key="option.code"
      >
        <NuxtLink
          :to="option.to"
          :hreflang="option.language"
          :lang="option.code"
          :aria-current="option.current ? 'true' : undefined"
          :aria-label="option.current
            ? t('localeSwitcher.current', { language: option.name, code: option.short })
            : t('localeSwitcher.switchTo', { language: option.name, code: option.short })"
          class="locale-switcher__option text-label"
          :class="{ 'locale-switcher__option--current': option.current }"
          @click="remember(option.code)"
        >
          {{ option.short }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.locale-switcher__list {
  display: flex;
  align-items: center;
  gap: 2px;
}

.locale-switcher__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Требование к размеру области нажатия сохраняется на всех ширинах. */
  min-width: 44px;
  min-height: 44px;
  padding-inline: 8px;
  border-radius: var(--site-radius-sm);
  color: var(--site-text-muted);
  transition: color 150ms ease, background-color 150ms ease;
}

.locale-switcher__option--current {
  color: var(--site-text);
  background-color: var(--site-surface);
}

@media (hover: hover) and (pointer: fine) {
  .locale-switcher__option:hover {
    color: var(--site-text);
    background-color: var(--site-surface-raised);
  }
}
</style>
