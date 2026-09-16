<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'
import { ipxVersionModifier } from '~/utils/imageVersion'

const props = withDefaults(
  defineProps<{
    project: ProjectsCollectionItem
    emphasis?: 'lead' | 'tall' | 'default'
    sizes?: string
  }>(),
  {
    emphasis: 'default',
    sizes: '100vw md:50vw xl:640px',
  },
)

const { t } = useI18n()
const { project: projectPath } = useSiteRoutes()

const leadMetric = computed(() => props.project.metrics[0])
const services = computed(() => props.project.services.slice(0, 2))

/*
 * Картинка карточки.
 *
 * Источники собираются вручную, а не через `NuxtPicture`: у `<source>` этого
 * компонента нет `media`, поэтому art direction им не выразить, а кейсу нужна
 * вторая композиция для узких экранов (на телефоне общий кадр сжимается так,
 * что не читается ни объект, ни подписи на нём). Провайдер, ширины, форматы и
 * `sizes` — те же, что были у `NuxtPicture`: `avif`, `webp`, последним JPEG (он
 * же `<img>` — фолбэк для браузеров без `<source>`).
 *
 * Мобильной композиции может не быть: тогда карточка ведёт себя как прежде —
 * один источник на все экраны.
 */
const $img = useImage()

/* Версия картинки в адресе варианта: без неё замена обложки под тем же именем
   файла осталась бы в кэше браузера и CDN. См. `app/utils/imageVersion.ts`. */
const imageVersions = useRuntimeConfig().public.imageVersions

const PICTURE_FORMATS = ['avif', 'webp'] as const
/* Должно совпадать с медиазапросом в стилях ниже (пропорция мобильной картинки). */
const MOBILE_MEDIA = '(max-width: 767px)'

interface CardPictureSource {
  type: string
  srcset: string
  /* Провайдер вправе не вернуть `sizes` (тогда браузер берёт атрибут у `<img>`). */
  sizes?: string
}

const mobileCover = computed(() => props.project.cover.mobile)

/* Модификаторы запроса к провайдеру: формат варианта плюс версия исходника.

   Тип модификаторов библиотека выводит из провайдера по умолчанию, а он
   зависит от окружения сборки: локально и в CI это `ipx`, на Vercel — `vercel`
   (в проде адреса идут через `/_vercel/image`). У Vercel-провайдера `format`
   объявлен не в модификаторах, а на уровне опций, поэтому объектный литерал с
   ним не проходит проверку типов ровно на сборке деплоя. На деле `format` —
   обычный проп `NuxtImg`: библиотека кладёт его в те же модификаторы. Держим
   объект свободным, чтобы карточка проверялась при любом провайдере. */
function pictureModifiers(src: string, format: string): Record<string, string> {
  return { format, ...ipxVersionModifier(src, imageVersions) }
}

function pictureSources(src: string): CardPictureSource[] {
  return PICTURE_FORMATS.map((format) => {
    const { srcset, sizes } = $img.getSizes(src, {
      sizes: props.sizes,
      modifiers: pictureModifiers(src, format),
    })
    return { type: `image/${format}`, srcset, sizes }
  })
}

const mobileSources = computed(() => (mobileCover.value ? pictureSources(mobileCover.value.src) : []))
const desktopSources = computed(() => pictureSources(props.project.cover.src))
const fallback = computed(() => $img.getSizes(props.project.cover.src, {
  sizes: props.sizes,
  modifiers: pictureModifiers(props.project.cover.src, 'jpeg'),
}))

/* Пропорция мобильной композиции своя, и карточка обязана её взять: иначе
   `object-fit: cover` обрежет именно то, ради чего картинка собрана. */
const pictureStyle = computed(() => (mobileCover.value
  ? { '--project-cover-mobile-ratio': `${mobileCover.value.width} / ${mobileCover.value.height}` }
  : undefined))
</script>

