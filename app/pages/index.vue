<!--
  Временная страница: визуальный стенд дизайн-системы.
  Будет заменена настоящей главной страницей GLUKE.
-->
<script setup lang="ts">
interface Swatch {
  name: string
  surfaceClass: string
}

interface TypeSample {
  name: string
  textClass: string
  sample: string
}

const swatches: Swatch[] = [
  { name: 'Фон', surfaceClass: 'bg-default' },
  { name: 'Поверхность', surfaceClass: 'bg-muted' },
  { name: 'Приподнятая', surfaceClass: 'bg-elevated' },
  { name: 'Акцент', surfaceClass: 'bg-primary' },
  { name: 'Контрастная', surfaceClass: 'bg-inverted' },
]

const typeSamples: TypeSample[] = [
  { name: 'Заголовок h1', textClass: 'text-heading', sample: 'Технический 3D' },
  { name: 'Заголовок h2', textClass: 'text-heading text-heading--md', sample: 'Разрезы и сборки' },
  { name: 'Заголовок h3', textClass: 'text-heading text-heading--sm', sample: 'Материалы и свет' },
]
</script>

<template>
  <div class="site-section">
    <div class="site-container flex flex-col gap-[clamp(48px,6vw,96px)]">
      <section class="flex flex-col gap-6">
        <p class="text-label text-primary">
          GLUKE / DESIGN SYSTEM
        </p>
        <h1 class="text-display max-w-[18ch] text-highlighted">
          3D-визуализация, которая объясняет продукт
        </h1>
        <p class="text-body text-muted max-w-[60ch]">
          Стенд для проверки палитры, типографики и базовых компонентов до сборки настоящих секций сайта.
        </p>
        <div class="flex flex-wrap gap-3">
          <UButton
            color="primary"
            size="lg"
          >
            Обсудить проект
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
          >
            Смотреть кейсы
          </UButton>
        </div>
      </section>

      <section class="flex flex-col gap-6">
        <h2 class="text-label text-muted">
          Цвета
        </h2>
        <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <li
            v-for="swatch in swatches"
            :key="swatch.name"
            class="flex flex-col gap-3"
          >
            <span
              class="block h-24 rounded-site-md border border-default"
              :class="swatch.surfaceClass"
            />
            <span class="text-body--sm text-muted">{{ swatch.name }}</span>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-6">
        <h2 class="text-label text-muted">
          Типографика
        </h2>
        <dl class="flex flex-col gap-6 border-t border-default pt-6">
          <div
            v-for="sample in typeSamples"
            :key="sample.name"
            class="flex flex-col gap-2"
          >
            <dt class="text-label text-dimmed">
              {{ sample.name }}
            </dt>
            <dd
              class="text-highlighted"
              :class="sample.textClass"
            >
              {{ sample.sample }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="grid gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-3 rounded-site-lg border border-default bg-muted p-[clamp(20px,3vw,40px)]">
          <h2 class="text-heading text-heading--sm text-highlighted">
            Тёмная поверхность
          </h2>
          <p class="text-body text-muted">
            Основной режим сайта: тёмная база, много воздуха, акцент используется точечно.
          </p>
        </div>
        <div class="flex flex-col gap-3 rounded-site-lg bg-inverted p-[clamp(20px,3vw,40px)] text-inverted">
          <h2 class="text-heading text-heading--sm">
            Светлая поверхность
          </h2>
          <p class="text-body--sm">
            Контрастный блок для смысловых пауз между тёмными секциями.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
