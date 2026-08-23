<script setup lang="ts">
import type { ProjectsCollectionItem } from '@nuxt/content'

type ProjectMedia = ProjectsCollectionItem['media'][number]

const props = defineProps<{
  item: ProjectMedia
  sizes: string
  fallbackVideoPoster: string
}>()

/* 3D-вьювер грузится лениво (чанк three.js + draco wasm ~0.7 МБ):
   скачивается только когда в галерее есть модель. */
const LazyModelViewer = defineAsyncComponent(() => import('~/components/projects/ProjectModelViewer.vue'))

const { t } = useI18n()

const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
}

const isVideo = computed(() => props.item.kind === 'video')
const isModel = computed(() => props.item.kind === '3d')
const isLoop = computed(() => props.item.kind === 'video' && Boolean(props.item.loop))
const isAutoplayVideo = computed(() => props.item.kind === 'video' && Boolean(props.item.autoplay))

/* Собственный `poster` материала всегда приоритетнее обложки кейса. */
const posterSrc = computed(() => props.item.poster ?? props.fallbackVideoPoster)

const videoType = computed(() => {
  const extension = props.item.src.split('.').pop()?.toLowerCase() ?? ''

  return VIDEO_MIME_TYPES[extension]
})

/* Стартовая секунда ролика: сдвигает начало воспроизведения, чтобы соседние
   видео в галерее не стартовали синхронно. */
const videoEl = ref<HTMLVideoElement | null>(null)

function seekToStart(event: Event): void {
  const start = props.item.startAt

  if (!start || start <= 0) {
    return
  }

  const video = event.currentTarget as HTMLVideoElement
  video.currentTime = start
}

/* Видео не скачивается, пока галерея не подошла к вьюпорту: autoplay-ролики
   с preload="auto" иначе начинали качаться целиком прямо при загрузке страницы,
   хотя галерея лежит под скроллом (на мобильном это 5–11 МБ трафика за кейс).
   До приближения элемент висит с preload="none" и показывает постер. */
const videoReady = ref(false)
const videoFrame = ref<HTMLElement | null>(null)
let videoObserver: IntersectionObserver | null = null

onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    videoReady.value = true
    return
  }

  /* Запас пропорционален высоте вьюпорта (1.2 экрана), а не фиксированный:
     на мобильном 1500px покрывали бы 2+ экрана и заставляли качать видео,
     которые лежат далеко под скроллом, отнимая полосу у LCP-картинки hero. */
  const marginPx = Math.max(800, Math.round(window.innerHeight * 1.2))

  videoObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        videoReady.value = true
        videoObserver?.disconnect()
      }
    },
    { rootMargin: `${marginPx}px 0px` },
  )

  if (videoFrame.value) {
    videoObserver.observe(videoFrame.value)
  }
})

onBeforeUnmount(() => {
  videoObserver?.disconnect()
})

/* После появления рядом с вьюпортом запускаем автовоспроизведение вручную:
   одной установки атрибута `autoplay` постфактум в ряде браузеров
   недостаточно, чтобы начать воспроизведение. */
watch(videoReady, (ready) => {
  if (!ready) {
    return
  }

  const video = videoEl.value

  if (video && (isLoop.value || isAutoplayVideo.value)) {
    video.play().catch(() => {})
  }
})

/* При SSR браузер может загрузить метаданные видео раньше, чем Vue привяжет
   обработчик `loadedmetadata` (событие уже отгремело). Тогда сдвиг применяется
   здесь, сразу после гидратации. */
onMounted(() => {
  const start = props.item.startAt
  const video = videoEl.value

  if (start && start > 0 && video && video.readyState >= 1) {
    video.currentTime = start
  }
})
</script>

