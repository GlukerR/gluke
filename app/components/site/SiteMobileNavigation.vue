<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'
import { siteNavigation } from '~/config/site-navigation'

const props = defineProps<{ site: SiteCollectionItem }>()

const open = ref(false)
const route = useRoute()
const { t } = useI18n()
const { navigation } = useSiteRoutes()

const primaryCta = computed(() => props.site.hero.primaryCta)
const primaryContact = computed(() => props.site.contacts.find(contact => contact.primary) ?? props.site.contacts[0])
const secondaryContacts = computed(() => props.site.contacts.filter(contact => contact !== primaryContact.value))

watch(() => route.fullPath, () => {
  open.value = false
})

function close() {
  open.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="site.brand.name"
    :description="site.brand.descriptor"
    :close="false"
    side="right"
    :ui="{
      content: 'w-full max-w-sm',
      header: 'justify-between gap-4',
      wrapper: 'min-w-0',
    }"
  >
    <UButton
      color="neutral"
      variant="outline"
      class="site-menu-trigger"
    >
      <span
        class="site-menu-trigger__bars"
        aria-hidden="true"
      >
        <span class="site-menu-trigger__bar" />
        <span class="site-menu-trigger__bar" />
      </span>
      {{ t('menu.open') }}
    </UButton>

    <template #actions>
      <UButton
        color="neutral"
        variant="ghost"
        class="site-menu-close"
        @click="close"
      >
        {{ t('menu.close') }}
      </UButton>
    </template>

    <template #body>
      <div class="flex flex-col gap-8">
        <nav :aria-label="t('nav.ariaMobile')">
          <ul class="flex flex-col">
            <li
              v-for="item in siteNavigation"
              :key="item.labelKey"
            >
              <NuxtLink
                :to="navigation(item)"
                aria-current-value="false"
                class="site-mobile-link text-heading text-heading--sm"
                @click="close"
              >
                {{ t(item.labelKey) }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <SiteLocaleSwitcher />

        <UButton
          :to="primaryCta.href"
          target="_blank"
          rel="noopener noreferrer"
          color="primary"
          size="lg"
          block
          @click="close"
        >
          {{ primaryCta.label }}
        </UButton>

        <div class="flex flex-col gap-3">
          <p class="text-label text-dimmed">
            {{ t('menu.contacts') }}
          </p>
          <a
            :href="primaryContact.href"
            target="_blank"
            rel="noopener noreferrer"
            class="site-mobile-contact site-mobile-contact--primary"
          >
            <span class="text-label text-dimmed">{{ primaryContact.label }}</span>
            <span class="text-body text-highlighted">{{ primaryContact.value }}</span>
          </a>
          <a
            v-for="contact in secondaryContacts"
            :key="contact.channel"
            :href="contact.href"
            class="site-mobile-contact"
          >
            <span class="text-label text-dimmed">{{ contact.label }}</span>
            <span class="text-body--sm site-mobile-contact__value">{{ contact.value }}</span>
          </a>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.site-menu-trigger {
  min-height: 44px;
  min-width: 44px;
}

.site-menu-trigger__bars {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 16px;
}

.site-menu-close {
  flex-shrink: 0;
  justify-content: center;
  min-height: 44px;
  min-width: 44px;
  color: var(--site-text);
}

.site-menu-trigger__bar {
  display: block;
  height: 2px;
  width: 100%;
  background-color: currentcolor;
}

.site-mobile-link {
  display: flex;
  align-items: center;
  min-height: 52px;
  border-bottom: var(--site-border);
  color: var(--site-text);
  transition: color 150ms ease, padding-inline-start 150ms ease;
}

.site-mobile-link:hover {
  color: var(--site-accent);
  padding-inline-start: 4px;
}

.site-mobile-contact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 44px;
  justify-content: center;
  transition: color 150ms ease;
}

.site-mobile-contact__value {
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.site-mobile-contact--primary {
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  padding: 12px 16px;
}

.site-mobile-contact:hover {
  color: var(--site-accent);
}

.site-mobile-contact:hover .site-mobile-contact__value {
  color: var(--site-accent);
}
</style>
