<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'
import { isBleedDemoWidget } from '~/utils/demoWidgetCache'
import { widgetDemoSpec } from '~/utils/widgetDemoSpecs'

/* Звёздное поле в полноформатной шапке грузится не лениво, а статически: там
   нет постер-картинки (см. компонент), и ждать асинхронный чанк компонента,
   чтобы показать реальный рендер, незачем — виджет маленький и должен ожить
   сразу после гидрации. Узкий 16:9-режим призмы остаётся ленивым. */

const props = withDefaults(defineProps<{
  project: ProjectsCollectionItem
  /* Полноформатный hero звёздного поля может жить не внутри компонента,
     а в обёртке страницы — тогда канвас рисуется обёрткой за пределами
     hero (чтобы звёзды шли и под «Вернуться к проектам», и под хедером),
     а этот компонент оставляет только текст и затемнение. */
  bleedExternal?: boolean
}>(), {
  bleedExternal: false,
})

const { t } = useI18n()

/* 3D-вьювер грузится лениво: его чанк (three.js + draco wasm, ~0.7 МБ)
   скачивается только на кейсах, где реально есть модель. На кейсах
   с обложкой вместо модели лишний мегабайт не тратится. */
const LazyModelViewer = defineAsyncComponent(() => import('~/components/projects/ProjectModelViewer.vue'))
/* Все WebGL-виджеты кейсов рисует одна оболочка: сцена, панель ползунков
   и жизненный цикл у них общие, различия описаны в widgetDemoSpecs.
   Компонент грузится лениво, а движок под конкретный виджет — своим чанком
   уже изнутри: на странице с одним демо чужие движки не качаются. */
const LazyWidgetDemo = defineAsyncComponent(() => import('~/components/projects/ProjectWidgetDemo.vue'))

const demoWidget = computed(() => (widgetDemoSpec(props.project.demo?.widget) ? LazyWidgetDemo : null))

/* Полноэкранный hero-режим — у виджетов из общего списка (BLEED_DEMO_WIDGETS):
   канвас заливает всю шапку фоном (как сплэш softlogic), текст ложится поверх
   слева, справа остаётся живое поле без контента. Остальные демо остаются
   в своей колонке карточкой 16:9. Список общий для шаблона и страницы. */
const isBleedHero = computed(() => isBleedDemoWidget(props.project.demo?.widget))

/* Объектные виджеты (портрет) в обычном hero растягиваются на всю высоту
   своей колонки: сцена перестаёт быть 16:9-карточкой и занимает половину
   шапки целиком. На узком экране колонка уходит вторым блоком под текст. */
const isHeroFill = computed(() => !isBleedHero.value && !!widgetDemoSpec(props.project.demo?.widget)?.heroFill)

const clientLinkLabel = computed(() => t('project.clientLinkAria', { client: props.project.client }))
</script>

<template>
  <section
    class="project-hero"
    :class="{
      'project-hero--model': (!!project.model || (!!project.demo && !!demoWidget)) && !isBleedHero,
      'project-hero--bleed': isBleedHero,
      'project-hero--fill': isHeroFill,
      /* Канвас рисует обёртка страницы позади hero: весь hero-бокс прозрачен
         для указателя, иначе он перехватывал бы события и курсор-«планета»
         работал бы только в промежутках между блоками. */
      'project-hero--pointerless': isBleedHero && props.bleedExternal,
    }"
    aria-labelledby="project-hero-title"
  >
    <!-- Полноформатный режим: канвас лежит абсолютом позади текста и
         заполняет шапку целиком от края до края. Если канвас рисует обёртка
         страницы (`bleedExternal`), здесь он не нужен — иначе рендер
         задвоится. Виджет выбирается по типу из контента, как и в колонке. -->
    <component
      :is="demoWidget"
      v-if="project.demo && demoWidget && isBleedHero && !props.bleedExternal"
      :demo="project.demo"
      :poster="project.cover.src"
      :poster-alt="project.cover.alt"
      variant="bleed"
    />

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

      <div
        v-if="!isBleedHero"
        class="project-hero__visual"
      >
        <!-- Живой WebGL-виджет вместо обложки: без панели параметров —
             она живёт ниже по странице, чтобы шапка оставалась чистой. -->
        <component
          :is="demoWidget"
          v-if="project.demo && demoWidget"
          :demo="project.demo"
          :poster="project.cover.src"
          :poster-alt="project.cover.alt"
          variant="hero"
        />
        <!-- Живая 3D-модель вместо обложки: постером служит сама обложка,
             модель плавно заменяет её после загрузки. -->
        <LazyModelViewer
          v-else-if="project.model"
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
          :fit="project.model.fit"
          :canvas-scale="project.model.canvasScale"
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

