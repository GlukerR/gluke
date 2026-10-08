<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* Одна и та же модель: из каталожного рендера (плотная сетка, огромные
   текстуры) и облегчённая для веба. Полоски — относительный вес, без
   чисел: сколько именно, зависит от модели. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { heavy: 'Из каталожного рендера', light: 'Облегчённая для веба', mesh: 'сетка', textures: 'текстуры', load: 'загрузка' },
  en: { heavy: 'From the catalog render', light: 'Light, made for the web', mesh: 'mesh', textures: 'textures', load: 'loading' },
})

const uid = useId()

const panels = [
  { y: 0, ok: false, step: 6, bars: [1, 1, 1] },
  { y: 150, ok: true, step: 18, bars: [0.35, 0.25, 0.3] },
]
const BARS = ['mesh', 'textures', 'load'] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 300"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <clipPath :id="`${uid}-shape`">
        <rect
          x="24"
          y="44"
          width="110"
          height="90"
          rx="14"
        />
      </clipPath>
    </defs>

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
      >{{ panel.ok ? L.light : L.heavy }}</text>

      <rect
        x="24"
        y="44"
        width="110"
        height="90"
        rx="14"
        class="mid"
      />
      <g
        :clip-path="`url(#${uid}-shape)`"
        class="s-ink"
        :stroke-width="panel.ok ? 1 : 0.6"
        opacity="0.5"
      >
        <line
          v-for="x in Math.ceil(110 / panel.step)"
          :key="`v-${x}`"
          :x1="24 + x * panel.step"
          y1="44"
          :x2="24 + x * panel.step"
          y2="134"
        />
        <line
          v-for="y in Math.ceil(90 / panel.step)"
          :key="`h-${y}`"
          x1="24"
          :y1="44 + y * panel.step"
          x2="134"
          :y2="44 + y * panel.step"
        />
      </g>
      <rect
        x="24"
        y="44"
        width="110"
        height="90"
        rx="14"
        class="none s-ink"
        stroke-width="2"
      />

      <g
        v-for="(bar, index) in BARS"
        :key="bar"
        :transform="`translate(170 ${56 + index * 28})`"
      >
        <text
          x="0"
          y="12"
          class="t-sm t-mut"
        >{{ L[bar] }}</text>
        <rect
          x="90"
          y="0"
          width="240"
          height="14"
          rx="7"
          class="linef"
        />
        <rect
          x="90"
          y="0"
          :width="240 * panel.bars[index]!"
          height="14"
          rx="7"
          :class="panel.ok ? 'acc' : 'mutf'"
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
