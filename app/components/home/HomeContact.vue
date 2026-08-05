<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

const props = defineProps<{
  cta: SiteCollectionItem['hero']['primaryCta']
  pricing: SiteCollectionItem['pricing']
  contacts: SiteCollectionItem['contacts']
}>()

const emailContact = computed(() => props.contacts.find(contact => contact.channel === 'email'))
const isExternal = computed(() => props.cta.href.startsWith('https://'))
</script>

<template>
  <section
    id="contact"
    class="site-section site-anchor home-contact"
    aria-labelledby="home-contact-title"
  >
    <div class="site-container">
      <div class="home-contact__panel">
        <div class="home-contact__text">
          <h2
            id="home-contact-title"
            class="text-heading home-contact__title"
          >
            Обсудим ваш проект
          </h2>

          <p class="text-body home-contact__summary">
            {{ pricing.summary }}
          </p>

          <p class="text-body--sm home-contact__note">
            {{ pricing.note }}
          </p>
        </div>

        <div class="home-contact__actions">
          <a
            :href="cta.href"
            :target="isExternal ? '_blank' : undefined"
            :rel="isExternal ? 'noopener noreferrer' : undefined"
            class="home-contact__cta text-body"
          >
            {{ cta.label }}
          </a>

          <a
            v-if="emailContact"
            :href="emailContact.href"
            class="home-contact__secondary text-body--sm"
          >
            {{ emailContact.label }}: {{ emailContact.value }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-contact__panel {
  display: flex;
  flex-direction: column;
  gap: clamp(28px, 4vw, 48px);
  padding: clamp(28px, 5vw, 72px);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-accent);
  color: var(--site-contrast-text);
}

.home-contact__text {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.home-contact__title {
  max-width: 18ch;
  color: var(--site-contrast-text);
}

.home-contact__summary {
  max-width: 46ch;
  color: var(--site-contrast-text);
  overflow-wrap: anywhere;
}

.home-contact__note {
  max-width: 46ch;
  color: color-mix(in srgb, var(--site-contrast-text) 78%, var(--site-accent));
  overflow-wrap: anywhere;
}

.home-contact__actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
  min-width: 0;
}

.home-contact__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  padding-inline: clamp(24px, 3vw, 40px);
  border-radius: var(--site-radius-sm);
  background-color: var(--site-bg);
  color: var(--site-text);
  font-weight: 600;
  transition: background-color 150ms ease;
}

.home-contact__cta:hover {
  background-color: var(--site-surface-raised);
}

.home-contact__cta:focus-visible {
  outline-color: var(--site-contrast-text);
}

.home-contact__secondary {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--site-contrast-text);
  text-decoration: underline;
  text-underline-offset: 4px;
  overflow-wrap: anywhere;
}

@media (max-width: 419px) {
  .home-contact__cta {
    width: 100%;
  }
}

@media (min-width: 1024px) {
  .home-contact__panel {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: clamp(40px, 5vw, 96px);
  }

  .home-contact__actions {
    align-items: flex-end;
  }
}
</style>