/* Объектный виджет (портрет, облако точек) в своей колонке справа.
   Высота всего hero остаётся прежней: раньше её набирали крупные вертикальные
   отступы плюс 16:9-карточка, теперь отступы минимальные, а освободившееся
   место забирает сама сцена. Итоговый блок примерно той же высоты, но
   интерактив в нём заметно крупнее. Текст — слева, отдельной колонкой:
   сцена под него не заходит. */
.project-hero--fill {
  padding-block: clamp(8px, 1vw, 16px) clamp(12px, 1.5vw, 20px);
}

.project-hero--fill .project-hero__inner {
  align-items: stretch;
}

.project-hero--fill .project-hero__text {
  justify-content: center;
}

/* Узкий экран: колонка уходит вторым блоком под текст, высоту задаём сами —
   тянуться там не за чем. */
.project-hero--fill .project-hero__visual {
  min-height: min(62vh, 520px);
}

@media (min-width: 1024px) {
  /* Ряд получает реальную высоту, и сцена растягивается на неё целиком.
     Без этого `height: 100%` у сцены упирался бы в высоту текстовой колонки
     и виджет снова схлопывался бы в маленькую карточку.

     Тянуть сцену вплотную к хедеру смысла не имеет: объект внутри вписан
     по своим пропорциям и всё равно встаёт с отступом от краёв канваса —
     видно было бы то же пустое место, только выше. Вместо этого даём сцене
     больше высоты: объект вписан по высоте, поэтому растёт вместе с ней. */
  .project-hero--fill .project-hero__visual {
    min-height: min(74vh, 680px);
  }
}

/* Полноформатный hero: канвас — фон всей шапки, текст ложится поверх слева.
   Поле живёт на фоне сайта и следует его теме (палитра перекрашивается
   через recolor), поэтому текстовые токены не переопределяем — они
   приходят из темы сайта как обычно. */
.project-hero--bleed {
  position: relative;
  isolation: isolate;
  overflow: clip;
  padding-block: clamp(48px, 6vw, 88px) clamp(64px, 8vw, 120px);
}

/* Когда hero — только текст поверх канваса обёртки, весь его бокс прозрачен
   для мыши (текст и так не кликабелен, кроме ссылок — им возвращаем клики). */
.project-hero--bleed.project-hero--pointerless {
  pointer-events: none;
}

.project-hero--bleed .project-hero__text {
  position: relative;
  z-index: 2;
}

/* Текст-оверлей прозрачен для указателя: курсор-«планета» и расталкивание
   звёзд должны работать на всей шапке, включая область под заголовком.
   Ссылкам и кнопкам возвращаем клики. */
.project-hero--bleed .project-hero__inner {
  pointer-events: none;
}

.project-hero--bleed .project-hero__inner a,
.project-hero--bleed .project-hero__inner button {
  pointer-events: auto;
}

.project-hero--bleed .project-hero__inner {
  align-items: center;
}

@media (min-width: 1024px) {
  /* Текст держится в левой колонке, поле продолжается справа за ним. */
  .project-hero--bleed .project-hero__inner {
    grid-template-columns: minmax(0, 44rem) minmax(0, 1fr);
  }
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
