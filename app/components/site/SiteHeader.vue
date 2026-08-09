<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'
import { siteNavigation } from '~/config/site-navigation'

const props = defineProps<{ site: SiteCollectionItem }>()

const { t } = useI18n()
const { navigation } = useSiteRoutes()

const primaryCta = computed(() => props.site.hero.primaryCta)
</script>

<template>
  <header class="site-header">
    <div class="site-container site-header__inner">
      <SiteLogo />

      <nav
        :aria-label="t('nav.ariaPrimary')"
        class="site-header__nav"
      >
        <ul class="flex items-center gap-1">
          <li
            v-for="item in siteNavigation"
            :key="item.labelKey"
          >
            <NuxtLink
              :to="navigation(item)"
              aria-current-value="false"
              class="site-header__link text-body--sm"
            >
              {{ t(item.labelKey) }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="flex items-center gap-2">
        <SiteLocaleSwitcher class="site-header__locales" />

        <UButton
          :to="primaryCta.href"
          target="_blank"
          rel="noopener noreferrer"
          color="primary"
          class="site-header__cta"
        >
          {{ primaryCta.label }}
        </UButton>

        <div class="site-header__mobile">
          <SiteMobileNavigation :site="site" />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: var(--site-border);
  background-color: color-mix(in srgb, var(--site-bg) 82%, transparent);
  backdrop-filter: blur(10px);
}

.site-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-block: 10px;
}

.site-header__nav {
  display: none;
}

.site-header__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding-inline: 14px;
  border-radius: var(--site-radius-sm);
  color: var(--site-text-secondary);
  transition: color 150ms ease, background-color 150ms ease;
}

.site-header__link:hover {
  color: var(--site-text);
  background-color: var(--site-surface);
}

.site-header__link:active {
  color: var(--site-accent);
}

.site-header__cta {
  display: none;
  min-height: 44px;
}

@media (min-width: 480px) {
  .site-header__cta {
    display: inline-flex;
  }
}

@media (min-width: 1024px) {
  .site-header__nav {
    display: block;
  }

  .site-header__mobile {
    display: none;
  }
}
</style>