<template>
  <NuxtLink
    :to="projectPath(project.slug)"
    class="project-card"
    :class="[`project-card--${emphasis}`, { 'project-card--cover-mobile': !!mobileCover }]"
  >
    <span class="project-card__media">
      <picture
        class="project-card__picture"
        :style="pictureStyle"
      >
        <!-- Узкие экраны берут мобильную композицию, если она есть у кейса. -->
        <source
          v-for="source in mobileSources"
          :key="`mobile-${source.type}`"
          :media="MOBILE_MEDIA"
          :type="source.type"
          :sizes="source.sizes"
          :srcset="source.srcset"
        >
        <source
          v-for="source in desktopSources"
          :key="`desktop-${source.type}`"
          :type="source.type"
          :sizes="source.sizes"
          :srcset="source.srcset"
        >
        <img
          class="project-card__image"
          :src="fallback.src"
          :srcset="fallback.srcset"
          :sizes="sizes"
          :width="project.cover.width"
          :height="project.cover.height"
          :alt="project.cover.alt"
          loading="lazy"
          decoding="async"
        >
      </picture>

      <!-- Живое превью: у кейсов с WebGL-виджетом (GlukePyramid, Constellation)
           обложка после простоя страницы уступает место настоящему рендеру.
           Пока виджет не ожил (и навсегда при «уменьшить движение»/без WebGL)
           поверх прозрачен — видна обложка. -->
      <ProjectsProjectCardDemo
        v-if="project.demo?.widget"
        :demo="project.demo"
      />
    </span>

    <span class="project-card__body">
      <span class="project-card__meta text-label text-dimmed">
        <span>{{ project.client }}</span>
        <span aria-hidden="true">/</span>
        <span>{{ project.industry }}</span>
      </span>

      <h3
        class="text-heading project-card__title"
        :class="emphasis === 'lead' ? 'text-heading--md' : 'text-heading--sm'"
      >
        {{ project.title }}
      </h3>

      <span
        v-if="leadMetric"
        class="project-card__metric"
      >
        <span class="text-heading text-heading--sm project-card__metric-value">{{ leadMetric.value }}</span>
        <span class="text-body--sm project-card__metric-label">{{ leadMetric.label }}</span>
      </span>

      <span class="project-card__footer">
        <span class="project-card__services">
          <span
            v-for="service in services"
            :key="service"
            class="project-card__service text-body--sm"
          >
            {{ service }}
          </span>
        </span>
      </span>

      <span class="project-card__go text-label">
        <span class="project-card__period text-body--sm">{{ project.period }}</span>
        <span class="project-card__go-link">
          <span>{{ t('projects.card.view') }}</span>
          <span
            class="project-card__arrow"
            aria-hidden="true"
          >→</span>
        </span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  min-width: 0;
  height: 100%;
  padding: clamp(16px, 1.6vw, 24px);
  border: var(--site-border);
  border-radius: var(--site-radius-lg);
  background-color: var(--site-surface);
  color: var(--site-text);
  transition: border-color 150ms ease, background-color 150ms ease;
}

.project-card__media {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: var(--site-radius-md);
  background-color: var(--site-media-canvas);
}

/* У карточек с живым виджетом подложки нет вовсе — фон даёт карточка. */
.project-card__media:has(.project-card-demo--live) {
  background-color: transparent;
}

.project-card__picture {
  display: block;
  transition: opacity 500ms ease;
}

/* Живой виджет рисует прозрачным канвасом, поэтому под ним не должно
   оставаться тёмной обложки: как только превью ожило — гасим картинку и
   виджет ложится прямо на поверхность карточки. */
.project-card__media:has(.project-card-demo--live) .project-card__picture {
  opacity: 0;
}

.project-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: 16 / 9;
  transition: transform 250ms ease;
}

.project-card--lead .project-card__image {
  aspect-ratio: 16 / 9;
}

/* Узкий экран: у мобильной композиции своя пропорция, и карточка её берёт —
   иначе общий кадр обрежется по 16:9 и ряд разделов уедет за кадр. Без
   мобильной картинки правило не действует: у остальных кейсов всё как было.
   Медиазапрос совпадает с MOBILE_MEDIA в скрипте. */
@media (max-width: 767px) {
  .project-card--cover-mobile .project-card__image {
    aspect-ratio: var(--project-cover-mobile-ratio, 16 / 9);
  }
}

.project-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.project-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-card__title {
  color: var(--site-text);
  text-wrap: balance;
  overflow-wrap: anywhere;
  transition: color 150ms ease;
}

.project-card__metric {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
}

.project-card__metric-value {
  color: var(--site-accent-text);
}

.project-card__metric-label {
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.project-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding-top: 12px;
  border-top: var(--site-border);
}

.project-card__services {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.project-card__service {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: var(--site-border);
  border-radius: var(--site-radius-sm);
  color: var(--site-text-secondary);
  overflow-wrap: anywhere;
}

.project-card__period {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}

/* Годы и «СМОТРЕТЬ КЕЙС» в одной строке: годы слева, ссылка прижата вправо.
   Так во всех карточках годы стоят напротив CTA и не прыгают по строкам. */
.project-card__go {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  min-height: 44px;
}

.project-card__go-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--site-accent-text);
}

.project-card__arrow {
  transition: transform 200ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .project-card:hover {
    border-color: var(--site-text-muted);
    background-color: var(--site-surface-raised);
  }

  .project-card:hover .project-card__image {
    transform: scale(1.03);
  }

  .project-card:hover .project-card__title {
    color: var(--site-text);
  }

  .project-card:hover .project-card__arrow {
    transform: translateX(4px);
  }
}

@media (min-width: 1024px) {
  .project-card--lead {
    padding: clamp(24px, 2vw, 32px);
  }

  /* Узкая карточка растянута на высоту широкого соседа. Свободную высоту забирает
     обложка, поэтому текстовый блок остаётся плотным, без провала в середине. */
  .project-card--tall .project-card__media {
    flex: 1;
    min-height: clamp(220px, 18vw, 320px);
  }

  .project-card--tall .project-card__picture,
  .project-card--tall .project-card__image {
    height: 100%;
  }

  .project-card--tall .project-card__image {
    aspect-ratio: auto;
  }

  .project-card--tall .project-card__body {
    flex: 0 0 auto;
  }

  .project-card--tall .project-card__metric {
    margin-top: 0;
  }
}
</style>