<template>
  <figure
    ref="videoFrame"
    class="project-media"
  >
    <!-- Зацикленная фоновая анимация: без контролов, играет всегда.
         До подхода к вьюпорту висит постер с preload="none" — файл
         не скачивается, пока галерея не рядом. Свой постер показываем
         только если он есть у ролика: фолбэк на обложку кейса не грузим,
         иначе на мобильном качался бы сырой PNG-файл обложки ради того,
         чтобы посветить им под скроллом. -->
    <video
      v-if="isLoop && !isAutoplayVideo"
      :src="item.src"
      :aria-label="item.alt"
      :width="item.width"
      :height="item.height"
      :poster="videoReady ? undefined : (item.poster ?? undefined)"
      :style="{ aspectRatio: `${item.width} / ${item.height}` }"
      ref="videoEl"
      class="project-media__video project-media__video--loop"
      :autoplay="videoReady"
      muted
      loop
      playsinline
      :preload="videoReady ? 'auto' : 'none'"
      @loadedmetadata="seekToStart"
    />

    <!-- Видео с автозапуском: играет само, звук изначально выключен,
         но контролы видны сразу — значок выключенного звука на месте.
         С флагом `loop` сразу же запускается заново после окончания.
         До подхода к вьюпорту — свой постер и preload="none". -->
    <video
      v-else-if="isAutoplayVideo"
      :aria-label="item.alt"
      :width="item.width"
      :height="item.height"
      :poster="videoReady ? undefined : (item.poster ?? undefined)"
      ref="videoEl"
      class="project-media__video project-media__video--autoplay"
      :autoplay="videoReady"
      muted
      controls
      playsinline
      :preload="videoReady ? 'auto' : 'none'"
      :loop="Boolean(item.loop)"
      @loadedmetadata="seekToStart"
    >
      <source
        :src="item.src"
        :type="videoType"
      >
      {{ t('project.media.unsupported') }}
      <a
        :href="item.src"
        class="project-media__fallback"
      >{{ t('project.media.openFile') }}</a>
    </video>

    <video
      v-else-if="isVideo"
      :aria-label="item.alt"
      :width="item.width"
      :height="item.height"
      :poster="posterSrc"
      class="project-media__video"
      controls
      playsinline
      :preload="videoReady ? 'metadata' : 'none'"
    >
      <source
        :src="item.src"
        :type="videoType"
      >
      {{ t('project.media.unsupported') }}
      <a
        :href="item.src"
        class="project-media__fallback"
      >{{ t('project.media.openFile') }}</a>
    </video>

    <LazyModelViewer
      v-else-if="isModel"
      :src="item.src"
      :alt="item.alt"
      :width="item.width"
      :height="item.height"
      :poster="posterSrc"
      :auto-rotate="item.autoRotate ?? true"
    />

    <NuxtPicture
      v-else
      :src="item.src"
      :alt="item.alt"
      :width="item.width"
      :height="item.height"
      :sizes="sizes"
      format="avif,webp"
      loading="lazy"
      decoding="async"
      class="project-media__picture"
      :img-attrs="{ class: 'project-media__image' }"
    />

    <figcaption
      v-if="item.caption"
      class="text-body--sm project-media__caption"
    >
      {{ item.caption }}
    </figcaption>
  </figure>
</template>

<style scoped>
.project-media {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0;
}

.project-media__picture {
  display: block;
  overflow: hidden;
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  background-color: var(--site-media-canvas);
}

/* `height: auto` keeps the intrinsic ratio of every source image intact. */
.project-media__picture :deep(.project-media__image) {
  width: 100%;
  height: auto;
}

.project-media__video {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  /* Тёмная подложка из токенов: до отрисовки постера нет белой вспышки,
     а постер с другим соотношением сторон вписывается без искажений. */
  background-color: var(--site-media-canvas);
  object-fit: contain;
}

/* Рамка зацикленного видео всегда следует пропорциям самого видео,
   а не постера: квадратные анимации остаются квадратными с первого кадра.
   Подложка следует теме (тёмная/светлая), а не остаётся тёмной как у PNG. */
.project-media__video--loop {
  aspect-ratio: 1 / 1;
  background-color: var(--site-media-canvas-loop);
}

.project-media__fallback {
  color: var(--site-accent-text);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.project-media__caption {
  color: var(--site-text-muted);
  overflow-wrap: anywhere;
}
</style>
