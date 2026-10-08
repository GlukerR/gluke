<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* Масштаб в AR: модель в метрах встаёт на участок в натуральную величину;
   выгруженная не в тех единицах — размером с коробку. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { ok: 'Метры: дом в натуральную величину', bad: 'Не те единицы: дом с коробку', person: '1,8 м' },
  en: { ok: 'Meters: the house at full size', bad: 'Wrong units: a box-sized house', person: '1.8 m' },
})

const panels = [
  { y: 0, ok: true, scale: 1 },
  { y: 150, ok: false, scale: 0.16 },
]
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 300"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="panel in panels"
      :key="panel.y"
      :transform="`translate(0 ${panel.y})`"
    >
      <Verdict
        :x="22"
        :y="20"
        :ok="panel.ok"
      />
      <text
        x="44"
        y="26"
        class="t-b"
      >{{ panel.ok ? L.ok : L.bad }}</text>
      <line
        x1="16"
        y1="136"
        x2="504"
        y2="136"
        class="s-line"
        stroke-width="2"
      />

      <!-- Человек для масштаба. -->
      <g transform="translate(110 136) scale(0.55)">
        <circle
          cx="0"
          cy="-74"
          r="8"
          class="mutf"
        />
        <path
          d="M 0 -64 V -30 M 0 -30 L -10 0 M 0 -30 L 10 0 M -14 -54 L 14 -54"
          class="none s-mut round"
          stroke-width="5"
        />
      </g>
      <text
        x="124"
        y="100"
        class="t-sm t-mut"
      >{{ L.person }}</text>

      <!-- Дом: в натуральную величину или крошечный. -->
      <g
        :transform="`translate(300 136) scale(${panel.scale}) translate(-90 0)`"
        class="s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      >
        <polygon
          points="0,0 180,0 180,-70 0,-70"
          class="mid"
        />
        <polygon
          points="-10,-70 90,-104 190,-70"
          class="dark"
        />
        <rect
          x="24"
          y="-50"
          width="28"
          height="24"
          class="lit"
        />
        <rect
          x="128"
          y="-50"
          width="28"
          height="24"
          class="lit"
        />
        <rect
          x="76"
          y="-40"
          width="28"
          height="40"
          class="acc"
        />
      </g>
    </g>
    <line
      x1="16"
      y1="146"
      x2="504"
      y2="146"
      class="s-line"
      stroke-width="1"
    />
  </svg>
</template>
