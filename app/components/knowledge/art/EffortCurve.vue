<script setup lang="ts">
/* Как растёт объём работы с числом вариантов и ракурсов. У фото каждый
   новый кадр — почти та же работа. У 3D основная работа — модель в начале,
   дальше каждый вариант дешевле. Чисел нет: точка пересечения у каждого
   проекта своя. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { x: 'вариантов и ракурсов →', y: 'объём работы', photo: 'фото', render: '3D', model: 'модель' },
  en: { x: 'variants and angles →', y: 'amount of work', photo: 'photo', render: '3D', model: 'model' },
})
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 280"
    role="img"
    :aria-label="alt"
  >
    <line
      x1="60"
      y1="230"
      x2="500"
      y2="230"
      class="s-ink"
      stroke-width="2"
    />
    <line
      x1="60"
      y1="230"
      x2="60"
      y2="20"
      class="s-ink"
      stroke-width="2"
    />
    <text
      x="500"
      y="260"
      text-anchor="end"
      class="t-sm t-mut"
    >{{ L.x }}</text>
    <text
      x="0"
      y="0"
      class="t-sm t-mut"
      transform="translate(40 230) rotate(-90)"
    >{{ L.y }}</text>

    <!-- Фото: прямая, каждый кадр почти та же работа. -->
    <path
      d="M 60 222 L 480 40"
      class="none s-mut"
      stroke-width="3"
      stroke-dasharray="10 6"
    />
    <text
      x="430"
      y="44"
      class="t-b t-mut"
    >{{ L.photo }}</text>

    <!-- 3D: модель в начале, дальше пологий рост. -->
    <path
      d="M 60 230 L 60 160 C 140 150 300 140 480 112"
      class="none s-acc"
      stroke-width="3.5"
    />
    <rect
      x="64"
      y="166"
      width="62"
      height="24"
      rx="12"
      class="acc"
    />
    <text
      x="95"
      y="183"
      text-anchor="middle"
      class="t-sm t-b t-onacc"
    >{{ L.model }}</text>
    <text
      x="440"
      y="104"
      class="t-b t-acc"
    >{{ L.render }}</text>

    <circle
      cx="252"
      cy="140"
      r="7"
      class="none s-acc"
      stroke-width="2.5"
    />
  </svg>
</template>
