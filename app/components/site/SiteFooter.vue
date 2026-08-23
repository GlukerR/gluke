<script setup lang="ts">
import type { SiteCollectionItem } from '@nuxt/content'
import { siteNavigation } from '~/config/site-navigation'

const props = defineProps<{ site: SiteCollectionItem }>()

const { t } = useI18n()
const { navigation } = useSiteRoutes()
const router = useRouter()

function navigationHref(item: (typeof siteNavigation)[number]): string {
  return router.resolve(navigation(item)).href
}

const primaryContact = computed(() => props.site.contacts.find(contact => contact.primary) ?? props.site.contacts[0])
const secondaryContacts = computed(() => props.site.contacts.filter(contact => contact !== primaryContact.value))

function isWebLink(href: string): boolean {
  return href.startsWith('https://')
}
</script>

<template>
  <footer class="site-footer">
    <div class="site-container site-footer__inner">
      <div class="site-footer__grid">
        <div class="site-footer__brand">
          <p class="text-heading text-heading--sm text-highlighted">
            {{ site.brand.name }}
          </p>
          <p class="text-body--sm site-footer__descriptor">
            {{ site.brand.descriptor }}
          </p>
          <p class="text-body--sm text-dimmed">
            {{ site.brand.founder }}
          </p>
        </div>

        <nav
          :aria-label="t('nav.ariaFooter')"
          class="site-footer__column"
        >
          <p class="text-label text-dimmed">
            {{ t('footer.sections') }}
          </p>
          <ul class="flex flex-col gap-1">
            <li
              v-for="item in siteNavigation"
              :key="item.labelKey"
            >
              <a
                :href="navigationHref(item)"
                class="site-footer__link text-body--sm"
              >
                {{ t(item.labelKey) }}
              </a>
            </li>
          </ul>
        </nav>

        <div class="site-footer__column">
          <p class="text-label text-dimmed">
            {{ t('footer.contacts') }}
          </p>
          <a
            :href="primaryContact.href"
            target="_blank"
            rel="noopener noreferrer"
            class="site-footer__link site-footer__link--primary text-body text-highlighted"
          >
            {{ primaryContact.value }}
          </a>
          <ul class="flex flex-col gap-1">
            <li
              v-for="contact in secondaryContacts"
              :key="contact.channel"
            >
              <a
                :href="contact.href"
                class="site-footer__link text-body--sm"
              >
                {{ contact.value }}
              </a>
            </li>
          </ul>
        </div>

        <div class="site-footer__column">
          <p class="text-label text-dimmed">
            {{ t('footer.proof') }}
          </p>
          <ul class="flex flex-col gap-1">
            <li
              v-for="link in site.proofLinks"
              :key="link.href"
            >
              <a
                :href="link.href"
                :target="isWebLink(link.href) ? '_blank' : undefined"
                :rel="isWebLink(link.href) ? 'noopener noreferrer' : undefined"
                class="site-footer__link text-body--sm"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <p class="text-body--sm text-dimmed site-footer__bottom">
        © {{ site.brand.name }}
      </p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: var(--site-border);
  background-color: var(--site-bg);
}

.site-footer__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(40px, 6vw, 72px);
  padding-block: clamp(56px, 8vw, 112px);
}

.site-footer__grid {
  display: grid;
  gap: clamp(32px, 4vw, 48px);
  grid-template-columns: 1fr;
}

.site-footer__brand,
.site-footer__column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.site-footer__descriptor {
  color: var(--site-text-secondary);
}

.site-footer__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
  transition: color 150ms ease;
}

.site-footer__link:hover {
  color: var(--site-accent-text);
}

.site-footer__link--primary {
  min-height: 48px;
}

.site-footer__bottom {
  border-top: var(--site-border);
  padding-top: 24px;
}

@media (min-width: 768px) {
  .site-footer__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .site-footer__grid {
    grid-template-columns: 1.4fr 1fr 1fr 1.2fr;
  }
}
</style>
