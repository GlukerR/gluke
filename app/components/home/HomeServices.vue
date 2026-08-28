<script setup lang="ts">
import type { HomeService } from '~/utils/home-services'

defineProps<{ services: HomeService[] }>()

const { t } = useI18n()
const { project: projectPath } = useSiteRoutes()

function formatIndex(index: number): string {
  return String(index + 1).padStart(2, '0')
}
</script>

<template>
  <section
    id="services"
    class="site-section site-anchor home-services"
    aria-labelledby="home-services-title"
  >
    <div class="site-container home-services__inner">
      <HomeSectionHeader
        :eyebrow="t('home.services.eyebrow')"
        :title="t('home.services.title')"
        title-id="home-services-title"
      />

      <ul class="home-services__list">
        <li
          v-for="(service, index) in services"
          :key="service.id"
          class="home-services__item"
        >
          <p
            class="home-services__number text-label"
            aria-hidden="true"
          >
            {{ formatIndex(index) }}
          </p>

          <h3 class="text-heading text-heading--sm home-services__title">
            {{ service.title }}
          </h3>

          <p class="text-body--sm home-services__description">
            {{ service.description }}
          </p>

          <div class="home-services__proof">
            <p class="text-label home-services__proof-label">
              {{ t('home.services.proofLabel') }}
            </p>
            <p class="text-body--sm home-services__proof-value">
              <template
                v-for="(company, companyIndex) in service.proof"
                :key="`${company.label}-${companyIndex}`"
              >
                <NuxtLink
                  v-if="company.slug"
                  :to="projectPath(company.slug)"
                  class="home-services__proof-link"
                >
                  {{ company.label }}
                </NuxtLink>
                <span v-else>{{ company.label }}</span>
                <span v-if="companyIndex < service.proof.length - 1">, </span>
              </template>
            </p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* Услуги идут сразу после проектов — верхний отступ меньше стандартного,
   чтобы секции стояли ближе друг к другу. */
.home-services {
  padding-top: calc(var(--site-section-space) * 0.5);
}

.home-services__inner {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 56px);
}

.home-services__list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(16px, 2vw, 24px);
}

/* Каждая услуга — отдельный фрейм: рамка и подложка, чтобы разная высота
   содержимого не «разъезжалась» между колонками. */
.home-services__item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: clamp(20px, 2.5vw, 28px);
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  background-color: var(--site-surface);
}

.home-services__number {
  color: var(--site-accent-text);
}

.home-services__title {
  color: var(--site-text);
  text-wrap: balance;
}

.home-services__description {
  max-width: 52ch;
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

/* Подпись и список компаний — отдельными строками в одном блоке,
   прижатом к низу карточки: так они выровнены напротив друг друга во всех карточках. */
.home-services__proof {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

.home-services__proof-label {
  color: var(--site-text-muted);
}

.home-services__proof-value {
  color: var(--site-text-muted);
}

.home-services__proof-link {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.home-services__proof-link:hover {
  color: var(--site-accent-text-hover);
}

@media (min-width: 768px) {
  .home-services__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(24px, 3vw, 48px);
  }

  /* Ровная высота под заголовок на две строки: описания и «Где применяли»
     начинаются на одном уровне во всех карточках ряда. */
  .home-services__title {
    min-height: calc(2 * var(--type-h3) * var(--type-h3-leading));
  }
}

@media (min-width: 1280px) {
  .home-services__list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
