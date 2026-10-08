<script setup lang="ts">
/* Пиксели и DPI: один и тот же файл 3000 px по ширине. На экране важны
   только пиксели, на бумаге — сколько пикселей приходится на дюйм. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { file: 'файл 3000 px', print300: '300 DPI → 25 см', print150: '150 DPI → 51 см', sharp: 'резко', soft: 'мягче, видно вблизи', formula: 'см = пиксели ÷ DPI × 2,54' },
  en: { file: '3000 px file', print300: '300 DPI → 25 cm', print150: '150 DPI → 51 cm', sharp: 'sharp', soft: 'softer up close', formula: 'cm = pixels ÷ DPI × 2.54' },
})

const uid = useId()
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 280"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <pattern
        :id="`${uid}-px`"
        width="10"
        height="10"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="10"
          height="10"
          class="mid"
        />
        <rect
          width="9"
          height="9"
          class="lit"
          opacity="0.35"
        />
      </pattern>
      <pattern
        :id="`${uid}-px-big`"
        width="20"
        height="20"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="20"
          height="20"
          class="mid"
        />
        <rect
          width="18"
          height="18"
          class="lit"
          opacity="0.35"
        />
      </pattern>
    </defs>

    <!-- Файл: сетка пикселей. -->
    <rect
      x="16"
      y="40"
      width="120"
      height="120"
      :fill="`url(#${uid}-px)`"
      class="s-ink"
      stroke-width="2"
    />
    <text
      x="76"
      y="186"
      text-anchor="middle"
      class="t-b"
    >{{ L.file }}</text>

    <path
      d="M 148 80 L 196 64 M 188 60 L 196 64 L 190 71"
      class="none s-acc round"
      stroke-width="2"
    />
    <path
      d="M 148 120 L 196 150 M 186 152 L 196 150 L 193 141"
      class="none s-acc round"
      stroke-width="2"
    />

    <!-- 300 DPI: тот же файл на меньшем листе, пиксели мелкие. -->
    <rect
      x="208"
      y="16"
      width="96"
      height="96"
      :fill="`url(#${uid}-px)`"
      class="s-ink"
      stroke-width="2"
    />
    <text
      x="320"
      y="56"
      class="t-b"
    >{{ L.print300 }}</text>
    <text
      x="320"
      y="80"
      class="t-sm t-acc"
    >{{ L.sharp }}</text>

    <!-- 150 DPI: лист вдвое больше, пиксели вдвое крупнее. -->
    <rect
      x="208"
      y="124"
      width="140"
      height="120"
      :fill="`url(#${uid}-px-big)`"
      class="s-ink"
      stroke-width="2"
    />
    <text
      x="362"
      y="176"
      class="t-b"
    >{{ L.print150 }}</text>
    <text
      x="362"
      y="200"
      class="t-sm t-mut"
    >{{ L.soft }}</text>

    <text
      x="16"
      y="270"
      class="t-sm t-mut"
    >{{ L.formula }}</text>
  </svg>
</template>
