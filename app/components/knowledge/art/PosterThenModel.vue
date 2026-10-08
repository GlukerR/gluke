<script setup lang="ts">
/* Загрузка модели на странице: сначала картинка-постер того же ракурса,
   пока модель качается — полоска загрузки, потом модель подменяет постер
   и её можно вращать. Страница не стоит пустой ни секунды. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { s1: 'сразу: постер', s2: 'модель грузится', s3: 'можно вращать' },
  en: { s1: 'at once: poster', s2: 'model loading', s3: 'ready to rotate' },
})

const panels = ['s1', 's2', 's3'] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 220"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(panel, index) in panels"
      :key="panel"
      :transform="`translate(${8 + index * 172} 10)`"
    >
      <rect
        x="0"
        y="0"
        width="156"
        height="150"
        rx="10"
        class="soft s-line"
        stroke-width="2"
      />
      <ellipse
        cx="78"
        cy="122"
        rx="34"
        ry="5"
        class="shadow"
      />
      <g
        class="s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
        :opacity="index === 1 ? 0.55 : 1"
      >
        <polygon
          points="52,62 92,62 106,50 66,50"
          class="lit"
        />
        <polygon
          points="92,62 106,50 106,108 92,120"
          class="dark"
        />
        <rect
          x="52"
          y="62"
          width="40"
          height="58"
          class="mid"
        />
      </g>
      <template v-if="index === 1">
        <rect
          x="28"
          y="134"
          width="100"
          height="6"
          rx="3"
          class="linef"
        />
        <rect
          x="28"
          y="134"
          width="62"
          height="6"
          rx="3"
          class="acc"
        />
      </template>
      <path
        v-if="index === 2"
        d="M 36 30 a 46 18 0 0 1 84 0 M 112 22 L 120 30 L 110 34"
        class="none s-acc round"
        stroke-width="2.5"
      />
      <text
        x="78"
        y="182"
        text-anchor="middle"
        class="t-sm"
        :class="index === 2 ? 't-b t-acc' : ''"
      >{{ L[panel] }}</text>
      <path
        v-if="index < 2"
        d="M 160 75 H 168"
        class="none s-acc"
        stroke-width="2.5"
      />
    </g>
  </svg>
</template>
