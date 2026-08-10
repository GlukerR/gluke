<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'

const props = defineProps<{
  cta: SiteCollectionItem['hero']['primaryCta']
  contacts: SiteCollectionItem['contacts']
}>()

const { t } = useI18n()

const emailContact = computed(() => props.contacts.find(contact => contact.channel === 'email'))
const isExternal = computed(() => props.cta.href.startsWith('https://'))
</script>

<template>
  <section
    class="project-contact"
    aria-labelledby="project-contact-title"
  >
    <div class="site-container">
      <div class="project-contact__panel">
        <h2
          id="project-contact-title"
          class="text-heading text-heading--md project-contact__title"
        >
          {{ t('home.contact.title') }}
        </h2>

        <div class="project-contact__actions">
          <a
            :href="cta.href"
            :target="isExternal ? '_blank' : undefined"
            :rel="isExternal ? 'noopener noreferrer' : undefined"
            class="project-contact__cta text-body"
          >
            {{ cta.label }}
          </a>

          <a
            v-if="emailContact"
            :href="emailContact.href"
            class="project-contact__secondary text-body--sm"
          >
            {{ emailContact.label }}: {{ emailContact.value }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Снизу — полный разрыв: дальше идёт граница футера. */
.project-contact {
  padding-block:
    var(--project-space, clamp(28px, 3.2vw, 56px))
    var(--project-space-edge, clamp(56px, 6.4vw, 104px));
}

.project-contact__panel {
  display: flex;
  flex-direction: column;
  gap: clamp(24px, 3vw, 40px);
  padding: clamp(28px, 5vw, 64px);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-accent);
  color: var(--site-accent-fg);
}

.project-contact__title {
  max-width: 18ch;
  color: var(--site-accent-fg);
}

.project-contact__actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
  min-width: 0;
}

.project-contact__cta {
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

.project-contact__cta:hover {
  background-color: var(--site-on-accent-surface-hover);
}

.project-contact__cta:focus-visible {
  outline-color: var(--site-accent-fg);
}

.project-contact__secondary {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--site-accent-fg);
  text-decoration: underline;
  text-underline-offset: 4px;
  overflow-wrap: anywhere;
}

@media (max-width: 419px) {
  .project-contact__cta {
    width: 100%;
  }
}

@media (min-width: 1024px) {
  .project-contact__panel {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: clamp(40px, 5vw, 96px);
  }

  .project-contact__actions {
    align-items: flex-end;
  }
}
</style>
