<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* Один и тот же товар на трёх снимках при разном свете выходит тремя
   разными оттенками, а код RAL или физический образец даёт один ответ. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { day: 'окно днём', lamp: 'лампа вечером', flash: 'со вспышкой', bad: 'Фото: три оттенка одного товара', ok: 'Код или образец: один цвет' },
  en: { day: 'window, daytime', lamp: 'lamp, evening', flash: 'with flash', bad: 'Photos: three shades of one product', ok: 'Code or sample: one color' },
})

/* Оттенок на снимке — фирменный цвет, сдвинутый к светлому или тёмному:
   на схеме важно, что цвета разные, а не какие именно. */
const shots = [
  { x: 20, tone: 'lit', key: 'day' },
  { x: 190, tone: 'acc', key: 'lamp' },
  { x: 360, tone: 'dark', key: 'flash' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 300"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="shot in shots"
      :key="shot.key"
      :transform="`translate(${shot.x} 16)`"
    >
      <rect
        x="0"
        y="0"
        width="140"
        height="112"
        rx="8"
        class="paper s-line"
        stroke-width="2"
      />
      <polygon
        points="40,46 90,46 106,32 56,32"
        :class="shot.tone"
        class="s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <polygon
        points="90,46 106,32 106,82 90,96"
        :class="shot.tone"
        class="s-ink"
        stroke-width="2"
        stroke-linejoin="round"
        opacity="0.8"
      />
      <rect
        x="40"
        y="46"
        width="50"
        height="50"
        :class="shot.tone"
        class="s-ink"
        stroke-width="2"
      />
      <text
        x="70"
        y="136"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L[shot.key] }}</text>
    </g>

    <Verdict
      :x="30"
      :y="200"
      :ok="false"
    />
    <text
      x="54"
      y="206"
      class="t-b"
    >{{ L.bad }}</text>
    <Verdict
      :x="30"
      :y="254"
      :ok="true"
    />
    <text
      x="54"
      y="260"
      class="t-b"
    >{{ L.ok }}</text>

    <rect
      x="392"
      y="214"
      width="108"
      height="66"
      rx="10"
      class="acc"
    />
    <text
      x="446"
      y="254"
      text-anchor="middle"
      class="t-b t-onacc"
    >RAL 4005</text>
  </svg>
</template>
