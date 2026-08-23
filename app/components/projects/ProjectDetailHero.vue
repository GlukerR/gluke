<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

const props = defineProps<{ project: ProjectsCollectionItem }>()

const { t } = useI18n()

/* 3D-вьювер грузится лениво: его чанк (three.js + draco wasm, ~0.7 МБ)
   скачивается только на кейсах, где реально есть модель. На кейсах
   с обложкой вместо модели лишний мегабайт не тратится. */
const LazyModelViewer = defineAsyncComponent(() => import('~/components/projects/ProjectModelViewer.vue'))

const clientLinkLabel = computed(() => t('project.clientLinkAria', { client: props.project.client }))
</script>

<template>
  <section
    class="project-hero"
    :class="{ 'project-hero--model': !!project.model }"
    aria-labelledby="project-hero-title"
  >
    <div class="site-container project-hero__inner">
      <div class="project-hero__text">
        <p class="text-label text-accent project-hero__meta">
          <span>{{ project.client }}</span>
          <span aria-hidden="true">/</span>
          <span>{{ project.industry }}</span>
        </p>

        <h1
          id="project-hero-title"
          class="text-display text-highlighted project-hero__title"
        >
          {{ project.title }}
        </h1>

        <p class="text-body project-hero__description">
          {{ project.description }}
        </p>

        <dl class="project-hero__facts">
          <div class="project-hero__fact">
            <dt class="text-label text-dimmed">
              {{ t('project.period') }}
            </dt>
            <dd class="text-body--sm project-hero__fact-value">
              {{ project.period }}
            </dd>
          </div>

          <div
            v-if="project.duration"
            class="project-hero__fact"
          >
            <dt class="text-label text-dimmed">
              {{ t('project.duration') }}
            </dt>
            <dd class="text-body--sm project-hero__fact-value">
              {{ project.duration }}
            </dd>
          </div>
        </dl>

        <a
          v-if="project.clientUrl"
          :href="project.clientUrl"
          :aria-label="clientLinkLabel"
          target="_blank"
          rel="noopener noreferrer"
          class="project-hero__client-link text-body--sm"
        >
          <span>{{ t('project.clientLink') }}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div class="project-hero__visual">
        <!-- Живая 3D-модель вместо обложки: постером служит сама обложка,
             модель плавно заменяет её после загрузки. -->
        <LazyModelViewer
          v-if="project.model"
          :src="project.model.src"
          :alt="project.model.alt"
          :width="project.model.width"
          :height="project.model.height"
          :poster="project.cover.src"
          :auto-rotate="project.model.autoRotate ?? true"
          :emissive-pulse="project.model.emissivePulse"
          :emissive-pulse-hz="project.model.emissivePulseHz"
          :metalness="project.model.metalness"
          :diffuse-lift="project.model.diffuseLift"
          :rotation="project.model.rotation"
          :auto-rotate-speed="project.model.autoRotateSpeed"
          :environment-intensity="project.model.environmentIntensity"
          :hemisphere-light="project.model.hemisphereLight"
          :key-light="project.model.keyLight"
          :fill-light="project.model.fillLight"
          :zoom-min="project.model.zoomMin"
          :zoom-max="project.model.zoomMax"
          priority
        />
        <!-- Без `preload`: `<link rel=preload imagesrcset>` Chrome грузит с Low
             приоритетом, и LCP-картинка ждёт весь JS/wasm. Достаточно eager-атрибута
             и fetchpriority=high на самом img — он в SSR-HTML почти сразу после шапки
             и качается первым. -->
        <NuxtPicture
          v-else
          :src="project.cover.src"
          :alt="project.cover.alt"
          :width="project.cover.width"
          :height="project.cover.height"
          sizes="100vw lg:58vw xl:1000px"
          format="avif,webp"
          loading="eager"
          decoding="async"
          :img-attrs="{ class: 'project-hero__image', fetchpriority: 'high' }"
          class="project-hero__picture"
        />
        <p
          v-if="project.cover.caption"
          class="text-body--sm project-hero__caption"
        >
          {{ project.cover.caption }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.project-hero {
  padding-block: clamp(32px, 4vw, 64px) clamp(48px, 6vw, 96px);
}

.project-hero__inner {
  display: grid;
  gap: clamp(28px, 4vw, 48px);
  align-items: center;
}

.project-hero__text {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  min-width: 0;
}

.project-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-hero__title {
  max-width: 18ch;
  /* Project titles wrap on spaces only; mid-word breaks are never acceptable. */
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
  font-size: var(--type-h1);
  line-height: var(--type-h1-leading);
  letter-spacing: var(--type-h1-tracking);
}

.project-hero__description {
  max-width: 56ch;
  color: var(--site-text-secondary);
}

.project-hero__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
}

.project-hero__fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.project-hero__fact-value {
  color: var(--site-text);
  overflow-wrap: anywhere;
}

.project-hero__client-link {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  min-height: 44px;
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 4px;
  overflow-wrap: anywhere;
  transition: color 150ms ease;
}

.project-hero__client-link:hover {
  color: var(--site-accent-text-hover);
}

.project-hero__visual {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.project-hero__picture {
  display: block;
  overflow: hidden;
  border: var(--site-border);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-media-canvas);
}

.project-hero__picture :deep(.project-hero__image) {
  width: 100%;
  height: auto;
}

.project-hero__caption {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

/* 3D-модель выходит за границы своей колонки: не даём ей создавать
   горизонтальный скролл, а текст оставляем поверх модели, чтобы читался. */
.project-hero--model {
  overflow: clip;
}

.project-hero--model .project-hero__text {
  position: relative;
  z-index: 1;
}

@media (min-width: 1024px) {
  .project-hero__inner {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    gap: clamp(40px, 4vw, 72px);
  }

  .project-hero__title {
    font-size: clamp(2.5rem, 3.4vw, 3.25rem);
    max-width: 14em;
  }
}
</style>
