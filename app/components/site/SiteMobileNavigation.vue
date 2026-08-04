<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'
import { siteNavigation } from '~/config/site-navigation'

const props = defineProps<{ site: SiteCollectionItem }>()

const open = ref(false)
const route = useRoute()

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
    :ui="{ content: 'w-full max-w-sm' }"
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
      Меню
    </UButton>

    <template #actions>
      <UButton
        color="neutral"
        variant="ghost"
        @click="close"
      >
        Закрыть
      </UButton>
    </template>

    <template #body>
      <div class="flex flex-col gap-8">
        <nav aria-label="Мобильная навигация">
          <ul class="flex flex-col">
            <li
              v-for="item in siteNavigation"
              :key="item.to"
            >
              <NuxtLink
                :to="item.to"
                aria-current-value="false"
                class="site-mobile-link text-heading text-heading--sm"
                @click="close"
              >
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

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
            Контакты
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
            <span class="text-body--sm text-muted">{{ contact.value }}</span>
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

.site-mobile-contact--primary {
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  padding: 12px 16px;
}

.site-mobile-contact:hover {
  color: var(--site-accent);
}
</style>
