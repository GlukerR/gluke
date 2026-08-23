<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

const props = withDefaults(defineProps<{
  cta: SiteCollectionItem['hero']['primaryCta']
  pricing: SiteCollectionItem['pricing']
  contacts: SiteCollectionItem['contacts']
  /* Один и тот же блок на всех страницах: отличается только внешний отступ
     секции — стандартный (главная) или в ритме страницы кейса. */
  spacing?: 'home' | 'project'
}>(), {
  spacing: 'home',
})

const { t } = useI18n()

const emailContact = computed(() => props.contacts.find(contact => contact.channel === 'email'))
const isExternal = computed(() => props.cta.href.startsWith('https://'))
</script>

<template>
  <section
    id="contact"
    class="site-contact"
    :class="spacing === 'project' ? 'site-contact--project' : 'site-section site-anchor'"
    aria-labelledby="site-contact-title"
  >
    <div class="site-container">
      <div class="site-contact__panel">
        <div class="site-contact__text">
          <h2
            id="site-contact-title"
            class="text-heading site-contact__title"
          >
            {{ t('home.contact.title') }}
          </h2>

          <p class="text-body site-contact__summary">
            {{ pricing.summary }}
          </p>

          <p class="text-body--sm site-contact__note">
            {{ pricing.note }}
          </p>
        </div>

        <div class="site-contact__actions">
          <a
            :href="cta.href"
            :target="isExternal ? '_blank' : undefined"
            :rel="isExternal ? 'noopener noreferrer' : undefined"
            class="site-contact__cta text-body"
          >
            {{ cta.label }}
          </a>

          <a
            v-if="emailContact"
            :href="emailContact.href"
            class="site-contact__secondary text-body--sm"
          >
            {{ emailContact.label }}: {{ emailContact.value }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* В ритме страницы кейса: половина разрыва сверху, полный снизу до футера. */
.site-contact--project {
  padding-block:
    var(--project-space, clamp(28px, 3.2vw, 56px))
    var(--project-space-edge, clamp(56px, 6.4vw, 104px));
}

.site-contact__panel {
  display: flex;
  flex-direction: column;
  gap: clamp(28px, 4vw, 48px);
  padding: clamp(28px, 5vw, 72px);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-accent);
  color: var(--site-accent-fg);
}

.site-contact__text {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.site-contact__title {
  max-width: 18ch;
  color: var(--site-accent-fg);
}

.site-contact__summary {
  max-width: 46ch;
  color: var(--site-accent-fg);
  overflow-wrap: anywhere;
}

.site-contact__note {
  max-width: 46ch;
  /* 84% fg даёт ~4.8:1 на фиолетовом чипе (78% было 4.38 — ниже порога 4.5). */
  color: color-mix(in srgb, var(--site-accent-fg) 84%, var(--site-accent));
  overflow-wrap: anywhere;
}

.site-contact__actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
  min-width: 0;
}

.site-contact__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  padding-inline: clamp(24px, 3vw, 40px);
  border-radius: var(--site-radius-sm);
  background-color: var(--site-on-accent-surface);
  color: var(--site-on-accent-surface-text);
  font-weight: 600;
  transition: background-color 150ms ease;
}

.site-contact__cta:hover {
  background-color: var(--site-on-accent-surface-hover);
}

.site-contact__cta:focus-visible {
  outline-color: var(--site-accent-fg);
}

.site-contact__secondary {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--site-accent-fg);
  text-decoration: underline;
  text-underline-offset: 4px;
  overflow-wrap: anywhere;
}

@media (max-width: 419px) {
  .site-contact__cta {
    width: 100%;
  }
}

@media (min-width: 1024px) {
  .site-contact__panel {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: clamp(40px, 5vw, 96px);
  }

  .site-contact__actions {
    align-items: flex-end;
  }
}
</style>
